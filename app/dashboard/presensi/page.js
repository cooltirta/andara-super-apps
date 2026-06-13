"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Search, Users, CheckCircle, AlertTriangle, Info, Clock, Download, RefreshCw, Trash2 } from 'lucide-react';

export default function PresensiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('input'); // 'input' or 'laporan'

  // Input Tab States
  const [selectedDate, setSelectedDate] = useState('');
  const [attendanceTime, setAttendanceTime] = useState('');
  const [jamaahList, setJamaahList] = useState([]);
  const [loadingInput, setLoadingInput] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [toasts, setToasts] = useState([]);
  
  // Input Filters
  const [searchName, setSearchName] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterKategori, setFilterKategori] = useState('');

  // Laporan Tab States
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportDesa, setReportDesa] = useState('');
  const [reportKelompok, setReportKelompok] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Helper Toast
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

  // 1. Ambil Profil Pengguna saat Load
  const loadUser = async () => {
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await userRes.json();
      setUser(currentUser);

      if (currentUser.role === 'Member') {
        showToast("Akses Ditolak: Anggota tidak memiliki wewenang presensi", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      // Default filters berdasarkan role user
      if (currentUser.role === 'Admin') {
        setFilterDesa(currentUser.desa);
        setReportDesa(currentUser.desa);
      } else if (currentUser.role === 'Moderator') {
        setFilterDesa(currentUser.desa);
        setFilterKelompok(currentUser.kelompok);
        setReportDesa(currentUser.desa);
        setReportKelompok(currentUser.kelompok);
      }

      // Default Date Picker ke hari ini (Format: YYYY-MM-DD)
      const todayStr = new Date().toISOString().split('T')[0];
      setSelectedDate(todayStr);

      // Default Date Range Laporan ke awal bulan s/d hari ini
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      setReportStartDate(firstDayOfMonth.toISOString().split('T')[0]);
      setReportEndDate(todayStr);
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  // 2. Load Data Kehadiran ketika Tanggal berubah
  const loadInputAttendance = async () => {
    if (!selectedDate || !user) return;
    setLoadingInput(true);
    try {
      const res = await fetch(`/api/kehadiran?date=${selectedDate}`);
      if (!res.ok) throw new Error("Gagal mengambil data kehadiran");
      const data = await res.json();
      setJamaahList(data);

      const initialDraft = {};
      data.forEach(j => {
        initialDraft[j.jamaah_id] = j.status || 'Tidak Hadir';
      });
      setAttendanceDraft(initialDraft);
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoadingInput(false);
    }
  };

  useEffect(() => {
    loadInputAttendance();
  }, [selectedDate, user]);

  // Reset jam dan menit jika beralih tanggal hari ini
  const todayStr = new Date().toISOString().split('T')[0];
  const isBackdate = selectedDate && selectedDate < todayStr;

  useEffect(() => {
    if (!isBackdate) {
      setAttendanceTime('');
    } else {
      // Set default ke jam menit saat ini untuk mempermudah
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      setAttendanceTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    }
  }, [selectedDate]);

  // 3. Update Status Kehadiran secara Lokal di Draf
  const handleUpdateStatus = (jamaahId, status) => {
    setAttendanceDraft(prev => ({
      ...prev,
      [jamaahId]: status
    }));
  };

  // 3b. Submit Bulk Kehadiran ke Database
  const handleSubmitAttendance = async () => {
    if (isBackdate && !attendanceTime) {
      showToast("Gagal: Anda harus mengisi jam & menit untuk pengisian tanggal lampau (backdate)", "error");
      return;
    }

    setLoadingSubmit(true);

    let waktuPresensi = null;
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');

    if (isBackdate) {
      waktuPresensi = `${selectedDate} ${attendanceTime}:00`;
    } else {
      waktuPresensi = `${selectedDate} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    const kehadiranPayload = Object.keys(attendanceDraft).map(id => ({
      jamaah_id: id,
      status: attendanceDraft[id]
    }));

    try {
      const res = await fetch('/api/kehadiran', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: selectedDate,
          waktu_presensi: waktuPresensi,
          kehadiran: kehadiranPayload
        })
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Kehadiran berhasil disimpan ke database", "success");
        loadInputAttendance();
      } else {
        showToast(data.error || "Gagal menyimpan kehadiran", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan kehadiran ke database", "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  // 3c. Hapus Presensi Harian dari Database
  const handleDeleteAttendance = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus seluruh data presensi untuk tanggal ${selectedDate}? Data yang sudah tersimpan di database akan dihapus.`)) {
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch(`/api/kehadiran?date=${selectedDate}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Berhasil menghapus presensi untuk tanggal ${selectedDate}`, "success");
        loadInputAttendance();
      } else {
        showToast(data.error || "Gagal menghapus presensi", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghubungi server", "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  // 4. Load Laporan Kehadiran
  const loadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      showToast("Mulai dan selesai wajib diisi", "error");
      return;
    }
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/kehadiran/laporan?start_date=${reportStartDate}&end_date=${reportEndDate}&desa=${reportDesa}&kelompok=${reportKelompok}`);
      if (!res.ok) throw new Error("Gagal memuat laporan kehadiran");
      const data = await res.json();
      setReportData(data);
      showToast("Laporan berhasil dimuat", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoadingReport(false);
    }
  };

  // Load report data saat pertama kali tab laporan dibuka
  useEffect(() => {
    if (activeTab === 'laporan' && !reportData && reportStartDate && reportEndDate && user) {
      loadReport();
    }
  }, [activeTab, user]);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  // Filter List Jamaah lokal (pada tab Input)
  const filteredInputList = jamaahList.filter(j => {
    const matchName = j.nama_lengkap.toLowerCase().includes(searchName.toLowerCase().trim());
    const matchDesa = filterDesa ? j.desa === filterDesa : true;
    const matchKelompok = filterKelompok ? j.kelompok === filterKelompok : true;
    const matchGender = filterGender ? j.jenis_kelamin === filterGender : true;
    const matchKategori = filterKategori ? j.kategori === filterKategori : true;
    return matchName && matchDesa && matchKelompok && matchGender && matchKategori;
  });

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Kehadiran & Presensi Jamaah
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            {user.role === 'Super Admin' 
              ? 'Akses Global (Seluruh Desa & Kelompok)' 
              : user.role === 'Admin' 
                ? `Akses Desa Andara (Desa ${user.desa})` 
                : `Akses Kelompok (Desa ${user.desa}, Kelompok ${user.kelompok})`
            }
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-100 mb-6 gap-6">
        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'input' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          onClick={() => setActiveTab('input')}
        >
          Input Kehadiran
        </button>
        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'laporan' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          onClick={() => setActiveTab('laporan')}
        >
          Laporan Kehadiran
        </button>
      </div>

      {/* ================================================= TAB INPUT ================================================= */}
      {activeTab === 'input' && (
        <div className="flex flex-col gap-6">
          {/* Tanggal Picker & Time Picker Panel */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
              <span className="uppercase tracking-wider">Tanggal Kehadiran:</span>
              <input 
                type="date" 
                className="px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 font-bold text-xs" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {isBackdate && (
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600 animate-fadeIn bg-pastel-yellow border border-pastel-yellow-solid/25 px-4 py-2 rounded-xl">
                <Clock size={16} className="text-pastel-yellow-text" />
                <span className="text-pastel-yellow-text uppercase tracking-wider">Jam & Menit Pengajian (Backdate):</span>
                <input 
                  type="time" 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 font-bold text-xs" 
                  value={attendanceTime}
                  onChange={(e) => setAttendanceTime(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="ml-auto flex items-center gap-3">
              <button 
                onClick={loadInputAttendance} 
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw size={14} className={loadingInput ? "animate-spin" : ""} />
              </button>
              {jamaahList.some(j => j.kehadiran_id !== null) && (
                <button
                  onClick={handleDeleteAttendance}
                  disabled={loadingSubmit}
                  className={`py-2 px-4 rounded-lg bg-pastel-red hover:bg-pastel-red-solid/30 text-pastel-red-text font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${loadingSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Trash2 size={14} />
                  <span>Hapus Presensi</span>
                </button>
              )}
              <button
                onClick={handleSubmitAttendance}
                disabled={loadingSubmit || (isBackdate && !attendanceTime)}
                className={`py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${(loadingSubmit || (isBackdate && !attendanceTime)) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <CheckCircle size={14} className={loadingSubmit ? "animate-spin" : ""} />
                <span>{loadingSubmit ? "Menyimpan..." : "Simpan Kehadiran"}</span>
              </button>
            </div>
          </div>

          {/* Saringan Pencarian & Filter */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-3 flex flex-wrap items-center gap-3.5">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                placeholder="Cari nama jamaah..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Filter Desa */}
              {user.role === 'Super Admin' ? (
                <select 
                  className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                  value={filterDesa}
                  onChange={(e) => setFilterDesa(e.target.value)}
                >
                  <option value="">Semua Desa</option>
                  <option value="Andara">Andara</option>
                  <option value="Bojong">Bojong</option>
                  <option value="Cisadane">Cisadane</option>
                </select>
              ) : (
                <input 
                  type="text" 
                  className="px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 font-bold text-[10px] cursor-not-allowed outline-none" 
                  value={`Desa: ${filterDesa}`}
                  disabled 
                />
              )}

              {/* Filter Kelompok */}
              {user.role === 'Moderator' ? (
                <input 
                  type="text" 
                  className="px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 font-bold text-[10px] cursor-not-allowed outline-none" 
                  value={`Kelompok: ${filterKelompok}`}
                  disabled 
                />
              ) : (
                <select 
                  className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                  value={filterKelompok}
                  onChange={(e) => setFilterKelompok(e.target.value)}
                >
                  <option value="">Semua Kelompok</option>
                  <option value="Andara 1">Andara 1</option>
                  <option value="Andara 2">Andara 2</option>
                  <option value="Andara 3">Andara 3</option>
                  <option value="Andara 4">Andara 4</option>
                  <option value="Andara 5">Andara 5</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              )}

              <select 
                className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="">Semua Gender</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>

              <select 
                className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
              >
                <option value="">Semua Kategori</option>
                <option value="Balita">Balita</option>
                <option value="CBR/PAUD">CBR/PAUD</option>
                <option value="Pra Remaja">Pra Remaja</option>
                <option value="Remaja">Remaja</option>
                <option value="Pra Nikah">Pra Nikah</option>
                <option value="Dewasa">Dewasa</option>
                <option value="Lansia">Lansia</option>
              </select>
            </div>
          </div>

          {/* Warning banner jika backdate dan jam kosong */}
          {isBackdate && !attendanceTime && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-left text-xs font-bold text-red-650 flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <span>Gagal: Input waktu (Jam & Menit) wajib ditentukan pada kotak kuning di atas untuk melakukan pengisian presensi lampau (Backdate).</span>
            </div>
          )}

          {/* Daftar Tabel Jamaah */}
          {loadingInput ? (
            <div className="flex justify-center py-12">
              <div className="spinner"></div>
            </div>
          ) : filteredInputList.length === 0 ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Users size={44} className="opacity-40 mb-4" />
              <p className="font-bold text-sm">Tidak ada data jamaah ditemukan dalam jangkauan Anda.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Nama Lengkap</th>
                      <th className="px-6 py-4">Desa</th>
                      <th className="px-6 py-4">Kelompok</th>
                      <th className="px-6 py-4">Gender</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4 text-center" style={{ width: '300px' }}>Status Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInputList.map(j => {
                      const isDisabled = !j.can_edit || (isBackdate && !attendanceTime);
                      const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
                      const currentStatus = attendanceDraft[j.jamaah_id] || 'Tidak Hadir';
                      
                      return (
                        <tr key={j.jamaah_id} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                          <td className="px-6 py-4.5 font-bold text-slate-800">{j.nama_lengkap}</td>
                          <td className="px-6 py-4.5 text-primary">{j.desa}</td>
                          <td className="px-6 py-4.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                              {j.kelompok}
                            </span>
                          </td>
                          <td className="px-6 py-4.5">{j.jenis_kelamin}</td>
                          <td className="px-6 py-4.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                              {j.kategori}
                            </span>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex justify-center">
                              {/* 3-State Toggle Group */}
                              <div className={`flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 w-[260px] ${disabledClass}`}>
                                <button 
                                  className={`flex-1 text-center py-1.5 text-[9px] font-extrabold uppercase rounded-md transition-all focus:outline-none ${
                                    currentStatus === 'Hadir' 
                                      ? 'bg-pastel-green-solid text-white shadow-sm shadow-pastel-green-solid/20' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`} 
                                  disabled={isDisabled}
                                  onClick={() => handleUpdateStatus(j.jamaah_id, 'Hadir')}
                                >
                                  Hadir
                                </button>
                                <button 
                                  className={`flex-1 text-center py-1.5 text-[9px] font-extrabold uppercase rounded-md transition-all focus:outline-none ${
                                    currentStatus === 'Ijin' 
                                      ? 'bg-pastel-yellow-solid text-pastel-yellow-text shadow-sm shadow-pastel-yellow-solid/20' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`} 
                                  disabled={isDisabled}
                                  onClick={() => handleUpdateStatus(j.jamaah_id, 'Ijin')}
                                >
                                  Ijin
                                </button>
                                <button 
                                  className={`flex-1 text-center py-1.5 text-[9px] font-extrabold uppercase rounded-md transition-all focus:outline-none ${
                                    currentStatus === 'Tidak Hadir' 
                                      ? 'bg-pastel-red-solid text-white shadow-sm shadow-pastel-red-solid/20' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`} 
                                  disabled={isDisabled}
                                  onClick={() => handleUpdateStatus(j.jamaah_id, 'Tidak Hadir')}
                                >
                                  Absen
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-slate-100 bg-white">
                {filteredInputList.map(j => {
                  const isDisabled = !j.can_edit || (isBackdate && !attendanceTime);
                  const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
                  const currentStatus = attendanceDraft[j.jamaah_id] || 'Tidak Hadir';
                  
                  return (
                    <div key={j.jamaah_id} className="p-4 flex flex-col gap-3.5 hover:bg-slate-50/30 transition-colors">
                      {/* Name & Badges */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm font-bold text-slate-800 truncate">{j.nama_lengkap}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {j.desa} &bull; {j.kelompok}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200/50 font-bold text-[9px] uppercase">
                            {j.kategori}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200/50 font-bold text-[9px]">
                            {j.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}
                          </span>
                        </div>
                      </div>

                      {/* Attendance Buttons */}
                      <div className="flex justify-center w-full">
                        <div className={`flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 w-full ${disabledClass}`}>
                          <button 
                            className={`flex-1 text-center py-2 text-[10px] font-extrabold uppercase rounded-lg transition-all focus:outline-none ${
                              currentStatus === 'Hadir' 
                                ? 'bg-pastel-green-solid text-white shadow-sm shadow-pastel-green-solid/20' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`} 
                            disabled={isDisabled}
                            onClick={() => handleUpdateStatus(j.jamaah_id, 'Hadir')}
                          >
                            Hadir
                          </button>
                          <button 
                            className={`flex-1 text-center py-2 text-[10px] font-extrabold uppercase rounded-lg transition-all focus:outline-none ${
                              currentStatus === 'Ijin' 
                                ? 'bg-pastel-yellow-solid text-pastel-yellow-text shadow-sm shadow-pastel-yellow-solid/20' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`} 
                            disabled={isDisabled}
                            onClick={() => handleUpdateStatus(j.jamaah_id, 'Ijin')}
                          >
                            Ijin
                          </button>
                          <button 
                            className={`flex-1 text-center py-2 text-[10px] font-extrabold uppercase rounded-lg transition-all focus:outline-none ${
                              currentStatus === 'Tidak Hadir' 
                                ? 'bg-pastel-red-solid text-white shadow-sm shadow-pastel-red-solid/20' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`} 
                            disabled={isDisabled}
                            onClick={() => handleUpdateStatus(j.jamaah_id, 'Tidak Hadir')}
                          >
                            Absen
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================= TAB LAPORAN ================================================= */}
      {activeTab === 'laporan' && (
        <div className="flex flex-col gap-6">
          {/* Laporan Filter Bar */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="uppercase tracking-wider">Mulai:</span>
              <input 
                type="date" 
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs" 
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="uppercase tracking-wider">Selesai:</span>
              <input 
                type="date" 
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs" 
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
              />
            </div>

            {/* Filter Desa */}
            {user.role === 'Super Admin' ? (
              <select 
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs cursor-pointer"
                value={reportDesa}
                onChange={(e) => setReportDesa(e.target.value)}
              >
                <option value="">Semua Desa</option>
                <option value="Andara">Andara</option>
                <option value="Bojong">Bojong</option>
                <option value="Cisadane">Cisadane</option>
              </select>
            ) : null}

            {/* Filter Kelompok */}
            {user.role === 'Super Admin' || user.role === 'Admin' ? (
              <select 
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs cursor-pointer"
                value={reportKelompok}
                onChange={(e) => setReportKelompok(e.target.value)}
              >
                <option value="">Semua Kelompok</option>
                <option value="Andara 1">Andara 1</option>
                <option value="Andara 2">Andara 2</option>
                <option value="Andara 3">Andara 3</option>
                <option value="Andara 4">Andara 4</option>
                <option value="Andara 5">Andara 5</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            ) : null}

            <button 
              onClick={loadReport} 
              className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg transition-all shadow-sm active:scale-95 ml-auto"
              disabled={loadingReport}
            >
              {loadingReport ? "Memuat..." : "Tampilkan Laporan"}
            </button>
          </div>

          {loadingReport ? (
            <div className="flex justify-center py-12">
              <div className="spinner"></div>
            </div>
          ) : reportData ? (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Aggregated Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-slate-800">{reportData.totalSessions} Hari</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Pengajian</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pastel-green text-pastel-green-text flex items-center justify-center shrink-0">
                    <CheckCircle size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-pastel-green-text">
                      {reportData.stats.total > 0 ? Math.round((reportData.stats.hadir / reportData.stats.total) * 100) : 0}%
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Tingkat Kehadiran</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pastel-yellow text-pastel-yellow-text flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-pastel-yellow-text">{reportData.stats.ijin} Kali</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jumlah Ijin</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pastel-red text-pastel-red-text flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-pastel-red-text">{reportData.stats.tidak_hadir} Kali</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jumlah Absen</span>
                  </div>
                </div>
              </div>

              {/* Group Distribution */}
              {reportData.distribusiKelompok.length > 0 && (
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Per Kelompok</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 text-center">
                    {reportData.distribusiKelompok.map(g => {
                      const pct = g.total > 0 ? Math.round((g.hadir / g.total) * 100) : 0;
                      return (
                        <div key={g.kelompok} className="border border-slate-50 rounded-xl p-3 bg-slate-50/20">
                          <span className="text-[10px] font-extrabold text-slate-700 block mb-1 truncate">{g.kelompok}</span>
                          <span className="text-base font-bold text-primary block">{pct}%</span>
                          <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mt-1">({g.hadir} dari {g.total})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Jamaah Report Table */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-800">Rekapitulasi Kehadiran Jamaah</h3>
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold transition-all"
                  >
                    <Download size={13} />
                    <span>Cetak PDF</span>
                  </button>
                </div>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Nama Lengkap</th>
                        <th className="px-6 py-4">Desa</th>
                        <th className="px-6 py-4">Kelompok</th>
                        <th className="px-6 py-4">Gender</th>
                        <th className="px-6 py-4 text-center">Hadir</th>
                        <th className="px-6 py-4 text-center">Ijin</th>
                        <th className="px-6 py-4 text-center">Absen</th>
                        <th className="px-6 py-4 text-center">Rasio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reportData.rekapJamaah.map(rj => {
                        const totalActive = rj.hadir + rj.ijin + rj.tidak_hadir;
                        const ratio = totalActive > 0 ? Math.round((rj.hadir / totalActive) * 100) : 0;
                        return (
                          <tr key={rj.jamaah_id} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                            <td className="px-6 py-4 font-bold text-slate-800">{rj.nama_lengkap}</td>
                            <td className="px-6 py-4 text-slate-500">{rj.desa}</td>
                            <td className="px-6 py-4">
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-605 font-bold text-[9px]">
                                {rj.kelompok}
                              </span>
                            </td>
                            <td className="px-6 py-4">{rj.jenis_kelamin}</td>
                            <td className="px-6 py-4 text-center font-bold text-pastel-green-text">{rj.hadir}x</td>
                            <td className="px-6 py-4 text-center font-bold text-pastel-yellow-text">{rj.ijin}x</td>
                            <td className="px-6 py-4 text-center font-bold text-pastel-red-text">{rj.tidak_hadir}x</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full font-extrabold text-[9px] ${
                                ratio >= 75 ? 'bg-pastel-green text-pastel-green-text' : 
                                ratio >= 50 ? 'bg-pastel-yellow text-pastel-yellow-text' : 
                                'bg-pastel-red text-pastel-red-text'
                              }`}>
                                {ratio}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Report Card List */}
                <div className="block md:hidden divide-y divide-slate-100 bg-white">
                  {reportData.rekapJamaah.map(rj => {
                    const totalActive = rj.hadir + rj.ijin + rj.tidak_hadir;
                    const ratio = totalActive > 0 ? Math.round((rj.hadir / totalActive) * 100) : 0;
                    return (
                      <div key={rj.jamaah_id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/30 transition-colors">
                        {/* Name & Ratio */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-bold text-slate-800 truncate">{rj.nama_lengkap}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {rj.desa} &bull; {rj.kelompok}
                            </span>
                          </div>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold text-[10px] shrink-0 ${
                            ratio >= 75 ? 'bg-pastel-green text-pastel-green-text' : 
                            ratio >= 50 ? 'bg-pastel-yellow text-pastel-yellow-text' : 
                            'bg-pastel-red text-pastel-red-text'
                          }`}>
                            Rasio: {ratio}%
                          </span>
                        </div>

                        {/* Counts row */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100 text-center">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Hadir</span>
                            <span className="text-xs font-black text-pastel-green-text">{rj.hadir}x</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Ijin</span>
                            <span className="text-xs font-black text-pastel-yellow-text">{rj.ijin}x</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Absen</span>
                            <span className="text-xs font-black text-pastel-red-text">{rj.tidak_hadir}x</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Calendar size={44} className="opacity-40 mb-4" />
              <p className="font-bold text-sm">Tentukan filter rentang tanggal di atas lalu klik Tampilkan Laporan.</p>
            </div>
          )}
        </div>
      )}

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
