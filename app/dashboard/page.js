"use client";

import { useState, useEffect } from 'react';
import { Users, Home, Calendar, ClipboardCheck, AlertTriangle, CheckCircle, Info, QrCode, BookOpen, ShieldCheck, RefreshCw } from 'lucide-react';

export default function DashboardHome() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  // Toast helper
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, fadeOut: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 4000);
  };

  // Fetch User and Stats
  const fetchData = async () => {
    setLoading(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        const userRes = await fetch('/api/auth/me');
        if (!userRes.ok) throw new Error("Gagal mengambil data profil pengguna");
        currentUser = await userRes.json();
        setUser(currentUser);
      }

      const statsRes = await fetch('/api/stats');
      if (!statsRes.ok) {
        const errData = await statsRes.json();
        throw new Error(errData.error || "Gagal memuat data statistik");
      }
      const statsData = await statsRes.json();
      setStats(statsData);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return "Selamat Pagi";
    if (hours >= 11 && hours < 15) return "Selamat Siang";
    if (hours >= 15 && hours < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  if (loading || !user || !stats) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  const role = user.role;
  let presetName = "Akses Penuh (Super Admin)";
  if (role === 'Admin') {
    presetName = "Akses Tingkat Desa (Admin)";
  } else if (role === 'Moderator') {
    presetName = "Akses Tingkat Kelompok (Moderator)";
  } else if (role === 'Member') {
    presetName = "Anggota Biasa (Tanpa Akses Khusus)";
  }

  const hasLastSession = !!stats.sesi_terakhir;
  let attendancePct = 0;
  let lastSessionStats = null;

  if (hasLastSession) {
    lastSessionStats = stats.sesi_terakhir.stats;
    const totalJamaahSesi = lastSessionStats.hadir + lastSessionStats.ijin + lastSessionStats.tidak_hadir;
    attendancePct = totalJamaahSesi > 0 ? Math.round((lastSessionStats.hadir / totalJamaahSesi) * 100) : 0;
  }

  // Get localized user permission descriptions based on role
  const getUserPermissions = (role) => {
    if (role === 'Super Admin') {
      return [
        "Melihat, mengedit, menambah & menghapus seluruh database jamaah",
        "Melihat laporan rekapitulasi kehadiran semua desa & kelompok",
        "Mencatat presensi & melakukan scan QR Code jamaah global",
        "Mengatur tingkat hak akses Google akun user lain global"
      ];
    } else if (role === 'Admin') {
      return [
        `Melihat, mengedit, menambah & menghapus database jamaah terbatas Desa ${user.desa}`,
        `Melihat laporan rekapitulasi kehadiran jamaah di wilayah Desa ${user.desa}`,
        "Mencatat presensi & melakukan scan QR Code jamaah",
        `Mengatur hak akses Moderator & Member di wilayah Desa ${user.desa}`
      ];
    } else if (role === 'Moderator') {
      return [
        `Mencatat kehadiran & input presensi harian Kelompok ${user.kelompok || 'Semua'}`,
        "Melakukan scan QR Code kartu presensi jamaah saat pengajian",
        `Melihat laporan & summary kehadiran Kelompok ${user.kelompok || 'Semua'}`
      ];
    } else {
      return [
        "Membaca data pribadi terbatas akun Anda",
        "Melihat kehadiran pribadi (fitur pasif)"
      ];
    }
  };

  return (
    <div className="font-sans text-slate-750">
      {/* Header Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          Beranda Utama
        </h1>
        <p className="text-xs text-slate-400 font-bold mt-1">
          Ringkasan operasional sistem pendataan jamaah dan kehadiran
        </p>
      </div>

      {/* Grid: Welcome Card & Permissions Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Welcome Profile Card */}
        <div className="lg:col-span-1 bg-gradient-to-br from-teal-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-teal-700/30 relative overflow-hidden flex flex-col justify-between min-h-[200px]">
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none"></div>
          <div className="absolute -left-8 -bottom-8 w-20 h-20 rounded-full bg-white/5 pointer-events-none"></div>

          <div className="z-10">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-300 bg-white/10 px-2.5 py-1 rounded-full">
              Profil Pengguna
            </span>
            <h2 className="text-lg font-black tracking-tight mt-4.5 mb-1 text-white">
              {getGreeting()}, {user.email.split('@')[0]}!
            </h2>
            <p className="text-xs text-teal-200 font-bold break-all opacity-90">{user.email}</p>
          </div>

          <div className="z-10 border-t border-white/10 pt-4 mt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-teal-300">
              <span>Tingkat Akses</span>
              <span>Desa</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>{role === 'Super Admin' ? 'Akses Penuh' : role === 'Admin' ? 'Akses Desa' : role === 'Moderator' ? 'Akses Kelompok' : 'Anggota'}</span>
              <span className="truncate max-w-[150px]">{role === 'Super Admin' ? 'Semua Wilayah' : user.desa}</span>
            </div>
          </div>
        </div>

        {/* Permissions Card */}
        <div className="lg:col-span-2 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
              <ShieldCheck className="text-primary shrink-0" size={18} />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Hak Akses Aktif Anda</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {getUserPermissions(user.role).map((perm, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs font-semibold text-slate-650">
                  <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0 font-extrabold text-[9px] mt-0.5">✓</span>
                  <span className="leading-relaxed">{perm}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-t border-slate-50 pt-3 mt-4">
            <span className="flex items-center gap-1"><Info size={11} /> Status: {presetName}</span>
            <button onClick={fetchData} className="text-primary hover:underline font-extrabold uppercase tracking-wider flex items-center gap-1 cursor-pointer"><RefreshCw size={10} /> Segarkan</button>
          </div>
        </div>
      </div>

      {/* Symmetrical Summary Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Metric 1 - Total Jamaah */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span id="metric-total-jamaah" className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
              {stats.total_jamaah}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Jamaah Aktif</span>
          </div>
        </div>
        
        {/* Metric 2 - Total Keluarga */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Home size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span id="metric-total-keluarga" className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
              {stats.total_keluarga}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Unit Keluarga</span>
          </div>
        </div>
        
        {/* Metric 3 - Attendance Percent */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span id="metric-attendance-pct" className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
              {hasLastSession ? `${attendancePct}%` : '0%'}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate" id="attendance-metric-label">
              Rasio Kehadiran Terakhir
            </span>
          </div>
        </div>
      </div>

      {/* Operational Workflow Guide Section */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
        <div className="border-b border-slate-100 pb-4 mb-6 flex items-center gap-2">
          <BookOpen className="text-primary shrink-0" size={18} />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Panduan Alur Kerja Aplikasi</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 flex flex-col gap-3.5 hover:shadow-sm transition-all duration-150">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 font-extrabold text-sm border border-teal-100/40">
              1
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={14} className="text-teal-700 shrink-0" />
                <span>Lengkapi Database</span>
              </h4>
              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed mt-2">
                Super Admin atau Admin menginput profil data jamaah secara terpusat di menu **Database Jamaah** sesuai wilayah desa masing-masing.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 flex flex-col gap-3.5 hover:shadow-sm transition-all duration-150">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 font-extrabold text-sm border border-emerald-100/40">
              2
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <QrCode size={14} className="text-emerald-700 shrink-0" />
                <span>Cetak Kartu Presensi</span>
              </h4>
              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed mt-2">
                Buka modal pratinjau kartu anggota dari database, kemudian cetak kartu fisik yang dilengkapi **QR Code** unik untuk setiap jamaah.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 flex flex-col gap-3.5 hover:shadow-sm transition-all duration-150">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 font-extrabold text-sm border border-amber-100/40">
              3
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ClipboardCheck size={14} className="text-amber-700 shrink-0" />
                <span>Pindai QR Kehadiran</span>
              </h4>
              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed mt-2">
                Saat pengajian, Moderator memindai QR Code kartu jamaah menggunakan kamera handphone di menu **Daftar Kehadiran** untuk absensi instan.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 flex flex-col gap-3.5 hover:shadow-sm transition-all duration-150">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 font-extrabold text-sm border border-blue-100/40">
              4
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-700 shrink-0" />
                <span>Rekap & Laporan</span>
              </h4>
              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed mt-2">
                Pantau rasio tingkat kehadiran jamaah dan rekapitulasi data kehadiran harian/rentang tanggal di tab **Laporan Kehadiran**.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification Container */}
      <div className="toast-container fixed bottom-8 right-8 z-50 flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`toast bg-white shadow-xl rounded-xl border-l-4 p-4 min-w-[320px] max-w-[450px] flex items-center gap-3 animate-slideIn transition-all duration-300 ${
            t.type === 'success' ? 'border-pastel-green-solid' :
            t.type === 'error' ? 'border-red-500' :
            'border-primary'
          } ${t.fadeOut ? 'opacity-0 translate-y-2' : 'opacity-100'}`}>
            {t.type === 'success' && <CheckCircle size={20} className="text-pastel-green-solid" />}
            {t.type === 'error' && <AlertTriangle size={20} className="text-red-500" />}
            {t.type === 'info' && <Info size={20} className="text-primary" />}
            <div className="text-xs font-bold text-slate-800 flex-1">{t.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
