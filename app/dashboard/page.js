"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, Home, Calendar, ClipboardCheck, AlertTriangle, 
  CheckCircle, Info, QrCode, BookOpen, ShieldCheck, 
  RefreshCw, History, ArrowRight, Search, UserCheck, Trash2, Clock 
} from 'lucide-react';

export default function DashboardHome() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);

  // Role-specific States
  const [activityLogs, setActivityLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [linkedJamaah, setLinkedJamaah] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

  // Fetch all necessary data based on role
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get current user profile
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Gagal mengambil data profil pengguna");
      const currentUser = await userRes.json();
      setUser(currentUser);

      // 2. Get statistics
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 3. Load role-specific data
      if (currentUser.role === 'Super Admin') {
        // Load recent activity logs
        try {
          const logsRes = await fetch('/api/activity-logs?limit=5');
          if (logsRes.ok) {
            const logsData = await logsRes.json();
            setActivityLogs(logsData.logs || []);
          }
        } catch (e) {
          console.error("Gagal memuat log aktivitas:", e);
        }
      }

      if (currentUser.role === 'Moderator' || currentUser.role === 'Member') {
        // Load sessions list
        try {
          const sessionsRes = await fetch('/api/sesi');
          if (sessionsRes.ok) {
            const sessionsData = await sessionsRes.json();
            setSessions(sessionsData);
          }
        } catch (e) {
          console.error("Gagal memuat sesi:", e);
        }
      }

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

    // Check for saved linked profile in localStorage (for Member role)
    const saved = localStorage.getItem('linked_jamaah');
    if (saved) {
      try {
        setLinkedJamaah(JSON.parse(saved));
      } catch (e) {
        console.error("Gagal memuat profil tertaut:", e);
      }
    }
  }, []);

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return "Selamat Pagi";
    if (hours >= 11 && hours < 15) return "Selamat Siang";
    if (hours >= 15 && hours < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  const getTodayDateString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
    return localISOTime;
  };

  // Search jamaah for linking (Member role)
  const handleSearchJamaah = async (q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/jamaah/lookup?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleLinkProfile = (jamaahObj) => {
    localStorage.setItem('linked_jamaah', JSON.stringify(jamaahObj));
    setLinkedJamaah(jamaahObj);
    showToast(`Berhasil menautkan profil ${jamaahObj.nama_lengkap}!`, "success");
  };

  const handleUnlinkProfile = () => {
    localStorage.removeItem('linked_jamaah');
    setLinkedJamaah(null);
    setSearchQuery('');
    setSearchResults([]);
    showToast("Tautan profil dihapus.", "info");
  };

  if (loading || !user || !stats) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  // Calculate last session attendance percentage
  const hasLastSession = !!stats.sesi_terakhir;
  let attendancePct = 0;
  let lastSessionStats = null;
  if (hasLastSession) {
    lastSessionStats = stats.sesi_terakhir.stats;
    const totalJamaahSesi = lastSessionStats.hadir + lastSessionStats.ijin + lastSessionStats.tidak_hadir;
    attendancePct = totalJamaahSesi > 0 ? Math.round((lastSessionStats.hadir / totalJamaahSesi) * 100) : 0;
  }

  // Render Horizontal Bar Chart for group distribution
  const renderGroupDistribution = () => {
    const dist = stats.distribusi_kelompok || [];
    if (dist.length === 0) {
      return (
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs font-semibold">
          Tidak ada data sebaran kelompok.
        </div>
      );
    }

    const maxCount = Math.max(...dist.map(d => d.count), 1);

    return (
      <div className="flex flex-col gap-3.5">
        {dist.map((d, idx) => {
          const pct = (d.count / maxCount) * 100;
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>{d.kelompok}</span>
                <span className="text-slate-500 font-extrabold">{d.count} Jamaah</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-teal-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- RENDERING FOR EACH ROLE ---

  // 1. SUPER ADMIN HOME
  if (user.role === 'Super Admin') {
    return (
      <div className="font-sans text-slate-750">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Beranda Utama</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">Status Sistem: Akses Penuh (Super Admin)</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer">
            <RefreshCw size={12} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Dynamic Greeting Banner */}
        <div className="bg-gradient-to-br from-teal-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-teal-700/30 relative overflow-hidden mb-8">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none"></div>
          <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none"></div>
          
          <div className="z-10 relative">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-300 bg-white/10 px-2.5 py-1 rounded-full">
              Sistem Informasi Andara
            </span>
            <h2 className="text-xl font-black tracking-tight mt-4 mb-1">
              {getGreeting()}, {user.email.split('@')[0]}!
            </h2>
            <p className="text-xs text-teal-100 font-semibold opacity-90">Hari ini Anda memiliki akses penuh ke seluruh database jamaah dan rekapitulasi kehadiran.</p>
          </div>
        </div>

        {/* Global Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">{stats.total_jamaah}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Jamaah Aktif</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Home size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">{stats.total_keluarga}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Unit Keluarga</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
                {hasLastSession ? `${attendancePct}%` : '0%'}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Rasio Pengajian Terakhir</span>
            </div>
          </div>
        </div>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sebaran Kelompok */}
          <div className="lg:col-span-2 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <Users size={16} className="text-teal-700 shrink-0" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Sebaran Jamaah per Kelompok</h3>
              </div>
              {renderGroupDistribution()}
            </div>
            <div className="border-t border-slate-50 pt-3 mt-4 flex justify-between items-center text-[10px] text-slate-400 font-bold">
              <span>Total data dari seluruh desa</span>
              <button onClick={() => router.push('/dashboard/database')} className="text-teal-700 hover:underline flex items-center gap-1 cursor-pointer">
                <span>Lihat Database</span>
                <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Activity Log & Quick Actions */}
          <div className="flex flex-col gap-6">
            {/* Quick Actions */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <ShieldCheck size={16} className="text-teal-700 shrink-0" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Pintasan Manajemen</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => router.push('/dashboard/database')} className="p-3 border border-slate-100 hover:border-teal-600/30 hover:bg-teal-50/20 rounded-xl flex flex-col items-center gap-2 text-center transition-all cursor-pointer">
                  <Users size={18} className="text-teal-700" />
                  <span className="text-[10px] font-bold text-slate-700">Database</span>
                </button>
                <button onClick={() => router.push('/dashboard/presensi')} className="p-3 border border-slate-100 hover:border-teal-600/30 hover:bg-teal-50/20 rounded-xl flex flex-col items-center gap-2 text-center transition-all cursor-pointer">
                  <ClipboardCheck size={18} className="text-teal-700" />
                  <span className="text-[10px] font-bold text-slate-700">Presensi</span>
                </button>
                <button onClick={() => router.push('/dashboard/users')} className="p-3 border border-slate-100 hover:border-teal-600/30 hover:bg-teal-50/20 rounded-xl flex flex-col items-center gap-2 text-center transition-all cursor-pointer">
                  <ShieldCheck size={18} className="text-teal-700" />
                  <span className="text-[10px] font-bold text-slate-700">Akses User</span>
                </button>
                <button onClick={() => router.push('/dashboard/lokasi')} className="p-3 border border-slate-100 hover:border-teal-600/30 hover:bg-teal-50/20 rounded-xl flex flex-col items-center gap-2 text-center transition-all cursor-pointer">
                  <Home size={18} className="text-teal-700" />
                  <span className="text-[10px] font-bold text-slate-700">Data Lokasi</span>
                </button>
              </div>
            </div>

            {/* Log Aktivitas */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <History size={16} className="text-teal-700 shrink-0" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Aktivitas Terkini</h3>
              </div>
              
              <div className="flex flex-col gap-3">
                {activityLogs.slice(0, 4).map((log, idx) => {
                  const date = new Date(log.timestamp);
                  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
                  return (
                    <div key={idx} className="flex items-start gap-2.5 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-700 truncate leading-tight">{log.details}</p>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{log.user_email.split('@')[0]} • {timeStr}</p>
                      </div>
                    </div>
                  );
                })}
                {activityLogs.length === 0 && (
                  <p className="text-[10px] text-slate-400 font-bold text-center py-4">Tidak ada log aktivitas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. ADMIN HOME (DESA ACCESS)
  if (user.role === 'Admin') {
    return (
      <div className="font-sans text-slate-750">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Beranda Utama</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">Wilayah Kerja: Desa {user.desa}</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer">
            <RefreshCw size={12} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Dynamic Greeting Banner */}
        <div className="bg-gradient-to-br from-indigo-850 to-teal-950 text-white rounded-2xl p-6 shadow-md border border-indigo-700/30 relative overflow-hidden mb-8">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none"></div>
          <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none"></div>
          
          <div className="z-10 relative">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-300 bg-white/10 px-2.5 py-1 rounded-full">
              Sistem Informasi Andara — Desa {user.desa}
            </span>
            <h2 className="text-xl font-black tracking-tight mt-4 mb-1">
              {getGreeting()}, {user.email.split('@')[0]}!
            </h2>
            <p className="text-xs text-indigo-100 font-semibold opacity-90">Memantau dan mengelola data jamaah aktif di Desa {user.desa} secara terpusat.</p>
          </div>
        </div>

        {/* Desa Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">{stats.total_jamaah}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Jamaah Desa {user.desa}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Home size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">{stats.total_keluarga}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Keluarga Desa {user.desa}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-200 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">
                {hasLastSession ? `${attendancePct}%` : '0%'}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Kehadiran Terakhir Desa</span>
            </div>
          </div>
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sebaran Kelompok Desa */}
          <div className="lg:col-span-2 bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
              <Users size={16} className="text-indigo-700 shrink-0" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Sebaran Kelompok Terpantau</h3>
            </div>
            {renderGroupDistribution()}
          </div>

          {/* Quick Actions Admin */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
              <ShieldCheck size={16} className="text-indigo-700 shrink-0" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Menu Aksi Cepat</h3>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => router.push('/dashboard/database')} className="flex items-center justify-between p-3.5 border border-slate-100 hover:border-indigo-600/30 hover:bg-indigo-50/20 rounded-xl transition-all cursor-pointer w-full text-left">
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-indigo-700" />
                  <span className="text-xs font-bold text-slate-700">Database Jamaah</span>
                </div>
                <ArrowRight size={13} className="text-slate-400" />
              </button>
              <button onClick={() => router.push('/dashboard/presensi')} className="flex items-center justify-between p-3.5 border border-slate-100 hover:border-indigo-600/30 hover:bg-indigo-50/20 rounded-xl transition-all cursor-pointer w-full text-left">
                <div className="flex items-center gap-3">
                  <ClipboardCheck size={16} className="text-indigo-700" />
                  <span className="text-xs font-bold text-slate-700">Input Kehadiran Sesi</span>
                </div>
                <ArrowRight size={13} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. MODERATOR HOME (SCANNER FOCUS)
  if (user.role === 'Moderator') {
    const todayStr = getTodayDateString();
    const activeGroupSess = sessions.filter(s => s.tanggal === todayStr && s.kelompok === user.kelompok);
    const hasSessionToday = activeGroupSess.length > 0;

    return (
      <div className="font-sans text-slate-750">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Beranda Utama</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">Peran: Moderator Kelompok — Kelompok {user.kelompok || 'Semua'}</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer">
            <RefreshCw size={12} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Dynamic Greeting Banner */}
        <div className="bg-gradient-to-br from-amber-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-amber-700/30 relative overflow-hidden mb-8">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none"></div>
          <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none"></div>
          
          <div className="z-10 relative">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-300 bg-white/10 px-2.5 py-1 rounded-full">
              Pusat Absensi Lapangan
            </span>
            <h2 className="text-xl font-black tracking-tight mt-4 mb-1">
              {getGreeting()}, {user.email.split('@')[0]}!
            </h2>
            <p className="text-xs text-amber-100 font-semibold opacity-90">Siap mencatat absensi harian kelompok {user.kelompok || 'Semua'}.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Session Status */}
          <div className="lg:col-span-2 bg-white border border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <Clock size={16} className="text-amber-700 shrink-0" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Jadwal Sesi Kelompok Hari Ini</h3>
              </div>

              {hasSessionToday ? (
                activeGroupSess.map((sess, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-5 mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100/50">Sesi Aktif</span>
                        <h4 className="text-sm font-extrabold text-slate-800 mt-2">{sess.nama_sesi}</h4>
                        <p className="text-xs text-slate-500 font-semibold mt-1">Target: {sess.desa} • {sess.kategori_target}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-extrabold text-slate-700">{sess.jam_mulai} - {sess.jam_selesai}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">{sess.tanggal}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 flex flex-col items-center justify-center">
                  <AlertTriangle size={32} className="opacity-45 mb-2.5 text-amber-600" />
                  <p className="font-extrabold text-xs text-slate-700">Tidak ada sesi pengajian terdaftar hari ini</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Silakan buat sesi terlebih dahulu di menu Presensi.</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-50 pt-4 mt-6 grid grid-cols-2 gap-4">
              <button 
                onClick={() => router.push('/dashboard/presensi/scan')} 
                className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md shadow-amber-600/10 transition-all cursor-pointer active:scale-95 text-center"
              >
                <QrCode size={15} />
                <span>Buka Scan QR</span>
              </button>
              <button 
                onClick={() => router.push('/dashboard/presensi/rfid')} 
                className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-md shadow-slate-800/10 transition-all cursor-pointer active:scale-95 text-center"
              >
                <Users size={15} />
                <span>Kiosk RFID</span>
              </button>
            </div>
          </div>

          {/* Sesi Terakhir Stats */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <Calendar size={16} className="text-amber-700 shrink-0" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Presensi Kelompok Anda</h3>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-650">
                  <span>Total Jamaah Kelompok:</span>
                  <span className="font-extrabold text-slate-800">{stats.total_jamaah} orang</span>
                </div>
                {hasLastSession && (
                  <>
                    <div className="border-t border-slate-50 pt-3 flex flex-col gap-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rekap Sesi Terakhir</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                        <div className="bg-emerald-50 text-emerald-700 p-2 rounded-lg">
                          <p>Hadir</p>
                          <p className="text-sm font-extrabold mt-0.5">{lastSessionStats?.hadir || 0}</p>
                        </div>
                        <div className="bg-amber-50 text-amber-700 p-2 rounded-lg">
                          <p>Ijin</p>
                          <p className="text-sm font-extrabold mt-0.5">{lastSessionStats?.ijin || 0}</p>
                        </div>
                        <div className="bg-red-50 text-red-700 p-2 rounded-lg">
                          <p>Absen</p>
                          <p className="text-sm font-extrabold mt-0.5">{lastSessionStats?.tidak_hadir || 0}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button 
              onClick={() => router.push('/dashboard/presensi')} 
              className="mt-6 w-full text-center text-xs font-bold text-amber-700 hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Manajemen Presensi Sesi</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. MEMBER HOME (PERSONAL DIGITAL ID CARD)
  if (user.role === 'Member') {
    return (
      <div className="font-sans text-slate-750">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Portal Anggota</h1>
          <p className="text-xs text-slate-400 font-bold mt-1">Masjid Andara — Profil Mandiri Jamaah</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Link Profile Search / Status info */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {!linkedJamaah ? (
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                  <Search size={16} className="text-teal-700" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Tautkan Profil Jamaah</h3>
                </div>
                <p className="text-[11px] text-slate-450 font-bold leading-relaxed mb-4">
                  Cari nama lengkap Anda di database Masjid untuk mengaktifkan Kartu Anggota Digital di peramban ini.
                </p>
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input 
                      type="text"
                      placeholder="Masukkan nama lengkap Anda..."
                      value={searchQuery}
                      onChange={(e) => handleSearchJamaah(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs font-bold text-slate-750 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-teal-600/50 transition-colors"
                    />
                  </div>

                  {searching && (
                    <div className="text-center py-2 text-[10px] font-bold text-slate-400">Mencari...</div>
                  )}

                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                    {searchResults.map((j) => (
                      <div key={j.id} className="flex justify-between items-center p-2.5 border border-slate-100 hover:border-teal-600/30 rounded-xl hover:bg-teal-50/10 transition-all">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 truncate">{j.nama_lengkap}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{j.kelompok} • {j.desa}</p>
                        </div>
                        <button 
                          onClick={() => handleLinkProfile(j)}
                          className="flex items-center gap-1 py-1 px-2 font-bold text-[9px] bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm cursor-pointer transition-all"
                        >
                          <UserCheck size={10} />
                          <span>Tautkan</span>
                        </button>
                      </div>
                    ))}
                    {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
                      <p className="text-[10px] text-slate-400 font-bold text-center py-2">Nama tidak ditemukan.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-teal-700" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Profil Tertaut</h3>
                  </div>
                  <button 
                    onClick={handleUnlinkProfile}
                    className="text-red-500 hover:text-red-650 flex items-center gap-1 text-[9px] font-extrabold cursor-pointer border-none bg-transparent"
                  >
                    <Trash2 size={11} />
                    <span>Hapus Tautan</span>
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 font-extrabold text-sm">
                    {linkedJamaah.nama_lengkap.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-800 truncate uppercase">{linkedJamaah.nama_lengkap}</h4>
                    <p className="text-[10px] text-slate-450 font-bold mt-0.5">{linkedJamaah.kelompok} • Desa {linkedJamaah.desa}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-[10px] font-bold text-slate-500 flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span>Kategori Saringan:</span>
                    <span className="text-slate-800">{linkedJamaah.kategori}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jenis Kelamin:</span>
                    <span className="text-slate-800">{linkedJamaah.jenis_kelamin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ID Anggota:</span>
                    <span className="text-slate-800 font-mono truncate max-w-[120px]">{linkedJamaah.id}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Informational Notice */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-teal-700 shrink-0" />
                <h4 className="text-xs font-extrabold text-slate-800">Petunjuk Presensi</h4>
              </div>
              <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                Tunjukkan QR Code di kartu digital Anda kepada Moderator saat memasuki ruang pengajian kelompok untuk absensi instan secara mandiri.
              </p>
            </div>
          </div>

          {/* Right Column: Dynamic Member Card Display */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center min-h-[350px]">
            {linkedJamaah ? (
              <div className="w-full max-w-[380px] bg-gradient-to-br from-teal-800 via-teal-900 to-emerald-950 text-white rounded-3xl p-6 shadow-xl border border-teal-700/40 relative overflow-hidden flex flex-col justify-between h-[450px]">
                {/* Decorative circles */}
                <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full bg-white/5 pointer-events-none"></div>
                <div className="absolute -left-16 -bottom-16 w-36 h-36 rounded-full bg-white/5 pointer-events-none"></div>

                {/* Card Header */}
                <div className="flex justify-between items-start z-10 relative">
                  <div>
                    <h3 className="text-xs font-black tracking-widest text-teal-300 uppercase">KARTU ANGGOTA DIGITAL</h3>
                    <p className="text-[8px] font-bold tracking-tight opacity-75 mt-0.5">MASJID ANDARA SUPER APPS</p>
                  </div>
                  <span className="text-[8px] font-extrabold uppercase bg-white/10 px-2 py-0.5 rounded border border-white/10">Active</span>
                </div>

                {/* QR Code Center Display */}
                <div className="flex justify-center items-center my-6 z-10 relative">
                  <div className="bg-white p-3.5 rounded-2xl shadow-lg border border-teal-800/10">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${linkedJamaah.id}`} 
                      alt="QR Code Anggota" 
                      className="w-32 h-32 object-contain"
                    />
                  </div>
                </div>

                {/* Card Footer */}
                <div className="z-10 relative border-t border-white/10 pt-4 flex justify-between items-end">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">{linkedJamaah.kategori}</p>
                    <h2 className="text-sm font-extrabold tracking-tight truncate max-w-[200px] uppercase mt-0.5">{linkedJamaah.nama_lengkap}</h2>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] font-bold opacity-75">KELOMPOK</p>
                    <p className="text-xs font-black text-white mt-0.5">{linkedJamaah.kelompok}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center text-slate-400 bg-white shadow-sm w-full max-w-[380px] h-[450px]">
                <QrCode size={48} className="opacity-35 text-teal-700 mb-4" />
                <p className="font-extrabold text-sm text-slate-800">Kartu Digital Belum Aktif</p>
                <p className="text-[11px] text-slate-400 font-bold leading-relaxed mt-2.5 px-4">
                  Gunakan menu saringan di sebelah kiri untuk mencari nama Anda dan menautkan profil ke peramban ini guna mengaktifkan kartu.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback default view (Just in case role doesn't match above)
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center font-sans">
      <AlertTriangle size={36} className="text-amber-500 mx-auto mb-3" />
      <h3 className="font-extrabold text-sm text-slate-800">Akses Terbatas</h3>
      <p className="text-xs text-slate-450 mt-1 font-bold">Akun Anda belum memiliki pengaturan beranda khusus. Silakan hubungi Super Admin.</p>
    </div>
  );
}
