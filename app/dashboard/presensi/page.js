"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Search, Users, CheckCircle, AlertTriangle, Info, Clock, Download, RefreshCw, Trash2, X } from 'lucide-react';

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
  const [initialDraftState, setInitialDraftState] = useState({});
  const [locations, setLocations] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  // Input Filters
  const [searchName, setSearchName] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterKategori, setFilterKategori] = useState(['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia']);
  const [inputStatusPernikahan, setInputStatusPernikahan] = useState(['Belum Menikah', 'Menikah', 'Janda', 'Duda']);

  // Laporan Tab States
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportStartTime, setReportStartTime] = useState('00:00');
  const [reportEndTime, setReportEndTime] = useState('23:59');
  const [reportKategori, setReportKategori] = useState(['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia']);
  const [reportStatusPernikahan, setReportStatusPernikahan] = useState(['Belum Menikah', 'Menikah', 'Janda', 'Duda']);
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

      if (!currentUser.can_read_kehadiran && !currentUser.can_create_kehadiran && !currentUser.can_update_kehadiran && !currentUser.can_delete_kehadiran && !currentUser.can_read_laporan) {
        showToast("Akses Ditolak: Anda tidak memiliki wewenang presensi", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      if (!currentUser.can_read_kehadiran && !currentUser.can_create_kehadiran && !currentUser.can_update_kehadiran && !currentUser.can_delete_kehadiran && currentUser.can_read_laporan) {
        setActiveTab('laporan');
      }

      const lokasiRes = await fetch('/api/lokasi');
      if (lokasiRes.ok) {
        setLocations(await lokasiRes.json());
      }

      // Default filters berdasarkan monitored locations
      if (!currentUser.monitor_all_desas && currentUser.desas_pantau && currentUser.desas_pantau.length > 0) {
        setFilterDesa(currentUser.desas_pantau[0]);
        setReportDesa(currentUser.desas_pantau[0]);
      } else if (currentUser.role === 'Admin') {
        setFilterDesa(currentUser.desa);
        setReportDesa(currentUser.desa);
      }
      
      if (!currentUser.monitor_all_kelompoks && currentUser.kelompoks_pantau && currentUser.kelompoks_pantau.length > 0) {
        setFilterKelompok(currentUser.kelompoks_pantau[0]);
        setReportKelompok(currentUser.kelompoks_pantau[0]);
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

  // 2. Load Data Kehadiran ketika Tanggal berubah (Struktur Sesi nested)
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
        if (j.presences && j.presences.length > 0) {
          j.presences.forEach(p => {
            initialDraft[p.kehadiran_id] = {
              kehadiran_id: p.kehadiran_id,
              jamaah_id: j.jamaah_id,
              status: p.status,
              waktu_presensi: p.waktu_presensi,
              recorded_by: p.recorded_by,
              isDeleted: false
            };
          });
        } else {
          // Add default standby row
          const standbyKey = `${j.jamaah_id}_standby`;
          initialDraft[standbyKey] = {
            kehadiran_id: null,
            jamaah_id: j.jamaah_id,
            status: 'Tidak Hadir',
            waktu_presensi: null,
            recorded_by: null,
            isDeleted: false
          };
        }
      });
      setAttendanceDraft(initialDraft);
      setInitialDraftState(JSON.parse(JSON.stringify(initialDraft)));
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

  // 3. Update Status Kehadiran secara Lokal di Draf (Mendukung Waktu Manual)
  const handleUpdateStatus = (rowKey, status, jamaahId) => {
    setAttendanceDraft(prev => {
      const current = prev[rowKey] || {
        kehadiran_id: (rowKey.endsWith('_standby') || rowKey.includes('_new_')) ? null : rowKey,
        jamaah_id: jamaahId,
        status: 'Tidak Hadir',
        waktu_presensi: null
      };
      
      let waktu = current.waktu_presensi;
      if (status === 'Hadir') {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        if (isBackdate) {
          const timeVal = attendanceTime || `${pad(now.getHours())}:${pad(now.getMinutes())}`;
          waktu = `${selectedDate} ${timeVal}:00`;
        } else {
          waktu = `${selectedDate} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        }
      } else {
        waktu = null;
      }
      
      return {
        ...prev,
        [rowKey]: {
          ...current,
          status,
          waktu_presensi: waktu
        }
      };
    });
  };

  // Tambah Sesi Kehadiran Baru untuk Jamaah
  const handleAddNewPresence = (jamaahId) => {
    const newKey = `${jamaahId}_new_${Date.now()}`;
    setAttendanceDraft(prev => ({
      ...prev,
      [newKey]: {
        kehadiran_id: null,
        jamaah_id: jamaahId,
        status: 'Tidak Hadir',
        waktu_presensi: null,
        recorded_by: user.email,
        isDeleted: false
      }
    }));
  };

  // Hapus Draft Sesi Tambahan
  const handleRemoveDraftRow = (rowKey) => {
    setAttendanceDraft(prev => {
      const copy = { ...prev };
      delete copy[rowKey];
      return copy;
    });
  };

  // Hapus atau reset baris kehadiran
  const handleDeletePresenceRow = (rowKey, jamaahId) => {
    setAttendanceDraft(prev => {
      const copy = { ...prev };
      
      // Hitung baris aktif (non-deleted) untuk jamaah ini
      const activeEntries = Object.entries(copy).filter(
        ([key, val]) => val.jamaah_id === jamaahId && !val.isDeleted
      );
      
      if (activeEntries.length > 1) {
        // Jika lebih dari 1 sesi aktif, hapus dari list
        const draftItem = copy[rowKey];
        if (draftItem.kehadiran_id === null) {
          // Jika baru di draft, hapus saja kuncinya
          delete copy[rowKey];
        } else {
          // Jika sudah ada di database, set status Absen dan flag isDeleted agar hilang di UI dan di-delete oleh backend saat Simpan
          copy[rowKey] = {
            ...draftItem,
            status: 'Tidak Hadir',
            waktu_presensi: null,
            isDeleted: true
          };
        }
      } else {
        // Jika hanya 1 sesi aktif, ubah fungsi menjadi reset (Absen & waktu kosong)
        copy[rowKey] = {
          ...copy[rowKey],
          status: 'Tidak Hadir',
          waktu_presensi: null
        };
      }
      
      return copy;
    });
  };

  // 3b. Submit Bulk Kehadiran ke Database (Mendukung Multi-Sesi)
  const handleSubmitAttendance = async () => {
    if (isBackdate && !attendanceTime) {
      showToast("Gagal: Anda harus mengisi jam & menit untuk pengisian tanggal lampau (backdate)", "error");
      return;
    }

    setLoadingSubmit(true);

    const kehadiranPayload = Object.keys(attendanceDraft)
      .filter(rowKey => {
        const current = attendanceDraft[rowKey];
        const initial = initialDraftState[rowKey];
        // If it didn't exist initially and status is still 'Tidak Hadir', no need to send it
        if (!initial && current.status === 'Tidak Hadir') return false;
        // If it did exist initially and isDeleted is true, we need to send it to trigger DELETE
        if (initial && current.isDeleted) return true;
        // If it didn't exist initially and status is not 'Tidak Hadir', we need to send it to trigger INSERT
        if (!initial && current.status !== 'Tidak Hadir') return true;
        // If it did exist initially, compare status, waktu_presensi, or isDeleted
        if (initial) {
          return current.status !== initial.status || current.waktu_presensi !== initial.waktu_presensi || current.isDeleted !== initial.isDeleted;
        }
        return false;
      })
      .map(rowKey => {
        const draftItem = attendanceDraft[rowKey];
        return {
          id: draftItem.kehadiran_id || null,
          jamaah_id: draftItem.jamaah_id,
          status: draftItem.status,
          waktu_presensi: draftItem.waktu_presensi
        };
      });

    try {
      const res = await fetch('/api/kehadiran', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: selectedDate,
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

  // 4. Load Laporan Kehadiran (Mendukung Rentang Waktu dan Checkbox Kategori/Pernikahan)
  const loadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      showToast("Mulai dan selesai wajib diisi", "error");
      return;
    }
    setLoadingReport(true);

    const startDateTime = `${reportStartDate} ${reportStartTime || '00:00'}:00`;
    const endDateTime = `${reportEndDate} ${reportEndTime || '23:59'}:59`;
    const kategoriParam = reportKategori.join(',');
    const maritalParam = reportStatusPernikahan.join(',');

    try {
      const res = await fetch(`/api/kehadiran/laporan?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&desa=${reportDesa}&kelompok=${reportKelompok}&kategori=${encodeURIComponent(kategoriParam)}&status_pernikahan=${encodeURIComponent(maritalParam)}`);
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
    const matchKategori = filterKategori.includes(j.kategori);
    const matchStatusPernikahan = inputStatusPernikahan.includes(j.status_pernikahan || 'Belum Menikah');
    return matchName && matchDesa && matchKelompok && matchGender && matchKategori && matchStatusPernikahan;
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
            {user.monitor_all_desas && user.monitor_all_kelompoks
              ? 'Akses Terpantau: Seluruh Desa & Kelompok'
              : `Akses Terpantau: ` +
                `Desa: ${user.monitor_all_desas ? 'Semua Desa' : (user.desas_pantau && user.desas_pantau.length > 0 ? user.desas_pantau.join(', ') : 'Tidak ada')}, ` +
                `Kelompok: ${user.monitor_all_kelompoks ? 'Semua Kelompok' : (user.kelompoks_pantau && user.kelompoks_pantau.length > 0 ? user.kelompoks_pantau.join(', ') : 'Tidak ada')}`
            }
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-100 mb-6 gap-6">
        {(user.can_read_kehadiran || user.can_create_kehadiran || user.can_update_kehadiran || user.can_delete_kehadiran) && (
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
        )}
        {user.can_read_laporan && (
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
        )}
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
              {user.can_delete_kehadiran && jamaahList.some(j => j.presences && j.presences.length > 0) && (
                <button
                  onClick={handleDeleteAttendance}
                  disabled={loadingSubmit}
                  className={`py-2 px-4 rounded-lg bg-pastel-red hover:bg-pastel-red-solid/30 text-pastel-red-text font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${loadingSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Trash2 size={14} />
                  <span>Hapus Presensi</span>
                </button>
              )}
              {(user.can_create_kehadiran || user.can_update_kehadiran) && (
                <button
                  onClick={handleSubmitAttendance}
                  disabled={loadingSubmit || (isBackdate && !attendanceTime)}
                  className={`py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${(loadingSubmit || (isBackdate && !attendanceTime)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <CheckCircle size={14} className={loadingSubmit ? "animate-spin" : ""} />
                  <span>{loadingSubmit ? "Menyimpan..." : "Simpan Kehadiran"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Saringan Pencarian & Filter */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3.5">
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
                {user.monitor_all_desas ? (
                  <select 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterDesa}
                    onChange={(e) => {
                      setFilterDesa(e.target.value);
                      setFilterKelompok('');
                    }}
                  >
                    <option value="">Semua Desa</option>
                    {[...locations].sort((a, b) => a.nama_desa.localeCompare(b.nama_desa)).map(d => (
                      <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                    ))}
                  </select>
                ) : (
                  <select 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterDesa}
                    onChange={(e) => {
                      setFilterDesa(e.target.value);
                      setFilterKelompok('');
                    }}
                  >
                    <option value="">Semua Desa Terpantau</option>
                    {[...locations].filter(d => (user.desas_pantau || []).includes(d.nama_desa)).sort((a, b) => a.nama_desa.localeCompare(b.nama_desa)).map(d => (
                      <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                    ))}
                  </select>
                )}

                {/* Filter Kelompok */}
                {user.monitor_all_kelompoks ? (
                  <select 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterKelompok}
                    onChange={(e) => setFilterKelompok(e.target.value)}
                  >
                    <option value="">Semua Kelompok</option>
                    {(filterDesa 
                      ? (locations.find(d => d.nama_desa === filterDesa)?.kelompoks || []) 
                      : locations.flatMap(d => d.kelompoks)
                    )
                    .sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
                    .map(k => (
                      <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                    ))}
                  </select>
                ) : (
                  <select 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterKelompok}
                    onChange={(e) => setFilterKelompok(e.target.value)}
                  >
                    <option value="">Semua Kelompok Terpantau</option>
                    {(filterDesa 
                      ? (locations.find(d => d.nama_desa === filterDesa)?.kelompoks || []) 
                      : locations.flatMap(d => d.kelompoks)
                    )
                    .filter(k => (user.kelompoks_pantau || []).includes(k.nama_kelompok))
                    .sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
                    .map(k => (
                      <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                    ))}
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
              </div>
            </div>

            {/* Checklist Kategori Jamaah */}
            <div className="border-t border-slate-100 pt-3 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Kategori Jamaah</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'].map(cat => {
                  const isChecked = filterKategori.includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setFilterKategori(prev => prev.filter(c => c !== cat));
                          } else {
                            setFilterKategori(prev => [...prev, cat]);
                          }
                        }}
                      />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checklist Status Pernikahan */}
            <div className="border-t border-slate-100 pt-3 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status Pernikahan</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {['Belum Menikah', 'Menikah', 'Janda', 'Duda'].map(status => {
                  const isChecked = inputStatusPernikahan.includes(status);
                  return (
                    <label key={status} className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setInputStatusPernikahan(prev => prev.filter(s => s !== status));
                          } else {
                            setInputStatusPernikahan(prev => [...prev, status]);
                          }
                        }}
                      />
                      <span>{status}</span>
                    </label>
                  );
                })}
              </div>
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
                      <th className="px-6 py-4 text-center" style={{ width: '340px' }}>Status Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInputList.map(j => {
                      const draftEntries = Object.entries(attendanceDraft).filter(([key, val]) => val.jamaah_id === j.jamaah_id && !val.isDeleted);
                      const isMultiSession = draftEntries.length > 1;
                      
                      return (
                        <tr key={j.jamaah_id} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                          <td className="px-6 py-4.5 font-bold text-slate-800">
                            <div>{j.nama_lengkap}</div>
                          </td>
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
                            <div className="flex flex-col gap-2.5 my-1">
                              {draftEntries.map(([rowKey, draftItem]) => {
                                const isDisabled = !j.can_edit || (isBackdate && !attendanceTime) || (!user.can_create_kehadiran && !user.can_update_kehadiran);
                                const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
                                const currentStatus = draftItem.status;
                                const waktuPresensi = draftItem.waktu_presensi;
                                
                                return (
                                  <div key={rowKey} className="flex items-center gap-2 justify-center">
                                    {/* 3-State Toggle Group */}
                                    <div className={`flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 w-[240px] ${disabledClass}`}>
                                      <button 
                                        className={`flex-1 text-center py-1.5 text-[9px] font-extrabold uppercase rounded-md transition-all focus:outline-none ${
                                          currentStatus === 'Hadir' 
                                            ? 'bg-pastel-green-solid text-white shadow-sm shadow-pastel-green-solid/20' 
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`} 
                                        disabled={isDisabled}
                                        onClick={() => handleUpdateStatus(rowKey, 'Hadir', j.jamaah_id)}
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
                                        onClick={() => handleUpdateStatus(rowKey, 'Ijin', j.jamaah_id)}
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
                                        onClick={() => handleUpdateStatus(rowKey, 'Tidak Hadir', j.jamaah_id)}
                                      >
                                        Absen
                                      </button>
                                    </div>

                                    {/* Timestamp */}
                                    {waktuPresensi && (
                                      <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded border border-slate-100 flex items-center gap-1 shrink-0" title={`Pencatat: ${draftItem.recorded_by || '-'}`}>
                                        <Clock size={10} />
                                        <span>{(waktuPresensi.split(' ')[1] || waktuPresensi).substring(0, 5)}</span>
                                      </span>
                                    )}

                                    {/* Delete / Reset Button */}
                                    {j.can_edit && (user.can_create_kehadiran || user.can_update_kehadiran) && (
                                      isMultiSession ? (
                                        <button 
                                          onClick={() => handleDeletePresenceRow(rowKey, j.jamaah_id)}
                                          className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer shrink-0"
                                          title="Hapus Sesi Kehadiran Ini"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      ) : (
                                        <button 
                                          onClick={() => handleDeletePresenceRow(rowKey, j.jamaah_id)}
                                          className="p-1 rounded text-slate-400 hover:bg-slate-50 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
                                          title="Reset Kehadiran Menjadi Absen"
                                        >
                                          <RefreshCw size={12} />
                                        </button>
                                      )
                                    )}
                                  </div>
                                );
                              })}
                              
                              {/* Tambah Kehadiran Button */}
                              {j.can_edit && (user.can_create_kehadiran || user.can_update_kehadiran) && (
                                <button 
                                  onClick={() => handleAddNewPresence(j.jamaah_id)}
                                  className="self-center text-[9px] font-extrabold uppercase text-primary hover:text-primary-hover flex items-center gap-1 mt-1 transition-colors cursor-pointer"
                                >
                                  + Tambah Kehadiran
                                </button>
                              )}
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
                  const draftEntries = Object.entries(attendanceDraft).filter(([key, val]) => val.jamaah_id === j.jamaah_id && !val.isDeleted);
                  const isMultiSession = draftEntries.length > 1;
                  
                  return (
                    <div key={j.jamaah_id} className="p-4 flex flex-col gap-3.5 hover:bg-slate-50/30 transition-colors">
                      {/* Name & Badges */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {j.nama_lengkap}
                          </span>
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

                      {/* Attendance Buttons Stack */}
                      <div className="flex flex-col gap-3 w-full">
                        {draftEntries.map(([rowKey, draftItem]) => {
                          const isDisabled = !j.can_edit || (isBackdate && !attendanceTime) || (!user.can_create_kehadiran && !user.can_update_kehadiran);
                          const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
                          const currentStatus = draftItem.status;
                          const waktuPresensi = draftItem.waktu_presensi;
                          
                          return (
                            <div key={rowKey} className="flex flex-col gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                <span>
                                  {waktuPresensi ? (
                                    <span className="flex items-center gap-1 text-slate-500 font-bold">
                                      <Clock size={10} />
                                      <span>Tercatat: {(waktuPresensi.split(' ')[1] || waktuPresensi).substring(0, 5)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-primary/80 font-bold">SESI BARU (STANDBY)</span>
                                  )}
                                </span>
                                {j.can_edit && (user.can_create_kehadiran || user.can_update_kehadiran) && (
                                  isMultiSession ? (
                                    <button 
                                      onClick={() => handleDeletePresenceRow(rowKey, j.jamaah_id)}
                                      className="text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider font-extrabold cursor-pointer"
                                    >
                                      Hapus Sesi
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => handleDeletePresenceRow(rowKey, j.jamaah_id)}
                                      className="text-slate-400 hover:text-amber-600 transition-colors uppercase tracking-wider font-extrabold cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  )
                                )}
                              </div>
                              <div className={`flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 w-full ${disabledClass}`}>
                                <button 
                                  className={`flex-1 text-center py-2 text-[10px] font-extrabold uppercase rounded-lg transition-all focus:outline-none ${
                                    currentStatus === 'Hadir' 
                                      ? 'bg-pastel-green-solid text-white shadow-sm shadow-pastel-green-solid/20' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`} 
                                  disabled={isDisabled}
                                  onClick={() => handleUpdateStatus(rowKey, 'Hadir', j.jamaah_id)}
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
                                  onClick={() => handleUpdateStatus(rowKey, 'Ijin', j.jamaah_id)}
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
                                  onClick={() => handleUpdateStatus(rowKey, 'Tidak Hadir', j.jamaah_id)}
                                >
                                  Absen
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Tambah Kehadiran Button */}
                        {j.can_edit && (user.can_create_kehadiran || user.can_update_kehadiran) && (
                          <button 
                            onClick={() => handleAddNewPresence(j.jamaah_id)}
                            className="w-full py-2 bg-slate-50 border border-dashed border-slate-205 text-primary hover:bg-primary-light hover:border-primary font-bold text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            + Tambah Kehadiran
                          </button>
                        )}
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
      {activeTab === 'laporan' && user.can_read_laporan && (
        <div className="flex flex-col gap-6">
          {/* Laporan Filter Bar */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="uppercase tracking-wider">Mulai:</span>
                <input 
                  type="date" 
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs" 
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
                <input 
                  type="time" 
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs cursor-pointer" 
                  value={reportStartTime}
                  onChange={(e) => setReportStartTime(e.target.value)}
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
                <input 
                  type="time" 
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs cursor-pointer" 
                  value={reportEndTime}
                  onChange={(e) => setReportEndTime(e.target.value)}
                />
              </div>

              {/* Filter Desa */}
              {user.monitor_all_desas ? (
                <select 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs cursor-pointer"
                  value={reportDesa}
                  onChange={(e) => {
                    setReportDesa(e.target.value);
                    setReportKelompok('');
                  }}
                >
                  <option value="">Semua Desa</option>
                  {[...locations].sort((a, b) => a.nama_desa.localeCompare(b.nama_desa)).map(d => (
                    <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                  ))}
                </select>
              ) : (
                <select 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs cursor-pointer"
                  value={reportDesa}
                  onChange={(e) => {
                    setReportDesa(e.target.value);
                    setReportKelompok('');
                  }}
                >
                  <option value="">Semua Desa Terpantau</option>
                  {[...locations].filter(d => (user.desas_pantau || []).includes(d.nama_desa)).sort((a, b) => a.nama_desa.localeCompare(b.nama_desa)).map(d => (
                    <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                  ))}
                </select>
              )}

              {/* Filter Kelompok */}
              {user.monitor_all_kelompoks ? (
                <select 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs cursor-pointer"
                  value={reportKelompok}
                  onChange={(e) => setReportKelompok(e.target.value)}
                >
                  <option value="">Semua Kelompok</option>
                  {(reportDesa 
                    ? (locations.find(d => d.nama_desa === reportDesa)?.kelompoks || []) 
                    : locations.flatMap(d => d.kelompoks)
                  )
                  .sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
                  .map(k => (
                    <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                  ))}
                </select>
              ) : (
                <select 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-xs cursor-pointer"
                  value={reportKelompok}
                  onChange={(e) => setReportKelompok(e.target.value)}
                >
                  <option value="">Semua Kelompok Terpantau</option>
                  {(reportDesa 
                    ? (locations.find(d => d.nama_desa === reportDesa)?.kelompoks || []) 
                    : locations.flatMap(d => d.kelompoks)
                  )
                  .filter(k => (user.kelompoks_pantau || []).includes(k.nama_kelompok))
                  .sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
                  .map(k => (
                    <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                  ))}
                </select>
              )}

              <button 
                onClick={loadReport} 
                className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg transition-all shadow-sm active:scale-95 ml-auto"
                disabled={loadingReport}
              >
                {loadingReport ? "Memuat..." : "Tampilkan Laporan"}
              </button>
            </div>

            {/* Checklist Filters Row */}
            <div className="flex flex-col sm:flex-row gap-6 border-t border-slate-100 pt-4 text-left">
              {/* Kategori Checklist */}
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Kategori Jamaah</span>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'].map(cat => {
                    const isChecked = reportKategori.includes(cat);
                    return (
                      <label key={cat} className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setReportKategori(prev => prev.filter(c => c !== cat));
                            } else {
                              setReportKategori(prev => [...prev, cat]);
                            }
                          }}
                        />
                        <span>{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Pernikahan Checklist */}
              <div className="flex-1 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status Pernikahan</span>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {['Belum Menikah', 'Menikah', 'Janda', 'Duda'].map(status => {
                    const isChecked = reportStatusPernikahan.includes(status);
                    return (
                      <label key={status} className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setReportStatusPernikahan(prev => prev.filter(s => s !== status));
                            } else {
                              setReportStatusPernikahan(prev => [...prev, status]);
                            }
                          }}
                        />
                        <span>{status}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
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
                    <span className="text-xl font-bold text-pastel-yellow-text">{reportData.stats.ijin}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jumlah Ijin</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pastel-red text-pastel-red-text flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-pastel-red-text">{reportData.stats.tidak_hadir}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jumlah Absen</span>
                  </div>
                </div>
              </div>

              {/* Demographic Distributions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                {/* Gender Distribution */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Jenis Kelamin</h3>
                  <div className="flex flex-col gap-4 text-xs font-semibold">
                    <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 rounded-lg">
                      <div className="font-bold text-pastel-green-text mb-1">Hadir</div>
                      <div className="flex justify-between text-slate-600">
                        <span>Laki-laki: <strong>{reportData.stats.distribusiGender?.Hadir?.Laki || 0}</strong></span>
                        <span>Perempuan: <strong>{reportData.stats.distribusiGender?.Hadir?.Perempuan || 0}</strong></span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 rounded-lg">
                      <div className="font-bold text-pastel-yellow-text mb-1">Ijin</div>
                      <div className="flex justify-between text-slate-600">
                        <span>Laki-laki: <strong>{reportData.stats.distribusiGender?.Ijin?.Laki || 0}</strong></span>
                        <span>Perempuan: <strong>{reportData.stats.distribusiGender?.Ijin?.Perempuan || 0}</strong></span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 rounded-lg">
                      <div className="font-bold text-pastel-red-text mb-1">Absen</div>
                      <div className="flex justify-between text-slate-600">
                        <span>Laki-laki: <strong>{reportData.stats.distribusiGender?.TidakHadir?.Laki || 0}</strong></span>
                        <span>Perempuan: <strong>{reportData.stats.distribusiGender?.TidakHadir?.Perempuan || 0}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kategori Distribution */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Kategori Usia</h3>
                  <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {['Hadir', 'Ijin', 'TidakHadir'].map(statusKey => {
                      const label = statusKey === 'TidakHadir' ? 'Absen' : statusKey;
                      const colorClass = statusKey === 'Hadir' ? 'text-pastel-green-text' : statusKey === 'Ijin' ? 'text-pastel-yellow-text' : 'text-pastel-red-text';
                      const catData = reportData.stats.distribusiKategori?.[statusKey] || {};
                      const entries = Object.entries(catData);
                      
                      return (
                        <div key={statusKey} className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 rounded-lg text-xs font-semibold">
                          <div className={`font-bold ${colorClass} mb-1`}>{label}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600 text-[10px]">
                            {entries.length > 0 ? (
                              entries.map(([catName, count]) => (
                                <span key={catName}>{catName}: <strong>{count}</strong></span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Tidak ada data</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Pernikahan Distribution */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Status Pernikahan</h3>
                  <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {['Hadir', 'Ijin', 'TidakHadir'].map(statusKey => {
                      const label = statusKey === 'TidakHadir' ? 'Absen' : statusKey;
                      const colorClass = statusKey === 'Hadir' ? 'text-pastel-green-text' : statusKey === 'Ijin' ? 'text-pastel-yellow-text' : 'text-pastel-red-text';
                      const marData = reportData.stats.distribusiStatusPernikahan?.[statusKey] || {};
                      const entries = Object.entries(marData);
                      
                      return (
                        <div key={statusKey} className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 rounded-lg text-xs font-semibold">
                          <div className={`font-bold ${colorClass} mb-1`}>{label}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600 text-[10px]">
                            {entries.length > 0 ? (
                              entries.map(([marName, count]) => (
                                <span key={marName}>{marName}: <strong>{count}</strong></span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Tidak ada data</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
