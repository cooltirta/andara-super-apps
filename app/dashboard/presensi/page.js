"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Search, Users, CheckCircle, AlertTriangle, Info, Clock, Download, RefreshCw, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Edit2, ArrowLeft } from 'lucide-react';

export default function PresensiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('sesi'); // 'input', 'laporan', or 'sesi'

  // Sesi Tab States
  const [sessions, setSessions] = useState([]);
  const [filterSesiYear, setFilterSesiYear] = useState(() => new Date().getFullYear().toString());
  const [filterSesiMonth, setFilterSesiMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showCreateSesiModal, setShowCreateSesiModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  
  // Create Sesi Modal Form Fields
  const [newSesiDate, setNewSesiDate] = useState('');
  const [newSesiStart, setNewSesiStart] = useState('08:00');
  const [newSesiEnd, setNewSesiEnd] = useState('10:00');
  const [newSesiType, setNewSesiType] = useState('Kelompok');
  const [newSesiDesas, setNewSesiDesas] = useState([]);
  const [newSesiKelompoks, setNewSesiKelompoks] = useState([]);
  const [newSesiGenders, setNewSesiGenders] = useState(['Laki-laki', 'Perempuan']);
  const [newSesiMarital, setNewSesiMarital] = useState(['Belum Menikah', 'Menikah', 'Janda/Duda']);
  const [newSesiKategoris, setNewSesiKategoris] = useState(['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia']);

  // Sync Sesi States
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncingSession, setSyncingSession] = useState(null);
  const [syncSchedules, setSyncSchedules] = useState([]);
  const [selectedSyncSchedule, setSelectedSyncSchedule] = useState('');
  const [loadingSyncSchedules, setLoadingSyncSchedules] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
  const [filterDesas, setFilterDesas] = useState([]);
  const [filterKelompoks, setFilterKelompoks] = useState([]);
  const [filterGenders, setFilterGenders] = useState(['Laki-laki', 'Perempuan']);
  const [filterPresenceStatus, setFilterPresenceStatus] = useState('');
  const [filterKategori, setFilterKategori] = useState(['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia']);
  const [inputStatusPernikahan, setInputStatusPernikahan] = useState(['Belum Menikah', 'Menikah', 'Janda/Duda']);

  // Laporan Tab States
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportDesas, setReportDesas] = useState([]);
  const [reportKelompoks, setReportKelompoks] = useState([]);
  const [reportGenders, setReportGenders] = useState(['Laki-laki', 'Perempuan']);
  const [reportStatusPernikahan, setReportStatusPernikahan] = useState(['Belum Menikah', 'Menikah', 'Janda/Duda']);
  const [reportKategori, setReportKategori] = useState(['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia']);
  const [selectedReportSessionIds, setSelectedReportSessionIds] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showReportFilters, setShowReportFilters] = useState(true);

  // Helper to filter marital status based on gender and kategori selection
  const getAvailableMaritalStatuses = (selectedGenders, selectedKategoris) => {
    const adultKats = ['Dewasa', 'Lansia'];
    const hasAdultsSelected = selectedKategoris.some(k => adultKats.includes(k));
    const hasNonAdultsSelected = selectedKategoris.some(k => !adultKats.includes(k));

    // If ONLY non-adults are selected, only 'Belum Menikah' is allowed
    if (selectedKategoris.length > 0 && hasNonAdultsSelected && !hasAdultsSelected) {
      return ['Belum Menikah'];
    }

    return ['Belum Menikah', 'Menikah', 'Janda/Duda'];
  };

  const getAvailableKategoris = (selectedStatuses) => {
    const hasBelumMenikah = selectedStatuses.includes('Belum Menikah');
    if (selectedStatuses.length > 0 && !hasBelumMenikah) {
      return ['Dewasa', 'Lansia'];
    }
    return ['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'];
  };

  // Sync Input Tab Kategori filter when Status Pernikahan changes
  useEffect(() => {
    const available = getAvailableKategoris(inputStatusPernikahan);
    setFilterKategori(prev => {
      const next = prev.filter(c => available.includes(c));
      const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return isSame ? prev : next;
    });
  }, [inputStatusPernikahan]);

  // Sync Laporan Tab Kategori filter when Status Pernikahan changes
  useEffect(() => {
    const available = getAvailableKategoris(reportStatusPernikahan);
    setReportKategori(prev => {
      const next = prev.filter(c => available.includes(c));
      const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return isSame ? prev : next;
    });
  }, [reportStatusPernikahan]);

  // Sync Input Tab Kelompok filter when Desa filter changes
  useEffect(() => {
    if (filterDesas.length > 0) {
      const validKelompoks = locations
        .filter(d => filterDesas.includes(d.nama_desa))
        .flatMap(d => d.kelompoks.map(k => k.nama_kelompok));
      
      setFilterKelompoks(prev => {
        const next = prev.filter(k => validKelompoks.includes(k));
        const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
        return isSame ? prev : next;
      });
    }
  }, [filterDesas, locations]);

  // Sync Desa when Kelompok changes (Input Tab)
  useEffect(() => {
    if (filterKelompoks.length > 0) {
      const neededDesas = [];
      filterKelompoks.forEach(kName => {
        const parentDesa = locations.find(d => 
          d.kelompoks.some(k => k.nama_kelompok === kName)
        );
        if (parentDesa && !neededDesas.includes(parentDesa.nama_desa)) {
          neededDesas.push(parentDesa.nama_desa);
        }
      });
      setFilterDesas(prev => {
        const isSame = prev.length === neededDesas.length && prev.every((d, i) => d === neededDesas[i]);
        if (isSame) return prev;
        return neededDesas;
      });
    }
  }, [filterKelompoks, locations]);

  // Sync Input Tab Marital Status filter when Gender or Kategori filter changes
  useEffect(() => {
    const available = getAvailableMaritalStatuses(filterGenders, filterKategori);
    setInputStatusPernikahan(prev => {
      const next = prev.filter(s => available.includes(s));
      const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return isSame ? prev : next;
    });
  }, [filterGenders, filterKategori]);

  // Sync Laporan Tab Kelompok filter when Desa filter changes
  useEffect(() => {
    if (reportDesas.length > 0) {
      const validKelompoks = locations
        .filter(d => reportDesas.includes(d.nama_desa))
        .flatMap(d => d.kelompoks.map(k => k.nama_kelompok));
      
      setReportKelompoks(prev => {
        const next = prev.filter(k => validKelompoks.includes(k));
        const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
        return isSame ? prev : next;
      });
    }
  }, [reportDesas, locations]);

  // Sync Desa when Kelompok changes (Laporan Tab)
  useEffect(() => {
    if (reportKelompoks.length > 0) {
      const neededDesas = [];
      reportKelompoks.forEach(kName => {
        const parentDesa = locations.find(d => 
          d.kelompoks.some(k => k.nama_kelompok === kName)
        );
        if (parentDesa && !neededDesas.includes(parentDesa.nama_desa)) {
          neededDesas.push(parentDesa.nama_desa);
        }
      });
      setReportDesas(prev => {
        const isSame = prev.length === neededDesas.length && prev.every((d, i) => d === neededDesas[i]);
        if (isSame) return prev;
        return neededDesas;
      });
    }
  }, [reportKelompoks, locations]);

  // Sync Laporan Tab Marital Status filter when Gender or Kategori filter changes
  useEffect(() => {
    const available = getAvailableMaritalStatuses(reportGenders, reportKategori);
    setReportStatusPernikahan(prev => {
      const next = prev.filter(s => available.includes(s));
      const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return isSame ? prev : next;
    });
  }, [reportGenders, reportKategori]);

  const getAvailableSesiMarital = (kategoris) => {
    const adultKats = ['Dewasa', 'Lansia'];
    const hasAdultsSelected = kategoris.some(k => adultKats.includes(k));
    const hasNonAdultsSelected = kategoris.some(k => !adultKats.includes(k));

    if (kategoris.length > 0 && hasNonAdultsSelected && !hasAdultsSelected) {
      return ['Belum Menikah'];
    }

    return ['Belum Menikah', 'Menikah', 'Janda/Duda'];
  };

  const getAvailableSesiKategoris = (statuses) => {
    const hasBelumMenikah = statuses.includes('Belum Menikah');
    if (statuses.length > 0 && !hasBelumMenikah) {
      return ['Dewasa', 'Lansia'];
    }
    return ['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'];
  };

  // Sync Sesi Kelompok when Sesi Desa changes
  useEffect(() => {
    if (newSesiDesas.length > 0) {
      const validKelompoks = locations
        .filter(d => newSesiDesas.includes(d.nama_desa))
        .flatMap(d => d.kelompoks.map(k => k.nama_kelompok));
      
      setNewSesiKelompoks(prev => {
        const next = prev.filter(k => validKelompoks.includes(k));
        const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
        return isSame ? prev : next;
      });
    }
  }, [newSesiDesas, locations]);

  // Sync Sesi Desa when Sesi Kelompok changes
  useEffect(() => {
    if (newSesiKelompoks.length > 0) {
      const neededDesas = [];
      newSesiKelompoks.forEach(kName => {
        const parentDesa = locations.find(d => 
          d.kelompoks.some(k => k.nama_kelompok === kName)
        );
        if (parentDesa && !neededDesas.includes(parentDesa.nama_desa)) {
          neededDesas.push(parentDesa.nama_desa);
        }
      });
      setNewSesiDesas(prev => {
        const isSame = prev.length === neededDesas.length && prev.every((d, i) => d === neededDesas[i]);
        if (isSame) return prev;
        return neededDesas;
      });
    }
  }, [newSesiKelompoks, locations]);

  // Sync Sesi Marital Status when Sesi Kategori changes
  useEffect(() => {
    const available = getAvailableSesiMarital(newSesiKategoris);
    setNewSesiMarital(prev => {
      const next = prev.filter(s => available.includes(s));
      const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return isSame ? prev : next;
    });
  }, [newSesiKategoris]);

  // Sync Sesi Kategori when Sesi Marital Status changes
  useEffect(() => {
    const available = getAvailableSesiKategoris(newSesiMarital);
    setNewSesiKategoris(prev => {
      const next = prev.filter(c => available.includes(c));
      const isSame = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return isSame ? prev : next;
    });
  }, [newSesiMarital]);

  // Calendar States
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calSessions, setCalSessions] = useState({});
  const [loadingCal, setLoadingCal] = useState(false);

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

  const monthsList = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  const getUniqueSessionYears = () => {
    if (!sessions || sessions.length === 0) return [new Date().getFullYear().toString()];
    const years = sessions.map(s => s.tanggal.split('-')[0]);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/sesi');
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch (err) {
      console.error("Gagal mengambil sesi:", err);
    } finally {
      setLoadingSessions(false);
    }
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
      const locationsData = lokasiRes.ok ? await lokasiRes.json() : [];
      setLocations(locationsData);

      await loadSessions();

      // Default filters berdasarkan monitored locations
      if (!currentUser.monitor_all_desas && currentUser.desas_pantau && currentUser.desas_pantau.length > 0) {
        setFilterDesas(currentUser.desas_pantau);
        setReportDesas(currentUser.desas_pantau);
      } else if (currentUser.role === 'Admin') {
        setFilterDesas(currentUser.desa ? [currentUser.desa] : []);
        setReportDesas(currentUser.desa ? [currentUser.desa] : []);
      } else {
        setFilterDesas(locationsData.map(d => d.nama_desa));
        setReportDesas(locationsData.map(d => d.nama_desa));
      }
      
      if (!currentUser.monitor_all_kelompoks && currentUser.kelompoks_pantau && currentUser.kelompoks_pantau.length > 0) {
        setFilterKelompoks(currentUser.kelompoks_pantau);
        setReportKelompoks(currentUser.kelompoks_pantau);
      } else if (currentUser.role === 'Moderator') {
        setFilterDesas(currentUser.desa ? [currentUser.desa] : []);
        setFilterKelompoks(currentUser.kelompok ? [currentUser.kelompok] : []);
        setReportDesas(currentUser.desa ? [currentUser.desa] : []);
        setReportKelompoks(currentUser.kelompok ? [currentUser.kelompok] : []);
      } else {
        setFilterKelompoks(locationsData.flatMap(d => d.kelompoks.map(k => k.nama_kelompok)));
        setReportKelompoks(locationsData.flatMap(d => d.kelompoks.map(k => k.nama_kelompok)));
      }

      // Default Date Picker ke hari ini (Format: YYYY-MM-DD)
      const todayStr = new Date().toISOString().split('T')[0];
      setSelectedDate(todayStr);
      setNewSesiDate(todayStr);

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

  // 2. Load Data Kehadiran ketika Sesi terpilih berubah
  const loadInputAttendance = async () => {
    if (!selectedSessionId || !user) {
      setJamaahList([]);
      return;
    }
    setLoadingInput(true);
    try {
      const res = await fetch(`/api/kehadiran?sesi_id=${selectedSessionId}`);
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
  }, [selectedSessionId, user]);

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
          sesi_id: selectedSessionId,
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
    if (!selectedSessionId) {
      showToast("Gagal: Tidak ada sesi terpilih untuk dihapus", "error");
      return;
    }
    const targetSession = sessions.find(s => s.id === selectedSessionId);
    const sessionName = targetSession ? `${targetSession.jenis_pengajian} (${targetSession.tanggal})` : selectedSessionId;
    if (!confirm(`Apakah Anda yakin ingin menghapus seluruh data presensi untuk sesi ${sessionName}? Data yang sudah tersimpan di database akan dihapus.`)) {
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch(`/api/kehadiran?sesi_id=${selectedSessionId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Berhasil menghapus presensi untuk sesi ${sessionName}`, "success");
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

  // 3d. Sync ke Ngajiku Handlers
  const handleOpenSyncModal = async (session) => {
    setSyncingSession(session);
    setShowSyncModal(true);
    setLoadingSyncSchedules(true);
    setSelectedSyncSchedule('');
    setSyncSchedules([]);
    
    try {
      const res = await fetch(`/api/sesi/${session.id}/sync`);
      const data = await res.json();
      if (res.ok) {
        setSyncSchedules(data);
      } else {
        showToast(data.error || "Gagal mengambil jadwal Ngajiku", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghubungi server untuk mengambil jadwal", "error");
    } finally {
      setLoadingSyncSchedules(false);
    }
  };

  const handleExecuteSync = async () => {
    if (!selectedSyncSchedule) {
      showToast("Silakan pilih jadwal terlebih dahulu", "error");
      return;
    }

    let parsedSchedule;
    try {
      parsedSchedule = JSON.parse(selectedSyncSchedule);
    } catch (e) {
      showToast("Format jadwal tidak valid", "error");
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(`/api/sesi/${syncingSession.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: parsedSchedule.tanggal,
          kelas: parsedSchedule.kelas
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Sinkronisasi berhasil!", "success");
        setShowSyncModal(false);
        await loadSessions();
        if (selectedSessionId === syncingSession.id) {
          loadInputAttendance();
        }
      } else {
        showToast(data.error || "Gagal melakukan sinkronisasi", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Terjadi kesalahan koneksi server saat sinkronisasi", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Load Laporan Kehadiran (Mendukung Rentang Waktu dan Checkbox Kategori/Pernikahan)
  const loadReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      showToast("Mulai dan selesai wajib diisi", "error");
      return;
    }
    setLoadingReport(true);

    const desasParam = reportDesas.join(',');
    const kelompoksParam = reportKelompoks.join(',');
    const gendersParam = reportGenders.join(',');
    const kategoriParam = reportKategori.join(',');
    const maritalParam = reportStatusPernikahan.join(',');
    const sesiIdsParam = selectedReportSessionIds.join(',');

    try {
      const res = await fetch(`/api/kehadiran/laporan?start_date=${reportStartDate}&end_date=${reportEndDate}&desas=${encodeURIComponent(desasParam)}&kelompoks=${encodeURIComponent(kelompoksParam)}&genders=${encodeURIComponent(gendersParam)}&kategori=${encodeURIComponent(kategoriParam)}&status_pernikahan=${encodeURIComponent(maritalParam)}&sesi_ids=${encodeURIComponent(sesiIdsParam)}`);
      if (!res.ok) throw new Error("Gagal memuat laporan kehadiran");
      const data = await res.json();
      setReportData(data);
      setShowReportFilters(false);
      showToast("Laporan berhasil dimuat", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoadingReport(false);
    }
  };

  // Sync matching sessions in range when dates or session lists change
  useEffect(() => {
    if (sessions && sessions.length > 0 && reportStartDate && reportEndDate) {
      const filtered = sessions.filter(s => {
        const inDateRange = s.tanggal >= reportStartDate && s.tanggal <= reportEndDate;
        if (!inDateRange) return false;

        const matchesDesa = reportDesas.length === 0 || s.desas.some(d => reportDesas.includes(d));
        const matchesKelompok = reportKelompoks.length === 0 || s.kelompoks.some(k => reportKelompoks.includes(k));
        const matchesGender = reportGenders.length === 0 || s.genders.some(g => reportGenders.includes(g));
        const matchesMarital = reportStatusPernikahan.length === 0 || s.marital_statuses.some(m => reportStatusPernikahan.includes(m));
        const matchesKategori = reportKategori.length === 0 || s.kategoris.some(kat => reportKategori.includes(kat));

        return matchesDesa && matchesKelompok && matchesGender && matchesMarital && matchesKategori;
      });

      const matchedIds = filtered.map(s => s.id);
      setSelectedReportSessionIds(matchedIds);
    } else {
      setSelectedReportSessionIds([]);
    }
  }, [reportStartDate, reportEndDate, reportDesas, reportKelompoks, reportGenders, reportStatusPernikahan, reportKategori, sessions]);

  // Load report data saat pertama kali tab laporan dibuka
  useEffect(() => {
    if (activeTab === 'laporan' && !reportData && reportStartDate && reportEndDate && user) {
      loadReport();
    }
  }, [activeTab, user]);

  const fetchCalendarSessions = async () => {
    if (!user) return;
    
    const firstDay = new Date(calYear, calMonth, 1);
    const dayOfWeek = firstDay.getDay();
    const daysToSub = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfGrid = new Date(calYear, calMonth, 1);
    startOfGrid.setDate(startOfGrid.getDate() - daysToSub);

    const lastDay = new Date(calYear, calMonth + 1, 0);
    const endDayOfWeek = lastDay.getDay();
    const daysToAdd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    const endOfGrid = new Date(calYear, calMonth + 1, 0);
    endOfGrid.setDate(endOfGrid.getDate() + daysToAdd);

    const pad = (n) => n.toString().padStart(2, '0');
    const startStr = `${startOfGrid.getFullYear()}-${pad(startOfGrid.getMonth() + 1)}-${pad(startOfGrid.getDate())}`;
    const endStr = `${endOfGrid.getFullYear()}-${pad(endOfGrid.getMonth() + 1)}-${pad(endOfGrid.getDate())}`;

    setLoadingCal(true);
    try {
      const res = await fetch(`/api/kehadiran/sesi-kalender?start=${startStr}&end=${endStr}`);
      if (res.ok) {
        const data = await res.json();
        setCalSessions(data);
      }
    } catch (err) {
      console.error("Gagal mengambil sesi kalender:", err);
    } finally {
      setLoadingCal(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'laporan') {
      fetchCalendarSessions();
    }
  }, [activeTab, calYear, calMonth, user]);

  const getCalendarDays = () => {
    const days = [];
    const firstDay = new Date(calYear, calMonth, 1);
    const dayOfWeek = firstDay.getDay();
    const daysToSub = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startDate = new Date(calYear, calMonth, 1);
    startDate.setDate(startDate.getDate() - daysToSub);

    for (let i = 0; i < 42; i++) {
      const tempDate = new Date(startDate);
      tempDate.setDate(startDate.getDate() + i);
      days.push(tempDate);
    }
    return days;
  };

  const formatDateLocal = (dateObj) => {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  };

  const handleCalendarDayClick = (dateStr) => {
    if (!reportStartDate || (reportStartDate && reportEndDate && reportStartDate !== reportEndDate)) {
      setReportStartDate(dateStr);
      setReportEndDate(dateStr);
    } else {
      if (dateStr >= reportStartDate) {
        setReportEndDate(dateStr);
      } else {
        setReportStartDate(dateStr);
        setReportEndDate(dateStr);
      }
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  const handleCreateSesi = async (e) => {
    e.preventDefault();
    if (!newSesiDate || !newSesiStart || !newSesiEnd || !newSesiType) {
      showToast("Gagal: Lengkapi form tanggal dan waktu pengajian", "error");
      return;
    }
    if (newSesiDesas.length === 0 || newSesiKelompoks.length === 0) {
      showToast("Gagal: Sesi harus memiliki minimal 1 Desa dan 1 Kelompok target", "error");
      return;
    }
    if (newSesiGenders.length === 0 || newSesiMarital.length === 0 || newSesiKategoris.length === 0) {
      showToast("Gagal: Sesi harus memiliki minimal 1 target Gender, Status Pernikahan, dan Kategori Peserta", "error");
      return;
    }

    let dbMarital = [...newSesiMarital];
    if (dbMarital.includes('Janda/Duda')) {
      dbMarital = dbMarital.filter(m => m !== 'Janda/Duda');
      dbMarital.push('Janda', 'Duda');
    }

    setLoadingSubmit(true);
    try {
      const url = editingSessionId ? `/api/sesi/${editingSessionId}` : '/api/sesi';
      const method = editingSessionId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: newSesiDate,
          waktu_mulai: newSesiStart,
          waktu_selesai: newSesiEnd,
          jenis_pengajian: newSesiType,
          desas: newSesiDesas,
          kelompoks: newSesiKelompoks,
          genders: newSesiGenders,
          marital_statuses: dbMarital,
          kategoris: newSesiKategoris
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editingSessionId ? "Sesi pengajian berhasil diperbarui" : "Sesi pengajian berhasil dibuat", "success");
        setShowCreateSesiModal(false);
        setEditingSessionId(null);
        setNewSesiStart('08:00');
        setNewSesiEnd('10:00');
        setNewSesiType('Kelompok');
        // Reset selections
        setNewSesiDesas([]);
        setNewSesiKelompoks([]);
        await loadSessions();
      } else {
        showToast(data.error || (editingSessionId ? "Gagal memperbarui sesi" : "Gagal membuat sesi"), "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghubungi server", "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleDeleteSesi = async (id, name) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus sesi pengajian '${name}'? Menghapus sesi ini juga akan menghapus data kehadiran yang terikat dengannya.`)) {
      return;
    }
    setLoadingSubmit(true);
    try {
      const res = await fetch(`/api/sesi/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Sesi '${name}' berhasil dihapus`, "success");
        await loadSessions();
      } else {
        showToast(data.error || "Gagal menghapus sesi", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghubungi server", "error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const filteredInputList = jamaahList.filter(j => {
    const matchName = j.nama_lengkap.toLowerCase().includes(searchName.toLowerCase().trim());
    const matchDesa = filterDesas.length === 0 || filterDesas.includes(j.desa);
    const matchKelompok = filterKelompoks.length === 0 || filterKelompoks.includes(j.kelompok);
    const matchGender = filterGenders.length === 0 || filterGenders.includes(j.jenis_kelamin);
    const matchKategori = filterKategori.includes(j.kategori);
    const matchStatusPernikahan = inputStatusPernikahan.some(status => {
      if (status === 'Janda/Duda') {
        return j.status_pernikahan === 'Janda' || j.status_pernikahan === 'Duda';
      }
      return (j.status_pernikahan || 'Belum Menikah') === status;
    });
    
    let matchPresence = true;
    if (filterPresenceStatus) {
      const entries = Object.values(attendanceDraft).filter(val => val.jamaah_id === j.jamaah_id && !val.isDeleted);
      let statusVal = 'Tidak Hadir';
      if (entries.length > 0) {
        if (entries.some(e => e.status === 'Hadir')) {
          statusVal = 'Hadir';
        } else if (entries.some(e => e.status === 'Ijin')) {
          statusVal = 'Ijin';
        }
      }
      
      if (filterPresenceStatus === 'Hadir') {
        matchPresence = statusVal === 'Hadir';
      } else if (filterPresenceStatus === 'Ijin') {
        matchPresence = statusVal === 'Ijin';
      } else if (filterPresenceStatus === 'Absen') {
        matchPresence = statusVal === 'Tidak Hadir';
      }
    }

    return matchName && matchDesa && matchKelompok && matchGender && matchKategori && matchStatusPernikahan && matchPresence;
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
        {(user.can_create_kehadiran || user.can_update_kehadiran) && (
          <button 
            onClick={() => router.push('/dashboard/presensi/rfid')}
            className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className="rotate-90" />
            <span>Mode Kiosk RFID</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-100 mb-6 gap-6">
        {(user.can_read_kehadiran || user.can_create_kehadiran || user.can_update_kehadiran || user.can_delete_kehadiran) && (
          <button 
            className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
              activeTab === 'sesi' 
                ? 'text-primary border-primary' 
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`} 
            onClick={() => setActiveTab('sesi')}
          >
            Sesi Pengajian
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
          {/* Back Navigation & Session Info Header */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab('sesi');
                    setSelectedSessionId('');
                  }}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer transition-colors active:scale-95"
                >
                  <ArrowLeft size={14} />
                  <span>Kembali ke Sesi Pengajian</span>
                </button>
                <div className="h-6 w-[1px] bg-slate-200" />
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Input Kehadiran Sesi: <span className="text-primary">{sessions.find(s => s.id === selectedSessionId)?.jenis_pengajian}</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    Tanggal: {selectedDate ? (() => {
                      const [year, month, day] = selectedDate.split('-').map(Number);
                      const d = new Date(year, month - 1, day);
                      return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    })() : ''} &bull; Pukul: {sessions.find(s => s.id === selectedSessionId)?.waktu_mulai} - {sessions.find(s => s.id === selectedSessionId)?.waktu_selesai} WIB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={loadInputAttendance} 
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw size={14} className={loadingInput ? "animate-spin" : ""} />
                </button>
                {user.can_delete_kehadiran && selectedSessionId && jamaahList.some(j => j.presences && j.presences.length > 0) && (
                  <button
                    onClick={handleDeleteAttendance}
                    disabled={loadingSubmit}
                    className={`py-2 px-4 rounded-lg bg-pastel-red hover:bg-pastel-red-solid/30 text-pastel-red-text font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${loadingSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Trash2 size={14} />
                    <span>Hapus Presensi</span>
                  </button>
                )}
                {selectedSessionId && (user.can_create_kehadiran || user.can_update_kehadiran) && (
                  <button
                    onClick={handleSubmitAttendance}
                    disabled={loadingSubmit || (isBackdate && !attendanceTime)}
                    className={`py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${(loadingSubmit || (isBackdate && !attendanceTime)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <CheckCircle size={14} className={loadingSubmit ? "animate-spin" : ""} />
                    <span>{loadingSubmit ? "Menyimpan..." : "Simpan Kehadiran"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Session Criteria Information Badges */}
            {selectedSessionId && (
              (() => {
                const s = sessions.find(sess => sess.id === selectedSessionId);
                if (!s) return null;
                return (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100/50 font-semibold leading-relaxed grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-slate-100/70">
                    <div>Desa Target: <span className="font-bold text-slate-700">{s.desas.join(', ')}</span></div>
                    <div>Kelompok Target: <span className="font-bold text-slate-700">{s.kelompoks.join(', ')}</span></div>
                    <div>Filter Peserta: <span className="font-bold text-slate-700">{s.genders.join(', ')} &bull; {s.marital_statuses.join(', ')} &bull; {s.kategoris.join(', ')}</span></div>
                  </div>
                );
              })()
            )}

            {isBackdate && (
              <div className="flex items-center gap-3 text-xs font-bold text-slate-650 animate-fadeIn bg-pastel-yellow border border-pastel-yellow-solid/25 px-4 py-2 rounded-xl mt-2 w-fit">
                <Clock size={16} className="text-pastel-yellow-text" />
                <span className="text-pastel-yellow-text uppercase tracking-wider">Jam & Menit (Backdate):</span>
                <input 
                  type="time" 
                  className="px-3 py-1.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 font-bold text-xs" 
                  value={attendanceTime}
                  onChange={(e) => setAttendanceTime(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {!selectedSessionId ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
              <Calendar className="w-12 h-12 text-slate-300" />
              <h3 className="text-base font-bold text-slate-700">Tidak Ada Sesi Terpilih</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed font-bold">
                Silakan buat Sesi Pengajian baru di tab **Manajemen Sesi** untuk tanggal ini, atau pilih tanggal lain yang sudah memiliki sesi aktif.
              </p>
            </div>
          ) : (
            <>
              {/* Saringan Pencarian & Filter */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Search Bar */}
                  <div className="relative flex-1 min-w-[280px]">
                    <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                      placeholder="Cari nama jamaah..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                    />
                  </div>

                  {/* Presence Status Selector */}
                  <div className="flex flex-col gap-1.5 min-w-[140px]">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-left">Status Kehadiran</span>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-750 font-bold text-xs cursor-pointer outline-none hover:border-primary focus:border-primary min-h-[34px]"
                      value={filterPresenceStatus}
                      onChange={(e) => setFilterPresenceStatus(e.target.value)}
                    >
                      <option value="">Semua Kehadiran</option>
                      <option value="Hadir">Hadir</option>
                      <option value="Ijin">Ijin</option>
                      <option value="Absen">Absen</option>
                    </select>
                  </div>
                </div>

                {/* Dropdowns Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 border-t border-slate-50 pt-4">
                  <MultiSelectDropdown
                    label="Target Desa"
                    options={
                      user.monitor_all_desas 
                        ? locations.map(d => d.nama_desa)
                        : locations.filter(d => (user.desas_pantau || []).includes(d.nama_desa)).map(d => d.nama_desa)
                    }
                    selected={filterDesas}
                    onChange={setFilterDesas}
                    placeholder="Pilih Desa..."
                    allLabel="Semua Desa"
                    badgeCountLabel="Desa Terpilih"
                  />

                  <GroupedMultiSelectDropdown
                    label="Target Kelompok"
                    groupedOptions={
                      (user.monitor_all_desas 
                        ? locations 
                        : locations.filter(d => (user.desas_pantau || []).includes(d.nama_desa))
                      ).map(d => ({
                        desa: d.nama_desa,
                        kelompoks: d.kelompoks
                          .filter(k => user.monitor_all_kelompoks || (user.kelompoks_pantau || []).includes(k.nama_kelompok))
                          .map(k => k.nama_kelompok)
                      }))
                    }
                    selected={filterKelompoks}
                    onChange={setFilterKelompoks}
                    placeholder="Pilih Kelompok..."
                  />

                  <MultiSelectDropdown
                    label="Jenis Kelamin"
                    options={['Laki-laki', 'Perempuan']}
                    selected={filterGenders}
                    onChange={setFilterGenders}
                    placeholder="Pilih Gender..."
                    allLabel="Semua Gender"
                    badgeCountLabel="Gender Terpilih"
                  />

                  <MultiSelectDropdown
                    label="Status Pernikahan"
                    options={getAvailableMaritalStatuses(filterGenders, filterKategori)}
                    selected={inputStatusPernikahan}
                    onChange={setInputStatusPernikahan}
                    placeholder="Pilih Status..."
                    allLabel="Semua Status"
                    badgeCountLabel="Status Terpilih"
                  />

                  <MultiSelectDropdown
                    label="Kategori Jamaah"
                    options={getAvailableKategoris(inputStatusPernikahan)}
                    selected={filterKategori}
                    onChange={setFilterKategori}
                    placeholder="Pilih Kategori..."
                    allLabel="Semua Kategori"
                    badgeCountLabel="Kategori Terpilih"
                  />
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
                        

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* ================================================= TAB SESI ================================================= */}
      {activeTab === 'sesi' && (user.can_read_kehadiran || user.can_create_kehadiran || user.can_update_kehadiran || user.can_delete_kehadiran) && (
        <div className="flex flex-col gap-6">
          {/* Header Panel */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Daftar Sesi Pengajian</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Daftar sesi pengajian terjadwal untuk mengelola filter absensi wajib jamaah.
              </p>
            </div>
            {user.can_create_kehadiran && (
              <button
                onClick={() => {
                  setEditingSessionId(null);
                  setNewSesiDate('');
                  setNewSesiStart('08:00');
                  setNewSesiEnd('10:00');
                  setNewSesiType('Kelompok');
                  setNewSesiDesas([]);
                  setNewSesiKelompoks([]);
                  setNewSesiGenders(['Laki-laki', 'Perempuan']);
                  setNewSesiMarital(['Belum Menikah', 'Menikah', 'Duda', 'Janda']);
                  setNewSesiKategoris(['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia']);
                  setShowCreateSesiModal(true);
                }}
                className="py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-md shadow-primary/10 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>+ Buat Sesi Baru</span>
              </button>
            )}
          </div>

          {/* Filters Panel */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <SesiMonthPicker 
                selectedYear={filterSesiYear} 
                selectedMonth={filterSesiMonth} 
                onChange={(year, month) => {
                  setFilterSesiYear(year);
                  setFilterSesiMonth(month);
                }} 
                sessions={sessions}
              />
            </div>

            {(filterSesiYear !== new Date().getFullYear().toString() || filterSesiMonth !== (new Date().getMonth() + 1).toString()) && (
              <button
                onClick={() => {
                  setFilterSesiYear(new Date().getFullYear().toString());
                  setFilterSesiMonth((new Date().getMonth() + 1).toString());
                }}
                className="text-xs font-bold text-red-500 hover:text-red-650 transition-colors py-1.5 px-3 rounded-lg hover:bg-red-50 cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Sesi List Grid */}
          {(() => {
            const filteredSessions = sessions.filter(s => {
              const [yStr, mStr] = s.tanggal.split('-');
              const matchesYear = filterSesiYear ? yStr === filterSesiYear : true;
              const matchesMonth = filterSesiMonth ? parseInt(mStr).toString() === filterSesiMonth : true;
              return matchesYear && matchesMonth;
            });

            if (filteredSessions.length === 0) {
              return (
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
                  <Calendar className="w-12 h-12 text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-700">Tidak Ada Sesi Terjadwal</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
                    {sessions.length === 0 
                      ? "Silakan buat sesi baru untuk mencatat dan menyaring absensi jamaah secara dinamis."
                      : "Tidak ada sesi pengajian yang sesuai dengan filter tahun/bulan yang dipilih."}
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessions.map(s => {
                  let badgeColor = 'bg-teal-50 border-teal-150 text-teal-700';
                  if (s.jenis_pengajian === 'Desa') badgeColor = 'bg-blue-50 border-blue-150 text-blue-700';
                  if (s.jenis_pengajian === 'Daerah') badgeColor = 'bg-purple-50 border-purple-150 text-teal-700'; // let's keep consistency or original classes

                  return (
                  <div key={s.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-3">
                      {/* Top Header Card */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800">
                            {(() => {
                              const [year, month, day] = s.tanggal.split('-').map(Number);
                              const d = new Date(year, month - 1, day);
                              return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                            })()}
                          </span>
                          <span className="text-xs font-bold text-slate-400 mt-0.5">
                            Pukul: {s.waktu_mulai} - {s.waktu_selesai} WIB
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`px-2.5 py-1 rounded-md border text-[10px] font-extrabold uppercase tracking-wider ${badgeColor}`}>
                            {s.jenis_pengajian}
                          </span>
                          {s.attendancePercentage !== undefined && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-pastel-green text-pastel-green-text border border-pastel-green-text/20 shadow-sm">
                              Hadir: {s.attendancePercentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Criteria Details */}
                      <div className="border-t border-slate-50 pt-3 flex flex-col gap-2 text-xs font-bold text-slate-600">
                        <div>
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Desa Target</span>
                          <span className="text-slate-700 font-semibold">{s.desas.join(', ')}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Kelompok Target</span>
                          <span className="text-slate-700 font-semibold">{s.kelompoks.join(', ')}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Jenis Kelamin</span>
                            <span className="text-slate-700 font-semibold">{s.genders.join(', ')}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Status Pernikahan</span>
                            <span className="text-slate-700 font-semibold">{s.marital_statuses.join(', ')}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Kategori Peserta</span>
                          <span className="text-slate-700 font-semibold truncate block" title={s.kategoris.join(', ')}>{s.kategoris.join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-slate-50 pt-3.5 flex justify-between items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingSessionId(s.id);
                            setNewSesiDate(s.tanggal);
                            setNewSesiStart(s.waktu_mulai);
                            setNewSesiEnd(s.waktu_selesai);
                            setNewSesiType(s.jenis_pengajian);
                            setNewSesiDesas(s.desas);
                            setNewSesiKelompoks(s.kelompoks);
                            setNewSesiGenders(s.genders);
                            let uiMarital = [...s.marital_statuses];
                            if (uiMarital.includes('Janda') || uiMarital.includes('Duda')) {
                              uiMarital = uiMarital.filter(m => m !== 'Janda' && m !== 'Duda');
                              uiMarital.push('Janda/Duda');
                            }
                            setNewSesiMarital(uiMarital);
                            setNewSesiKategoris(s.kategoris);
                            setShowCreateSesiModal(true);
                          }}
                          className="flex items-center gap-1 py-1 px-2 rounded text-[11px] font-bold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                          title="Edit Sesi"
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleOpenSyncModal(s)}
                          className="flex items-center gap-1 py-1 px-2 rounded text-[11px] font-bold text-teal-650 hover:bg-teal-50 transition-colors cursor-pointer"
                          title="Sync ke Ngajiku"
                        >
                          <RefreshCw size={12} />
                          <span>Sync</span>
                        </button>

                        {user.can_delete_kehadiran && (
                          <button
                            onClick={() => handleDeleteSesi(s.id, `${s.jenis_pengajian} (${s.tanggal})`)}
                            className="flex items-center gap-1 py-1 px-2 rounded text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Hapus Sesi"
                          >
                            <Trash2 size={12} />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedDate(s.tanggal);
                          setSelectedSessionId(s.id);
                          setActiveTab('input');
                        }}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/10 transition-all cursor-pointer active:scale-95 ml-auto"
                      >
                        <CheckCircle size={12} />
                        <span>Input Kehadiran</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        </div>
      )}

      {/* Sync Sesi Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 flex flex-col gap-5 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-800">Sinkronisasi Kehadiran Ngajiku</h2>
              <button 
                onClick={() => setShowSyncModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                disabled={isSyncing}
              >
                <X size={18} />
              </button>
            </div>

            {syncingSession && (
              <div className="text-xs font-bold text-slate-500 flex flex-col gap-1.5">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Sesi Target</span>
                  <span className="text-slate-700 font-semibold">{syncingSession.jenis_pengajian} ({syncingSession.tanggal})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Kelompok</span>
                  <span className="text-slate-700 font-semibold">{syncingSession.kelompoks.join(', ')}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-slate-700">Pilih Jadwal Sambung di Ngajiku:</label>
              {loadingSyncSchedules ? (
                <div className="flex items-center gap-2 py-3 justify-center text-xs font-bold text-slate-400">
                  <RefreshCw size={14} className="animate-spin text-teal-650" />
                  <span>Mengambil jadwal dari Ngajiku...</span>
                </div>
              ) : syncSchedules.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-4 text-center text-xs font-bold text-slate-450">
                  Tidak ada jadwal yang cocok untuk kelompok ini di Ngajiku.
                </div>
              ) : (
                <select
                  value={selectedSyncSchedule}
                  onChange={(e) => setSelectedSyncSchedule(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary"
                  disabled={isSyncing}
                >
                  <option value="">-- Pilih Jadwal Sambung --</option>
                  {syncSchedules.map((sc, index) => (
                    <option key={index} value={JSON.stringify(sc)}>
                      {sc.kelas} ({sc.tanggal})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                className="py-2 px-4 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                disabled={isSyncing}
              >
                Batal
              </button>
              <button
                onClick={handleExecuteSync}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-teal-700 text-white hover:bg-teal-850 shadow-md shadow-teal-700/10 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                disabled={isSyncing || !selectedSyncSchedule || syncSchedules.length === 0}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Mensinkronisasi...</span>
                  </>
                ) : (
                  <span>Mulai Sinkronisasi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Sesi Modal */}
      {showCreateSesiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-5 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-800">{editingSessionId ? "Edit Sesi Pengajian" : "Buat Sesi Pengajian Baru"}</h2>
              <button 
                onClick={() => setShowCreateSesiModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSesi} className="flex flex-col gap-4 text-xs font-bold text-slate-700">
              {/* Date & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Tanggal Pengajian</label>
                  <input 
                    type="date"
                    required
                    value={newSesiDate}
                    onChange={(e) => setNewSesiDate(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none text-slate-850 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Jenis Pengajian</label>
                  <select
                    value={newSesiType}
                    onChange={(e) => setNewSesiType(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none text-slate-850 bg-white cursor-pointer"
                  >
                    <option value="Kelompok">Kelompok</option>
                    <option value="Desa">Desa</option>
                    <option value="Daerah">Daerah</option>
                  </select>
                </div>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label>Waktu Mulai</label>
                  <input 
                    type="time"
                    required
                    value={newSesiStart}
                    onChange={(e) => setNewSesiStart(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none text-slate-850 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label>Waktu Selesai</label>
                  <input 
                    type="time"
                    required
                    value={newSesiEnd}
                    onChange={(e) => setNewSesiEnd(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none text-slate-850 bg-white"
                  />
                </div>
              </div>

              {/* Target Desa */}
              <MultiSelectDropdown
                label="Desa"
                options={locations.map(d => d.nama_desa).filter(name => name && name !== '-')}
                selected={newSesiDesas}
                onChange={setNewSesiDesas}
                placeholder="Pilih Desa..."
                allLabel="Semua Desa"
                badgeCountLabel="Desa Terpilih"
              />

              {/* Target Kelompok */}
              <GroupedMultiSelectDropdown
                label="Kelompok"
                groupedOptions={locations
                  .filter(d => d.nama_desa && d.nama_desa !== '-')
                  .map(d => ({
                    desa: d.nama_desa,
                    kelompoks: d.kelompoks.map(k => k.nama_kelompok).filter(name => name && name !== '-')
                  }))}
                selected={newSesiKelompoks}
                onChange={setNewSesiKelompoks}
                placeholder="Pilih Kelompok..."
              />

              {/* Gender and Marital Checklist Grid */}
              <div className="grid grid-cols-2 gap-4">
                <MultiSelectDropdown
                  label="Jenis Kelamin"
                  options={['Laki-laki', 'Perempuan']}
                  selected={newSesiGenders}
                  onChange={setNewSesiGenders}
                  placeholder="Pilih Gender..."
                  allLabel="Semua Gender"
                  badgeCountLabel="Gender Terpilih"
                />

                <MultiSelectDropdown
                  label="Status Pernikahan"
                  options={getAvailableSesiMarital(newSesiKategoris)}
                  selected={newSesiMarital}
                  onChange={setNewSesiMarital}
                  placeholder="Pilih Status..."
                  allLabel="Semua Status"
                  badgeCountLabel="Status Terpilih"
                />
              </div>

              {/* Kategori Checklist */}
              <MultiSelectDropdown
                label="Kategori"
                options={getAvailableSesiKategoris(newSesiMarital)}
                selected={newSesiKategoris}
                onChange={setNewSesiKategoris}
                placeholder="Pilih Kategori..."
                allLabel="Semua Kategori"
                badgeCountLabel="Kategori Terpilih"
              />

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSesiModal(false)}
                  className="py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingSubmit}
                  className="py-2 px-5 rounded-lg bg-primary hover:bg-primary-hover text-white transition-all font-bold flex items-center gap-1.5 shadow-md shadow-primary/10 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {loadingSubmit && <RefreshCw size={12} className="animate-spin" />}
                  <span>{editingSessionId ? "Simpan Perubahan" : "Buat Sesi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================= TAB LAPORAN ================================================= */}
      {activeTab === 'laporan' && user.can_read_laporan && (
        <div className="flex flex-col gap-6">
          {/* Custom Calendar Card */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  Kalender Overview Kehadiran & Pemilihan Range
                </h2>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Klik tanggal awal kemudian tanggal akhir untuk memilih rentang laporan. Angka kecil di bawah tanggal menunjukkan jumlah maksimal sesi pengajian pada tanggal tersebut.
                </p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 border border-slate-150 p-1.5 rounded-xl bg-slate-50/50 self-start">
                <button 
                  onClick={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear(prev => prev - 1);
                    } else {
                      setCalMonth(prev => prev - 1);
                    }
                  }}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer shadow-sm"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-slate-700 min-w-[110px] text-center uppercase tracking-wider">
                  {new Date(calYear, calMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear(prev => prev + 1);
                    } else {
                      setCalMonth(prev => prev + 1);
                    }
                  }}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer shadow-sm"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-slate-150 rounded-xl overflow-hidden shadow-inner">
              {/* Weekdays */}
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-150 text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div>Sen</div>
                <div>Sel</div>
                <div>Rab</div>
                <div>Kam</div>
                <div>Jum</div>
                <div>Sab</div>
                <div>Min</div>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 bg-slate-150 gap-[1px]">
                {getCalendarDays().map((date, idx) => {
                  const dateStr = formatDateLocal(date);
                  const isCurrentMonth = date.getMonth() === calMonth;
                  const isStart = dateStr === reportStartDate;
                  const isEnd = dateStr === reportEndDate;
                  const isInRange = reportStartDate && reportEndDate && dateStr > reportStartDate && dateStr < reportEndDate;
                  const sessionsCount = calSessions[dateStr] || 0;

                  return (
                    <div 
                      key={idx}
                      onClick={() => handleCalendarDayClick(dateStr)}
                      className={`min-h-[64px] p-2 flex flex-col justify-between cursor-pointer transition-all ${
                        !isCurrentMonth ? 'bg-slate-50/50 text-slate-350' : 'bg-white text-slate-700'
                      } ${
                        isStart || isEnd 
                          ? '!bg-primary !text-white font-bold' 
                          : isInRange 
                            ? '!bg-primary-light !text-primary font-bold' 
                            : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold">{date.getDate()}</span>
                        {/* Session Badge */}
                        {sessionsCount > 0 && (
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded-full font-bold ${
                            isStart || isEnd
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100/50 shadow-sm'
                          }`}>
                            {sessionsCount} Sesi
                          </span>
                        )}
                      </div>
                      
                      {/* Range Label indicator inside box */}
                      <div className="text-[7.5px] font-bold uppercase tracking-wider text-right opacity-80 mt-1">
                        {isStart && isEnd ? 'Mulai & Selesai' : isStart ? 'Mulai' : isEnd ? 'Selesai' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Laporan Filter Bar */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-5 text-left text-xs font-bold text-slate-700">
            {/* Header & Collapsible Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-5 pb-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowReportFilters(!showReportFilters)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-all flex items-center justify-center"
                  title={showReportFilters ? "Sembunyikan Kriteria" : "Tampilkan Kriteria"}
                >
                  {showReportFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Kriteria & Saringan Laporan</span>
                  <span className="text-[10px] text-slate-450 font-bold mt-0.5">
                    {showReportFilters ? "Pilih kriteria demografis jamaah dan tentukan sesi pengajian yang dianalisis" : "Kriteria disembunyikan. Gunakan tombol di sebelah kiri untuk melihat/mengubah"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 ml-auto">
                <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/60 font-bold text-slate-650">
                  <span className="uppercase tracking-wider text-slate-450 text-[10px] font-extrabold">Rentang Terpilih:</span>
                  <span className="text-slate-800 font-black text-xs">
                    {reportStartDate ? new Date(reportStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </span>
                  <span className="text-slate-450 font-normal">&rarr;</span>
                  <span className="text-slate-800 font-black text-xs">
                    {reportEndDate ? new Date(reportEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </span>
                </div>

                <button 
                  onClick={loadReport} 
                  className="py-2.5 px-5 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg transition-all shadow-md shadow-primary/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  disabled={loadingReport || !reportStartDate || !reportEndDate || selectedReportSessionIds.length === 0}
                >
                  {loadingReport ? "Memuat..." : "Tampilkan Laporan"}
                </button>
              </div>
            </div>

            {showReportFilters && (
              <>
                {/* Dropdowns Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                  <MultiSelectDropdown
                    label="Desa"
                    options={locations.map(d => d.nama_desa)}
                    selected={reportDesas}
                    onChange={setReportDesas}
                    placeholder="Pilih Desa..."
                    allLabel="Semua Desa"
                    badgeCountLabel="Desa Terpilih"
                  />

                  <GroupedMultiSelectDropdown
                    label="Kelompok"
                    groupedOptions={locations.map(d => ({
                      desa: d.nama_desa,
                      kelompoks: d.kelompoks.map(k => k.nama_kelompok)
                    }))}
                    selected={reportKelompoks}
                    onChange={setReportKelompoks}
                    placeholder="Pilih Kelompok..."
                  />
                </div>

                {/* Review Sesi Panel (Inclusion / Exclusion Checkboxes) */}
                {reportStartDate && reportEndDate && (
                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                    {(() => {
                      const matchingSessionsInRange = sessions.filter(s => {
                        const inDateRange = s.tanggal >= reportStartDate && s.tanggal <= reportEndDate;
                        if (!inDateRange) return false;

                        const matchesDesa = reportDesas.length === 0 || s.desas.some(d => reportDesas.includes(d));
                        const matchesKelompok = reportKelompoks.length === 0 || s.kelompoks.some(k => reportKelompoks.includes(k));
                        const matchesGender = reportGenders.length === 0 || s.genders.some(g => reportGenders.includes(g));
                        const matchesMarital = reportStatusPernikahan.length === 0 || s.marital_statuses.some(m => reportStatusPernikahan.includes(m));
                        const matchesKategori = reportKategori.length === 0 || s.kategoris.some(kat => reportKategori.includes(kat));

                        return matchesDesa && matchesKelompok && matchesGender && matchesMarital && matchesKategori;
                      });

                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Review Sesi Pengajian ({matchingSessionsInRange.length} Sesi Cocok)
                            </span>
                            {matchingSessionsInRange.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const matchIds = matchingSessionsInRange.map(s => s.id);
                                  const allChecked = matchIds.every(id => selectedReportSessionIds.includes(id));
                                  if (allChecked) {
                                    setSelectedReportSessionIds(prev => prev.filter(id => !matchIds.includes(id)));
                                  } else {
                                    setSelectedReportSessionIds(prev => {
                                      const union = new Set([...prev, ...matchIds]);
                                      return Array.from(union);
                                    });
                                  }
                                }}
                                className="text-[10px] text-primary hover:underline font-extrabold cursor-pointer"
                              >
                                {matchingSessionsInRange.every(s => selectedReportSessionIds.includes(s.id)) ? "Sembunyikan Semua Sesi" : "Ikutkan Semua Sesi"}
                              </button>
                            )}
                          </div>

                          {matchingSessionsInRange.length === 0 ? (
                            <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs font-semibold">
                              Tidak ditemukan sesi pengajian yang cocok dengan filter demografis dan wilayah terpilih.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 bg-slate-50/30 border border-slate-100 rounded-xl">
                              {matchingSessionsInRange.map(s => {
                                const isIncluded = selectedReportSessionIds.includes(s.id);
                                let badgeColor = 'bg-teal-50 border-teal-150 text-teal-700';
                                if (s.jenis_pengajian === 'Desa') badgeColor = 'bg-blue-50 border-blue-150 text-blue-700';
                                if (s.jenis_pengajian === 'Daerah') badgeColor = 'bg-purple-50 border-purple-150 text-purple-700';

                                return (
                                  <label 
                                    key={s.id}
                                    className={`flex items-start gap-2.5 p-2.5 border rounded-lg cursor-pointer transition-all hover:bg-white select-none ${
                                      isIncluded 
                                        ? 'bg-white border-primary/25 shadow-sm' 
                                        : 'bg-slate-50/50 border-slate-200/60 opacity-60'
                                    }`}
                                  >
                                    <input 
                                      type="checkbox"
                                      className="rounded border-slate-350 text-primary focus:ring-primary w-4 h-4 mt-0.5"
                                      checked={isIncluded}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedReportSessionIds(prev => [...prev, s.id]);
                                        } else {
                                          setSelectedReportSessionIds(prev => prev.filter(id => id !== s.id));
                                        }
                                      }}
                                    />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-black text-slate-750 text-[11px] truncate">
                                          {new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} &bull; {s.waktu_mulai}
                                        </span>
                                        <span className={`px-1 py-0.5 rounded text-[8px] font-extrabold uppercase border ${badgeColor}`}>
                                          {s.jenis_pengajian}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-semibold truncate leading-tight">
                                        Target: {s.kelompoks.join(', ')} ({s.kategoris.join(', ')})
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
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
                    <span className="text-xl font-bold text-slate-800">{reportData.totalSessions} Sesi</span>
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

// ================================================= HELPER COMPONENTS =================================================

function MultiSelectDropdown({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder = "Pilih...", 
  allLabel = "Semua",
  badgeCountLabel = "terpilih"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const isAllSelected = selected.length === options.length;

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  let displayText = placeholder;
  if (selected.length === 0) {
    displayText = "Tidak ada";
  } else if (selected.length === options.length) {
    displayText = `${allLabel} (${options.length})`;
  } else if (selected.length <= 2) {
    displayText = selected.join(', ');
  } else {
    displayText = `${selected.length} ${badgeCountLabel}`;
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[150px] relative text-left" ref={dropdownRef}>
      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-750 font-bold text-xs flex items-center justify-between hover:border-primary transition-all shadow-sm cursor-pointer outline-none min-h-[34px]"
      >
        <span className="truncate pr-1">{displayText}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] left-0 right-0 mt-1 bg-white border border-slate-150 rounded-xl shadow-xl z-50 p-2.5 max-h-60 overflow-y-auto min-w-[180px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-1.5 mb-1.5">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase">Pilih Opsi</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[9px] text-primary hover:underline font-extrabold cursor-pointer"
            >
              {isAllSelected ? "Hapus Semua" : "Pilih Semua"}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {options.map(opt => {
              const isChecked = selected.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer font-semibold text-slate-650 text-xs">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-slate-350 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupedMultiSelectDropdown({ 
  label, 
  groupedOptions, 
  selected, 
  onChange, 
  placeholder = "Pilih..." 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allKelompoks = groupedOptions.flatMap(g => g.kelompoks);
  const isAllSelected = selected.length === allKelompoks.length;

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...allKelompoks]);
    }
  };

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  let displayText = placeholder;
  if (selected.length === 0) {
    displayText = "Tidak ada";
  } else if (selected.length === allKelompoks.length) {
    displayText = `Semua Kelompok (${allKelompoks.length})`;
  } else if (selected.length <= 2) {
    displayText = selected.join(', ');
  } else {
    displayText = `${selected.length} Kelompok`;
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[150px] relative text-left" ref={dropdownRef}>
      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-750 font-bold text-xs flex items-center justify-between hover:border-primary transition-all shadow-sm cursor-pointer outline-none min-h-[34px]"
      >
        <span className="truncate pr-1">{displayText}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] left-0 mt-1 bg-white border border-slate-150 rounded-xl shadow-xl z-50 p-3 max-h-60 overflow-y-auto min-w-[220px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-1.5 mb-1.5">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase">Pilih Kelompok</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[9px] text-primary hover:underline font-extrabold cursor-pointer"
            >
              {isAllSelected ? "Hapus Semua" : "Pilih Semua"}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {groupedOptions.map(g => (
              <div key={g.desa} className="flex flex-col gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{g.desa}</span>
                <div className="flex flex-col gap-1.5 pl-1">
                  {g.kelompoks.map(k => {
                    const isChecked = selected.includes(k);
                    return (
                      <label key={k} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer font-semibold text-slate-650 text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOption(k)}
                          className="rounded border-slate-350 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        />
                        <span className="truncate">{k}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SesiMonthPicker({ selectedYear, selectedMonth, onChange, sessions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeYear, setActiveYear] = useState(selectedYear || new Date().getFullYear().toString());
  const dropdownRef = useRef(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  useEffect(() => {
    if (selectedYear) {
      setActiveYear(selectedYear);
    }
  }, [selectedYear]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const months = [
    { label: 'Jan', value: '1' },
    { label: 'Feb', value: '2' },
    { label: 'Mar', value: '3' },
    { label: 'Apr', value: '4' },
    { label: 'Mei', value: '5' },
    { label: 'Jun', value: '6' },
    { label: 'Jul', value: '7' },
    { label: 'Agu', value: '8' },
    { label: 'Sep', value: '9' },
    { label: 'Okt', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Des', value: '12' }
  ];

  const handleMonthClick = (monthVal) => {
    onChange(activeYear, monthVal);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('', '');
    setIsOpen(false);
  };

  let displayLabel = "Semua Sesi";
  if (selectedYear && selectedMonth) {
    const monthObj = months.find(m => m.value === selectedMonth);
    const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const fullMonthLabel = monthObj ? indonesianMonths[parseInt(selectedMonth) - 1] : '';
    displayLabel = `${fullMonthLabel} ${selectedYear}`;
  }

  const isNextYearDisabled = parseInt(activeYear) >= currentYear;

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px] relative text-left" ref={dropdownRef}>
      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Filter Bulan Sesi</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-750 font-bold text-xs flex items-center justify-between hover:border-primary transition-all shadow-sm cursor-pointer outline-none min-h-[34px]"
      >
        <span className="truncate pr-1">{displayLabel}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] left-0 mt-1 bg-white border border-slate-150 rounded-xl shadow-xl z-50 p-4 min-w-[240px] animate-fadeIn">
          {/* Year Navigation Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-3">
            <button
              type="button"
              onClick={() => setActiveYear(prev => (parseInt(prev) - 1).toString())}
              className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all font-bold cursor-pointer text-xs"
              title="Tahun Sebelumnya"
            >
              &laquo;
            </button>
            <span className="text-sm font-extrabold text-slate-800 tracking-tight">{activeYear}</span>
            <button
              type="button"
              disabled={isNextYearDisabled}
              onClick={() => !isNextYearDisabled && setActiveYear(prev => (parseInt(prev) + 1).toString())}
              className={`p-1.5 rounded-lg transition-all font-bold text-xs ${
                isNextYearDisabled
                  ? 'text-slate-200 cursor-not-allowed opacity-50'
                  : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800 cursor-pointer'
              }`}
              title="Tahun Selanjutnya"
            >
              &raquo;
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {months.map(m => {
              const isSelected = selectedYear === activeYear && selectedMonth === m.value;
              const isMonthDisabled = parseInt(activeYear) > currentYear || (parseInt(activeYear) === currentYear && parseInt(m.value) > currentMonth);
              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={isMonthDisabled}
                  onClick={() => !isMonthDisabled && handleMonthClick(m.value)}
                  className={`py-2 px-1 rounded-lg font-bold text-xs transition-all ${
                    isMonthDisabled
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : isSelected 
                        ? 'bg-primary text-white shadow-md shadow-primary/10 cursor-pointer' 
                        : 'text-slate-655 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Reset/Clear Button */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-50 flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] text-slate-400 hover:text-red-500 transition-all font-bold cursor-pointer"
            >
              Tampilkan Semua Sesi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
