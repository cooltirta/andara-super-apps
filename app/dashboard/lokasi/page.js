"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle, Info, Users, Settings, PlusCircle, UserPlus, Trash } from 'lucide-react';

export default function LokasiManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('struktur'); // 'struktur', 'wilayah', 'dapukan'

  // Tab 1: Struktur Pengurus States
  const [dapukanDefs, setDapukanDefs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [jamaahList, setJamaahList] = useState([]);
  const [levelFilter, setLevelFilter] = useState('Kelompok'); // 'Kelompok', 'Desa', 'Daerah'
  const [selectedDesaId, setSelectedDesaId] = useState('');
  const [selectedKelompokId, setSelectedKelompokId] = useState('');
  const [showAllJamaahForAssign, setShowAllJamaahForAssign] = useState(false);

  // Assignment Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningDapukanDef, setAssigningDapukanDef] = useState(null);
  const [selectedAssignJamaahId, setSelectedAssignJamaahId] = useState('');

  // Tab 2: Wilayah Kerja Modals
  const [isDesaModalOpen, setIsDesaModalOpen] = useState(false);
  const [selectedDesa, setSelectedDesa] = useState(null); // null means ADD, otherwise EDIT
  const [formDesaName, setFormDesaName] = useState('');

  const [isKelompokModalOpen, setIsKelompokModalOpen] = useState(false);
  const [selectedKelompok, setSelectedKelompok] = useState(null); // null means ADD, otherwise EDIT
  const [selectedDesaForKelompok, setSelectedDesaForKelompok] = useState(null); // parent Desa when ADDing groups
  const [formKelompokName, setFormKelompokName] = useState('');

  // Tab 3: Manajemen Dapukan Modals
  const [isDapukanModalOpen, setIsDapukanModalOpen] = useState(false);
  const [selectedDapukan, setSelectedDapukan] = useState(null); // null means ADD, otherwise EDIT
  const [formDapukanName, setFormDapukanName] = useState('');
  const [formDapukanTipe, setFormDapukanTipe] = useState('4S'); // '4S' or 'Tim'

  // Toasts
  const [toasts, setToasts] = useState([]);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await userRes.json();
      setUser(currentUser);

      if (!currentUser.can_read_lokasi && !currentUser.can_read_struktur && !currentUser.can_read_wilayah && !currentUser.can_read_dapukan) {
        showToast("Akses Ditolak: Anda tidak memiliki akses ke halaman ini", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      // Automatically select first authorized tab
      if (currentUser.can_read_struktur || currentUser.can_read_lokasi) {
        setActiveTab('struktur');
      } else if (currentUser.can_read_wilayah) {
        setActiveTab('wilayah');
      } else if (currentUser.can_read_dapukan) {
        setActiveTab('dapukan');
      }

      await fetchLocations();
      await fetchDapukanDefs();
      await fetchJamaahList();
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/lokasi');
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
        if (data.length > 0) {
          setSelectedDesaId(data[0].id);
          if (data[0].kelompoks && data[0].kelompoks.length > 0) {
            setSelectedKelompokId(data[0].kelompoks[0].id);
          }
        }
      } else {
        throw new Error("Gagal mengambil data lokasi");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  };

  const fetchDapukanDefs = async () => {
    try {
      const res = await fetch('/api/dapukan/def');
      if (res.ok) {
        setDapukanDefs(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJamaahList = async () => {
    try {
      const res = await fetch('/api/jamaah');
      if (res.ok) {
        setJamaahList(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssignments = async () => {
    if (!levelFilter) return;
    try {
      let url = `/api/dapukan/assignments?level=${levelFilter}`;
      if (levelFilter === 'Desa' && selectedDesaId) {
        url += `&desa_id=${selectedDesaId}`;
      } else if (levelFilter === 'Kelompok' && selectedKelompokId) {
        url += `&kelompok_id=${selectedKelompokId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        setAssignments(await res.json());
      }
    } catch (err) {
      console.error("Gagal mengambil data penugasan:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user && (user.can_read_lokasi || user.can_read_struktur)) {
      fetchAssignments();
    }
  }, [levelFilter, selectedDesaId, selectedKelompokId, user]);

  const isSuperAdmin = !!(user?.can_create_lokasi && user?.can_update_lokasi && user?.can_delete_lokasi);
  const canManageStruktur = !!(user?.can_update_struktur || user?.can_create_struktur || isSuperAdmin);
  const canManageWilayah = !!(user?.can_update_wilayah || user?.can_create_wilayah || isSuperAdmin);
  const canManageDapukan = !!(user?.can_update_dapukan || user?.can_create_dapukan || isSuperAdmin);

  const handleDesaChange = (desaId) => {
    setSelectedDesaId(desaId);
    const desa = locations.find(d => d.id === desaId);
    if (desa && desa.kelompoks && desa.kelompoks.length > 0) {
      setSelectedKelompokId(desa.kelompoks[0].id);
    } else {
      setSelectedKelompokId('');
    }
  };

  // ========================================== SUBMITS & ACTIONS ==========================================

  // Tab 1: Assignment CRUD
  const openAssignModal = (dapukanDef) => {
    setAssigningDapukanDef(dapukanDef);
    setSelectedAssignJamaahId('');
    setShowAllJamaahForAssign(false);
    setIsAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setIsAssignModalOpen(false);
    setAssigningDapukanDef(null);
    setSelectedAssignJamaahId('');
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!canManageStruktur || !assigningDapukanDef) return;

    const payload = {
      jamaah_id: selectedAssignJamaahId,
      dapukan_def_id: assigningDapukanDef.id,
      level: levelFilter,
      desa_id: (levelFilter === 'Desa' || levelFilter === 'Kelompok') ? selectedDesaId : null,
      kelompok_id: levelFilter === 'Kelompok' ? selectedKelompokId : null
    };

    try {
      const res = await fetch('/api/dapukan/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Pengurus berhasil ditugaskan", "success");
        closeAssignModal();
        fetchAssignments();
      } else {
        showToast(data.error || "Gagal menugaskan pengurus", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Kesalahan koneksi ke server", "error");
    }
  };

  const handleRemoveAssignment = async (id) => {
    if (!canManageStruktur) return;
    if (!confirm("Cabut penugasan jamaah ini dari dapukan?")) return;

    try {
      const res = await fetch(`/api/dapukan/assignments/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Penugasan berhasil dicabut", "success");
        fetchAssignments();
      } else {
        showToast(data.error || "Gagal mencabut penugasan", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Kesalahan koneksi ke server", "error");
    }
  };

  // Tab 2: Desa CRUD
  const openDesaModal = (desa = null) => {
    if (!canManageWilayah) return;
    if (desa) {
      setSelectedDesa(desa);
      setFormDesaName(desa.nama_desa);
    } else {
      setSelectedDesa(null);
      setFormDesaName('');
    }
    setIsDesaModalOpen(true);
  };

  const closeDesaModal = () => {
    setIsDesaModalOpen(false);
    setSelectedDesa(null);
    setFormDesaName('');
  };

  const handleDesaSubmit = async (e) => {
    e.preventDefault();
    if (!canManageWilayah) return;

    const name = formDesaName.trim();
    if (!name) return;

    try {
      const isEdit = !!selectedDesa;
      const url = isEdit ? `/api/lokasi/desa/${selectedDesa.id}` : '/api/lokasi';
      const method = isEdit ? 'PUT' : 'POST';
      const body = { nama_desa: name };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        closeDesaModal();
        fetchLocations();
      } else {
        showToast(data.error || "Gagal memproses data desa", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Kesalahan koneksi ke server", "error");
    }
  };

  const handleDeleteDesa = async (desa) => {
    if (!canManageWilayah) return;
    if (!confirm(`Hapus wilayah Desa ${desa.nama_desa}? Seluruh kelompok di bawah desa ini juga akan terhapus jika tidak terikat jamaah/user.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/lokasi/desa/${desa.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        fetchLocations();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghubungi server", "error");
    }
  };

  // Tab 2: Kelompok CRUD
  const openKelompokModal = (kelompok = null, parentDesa = null) => {
    if (!canManageWilayah) return;
    if (kelompok) {
      setSelectedKelompok(kelompok);
      setFormKelompokName(kelompok.nama_kelompok);
      setSelectedDesaForKelompok(parentDesa);
    } else {
      setSelectedKelompok(null);
      setFormKelompokName('');
      setSelectedDesaForKelompok(parentDesa);
    }
    setIsKelompokModalOpen(true);
  };

  const closeKelompokModal = () => {
    setIsKelompokModalOpen(false);
    setSelectedKelompok(null);
    setFormKelompokName('');
    setSelectedDesaForKelompok(null);
  };

  const handleKelompokSubmit = async (e) => {
    e.preventDefault();
    if (!canManageWilayah) return;

    const name = formKelompokName.trim();
    if (!name) return;

    try {
      const isEdit = !!selectedKelompok;
      const url = isEdit ? `/api/lokasi/kelompok/${selectedKelompok.id}` : '/api/lokasi/kelompok';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { nama_kelompok: name } : { nama_kelompok: name, desa_id: selectedDesaForKelompok.id };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        closeKelompokModal();
        fetchLocations();
      } else {
        showToast(data.error || "Gagal memproses data kelompok", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Kesalahan koneksi ke server", "error");
    }
  };

  const handleDeleteKelompok = async (kelompok) => {
    if (!canManageWilayah) return;
    if (!confirm(`Hapus kelompok ${kelompok.nama_kelompok}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/lokasi/kelompok/${kelompok.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        fetchLocations();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghubungi server", "error");
    }
  };

  // Tab 3: Dapukan CRUD
  const openDapukanModal = (dapukan = null) => {
    if (!canManageDapukan) return;
    if (dapukan) {
      setSelectedDapukan(dapukan);
      setFormDapukanName(dapukan.nama_dapukan);
      setFormDapukanTipe(dapukan.tipe);
    } else {
      setSelectedDapukan(null);
      setFormDapukanName('');
      setFormDapukanTipe('4S');
    }
    setIsDapukanModalOpen(true);
  };

  const closeDapukanModal = () => {
    setIsDapukanModalOpen(false);
    setSelectedDapukan(null);
    setFormDapukanName('');
  };

  const handleDapukanSubmit = async (e) => {
    e.preventDefault();
    if (!canManageDapukan) return;

    const name = formDapukanName.trim();
    if (!name) return;

    try {
      const isEdit = !!selectedDapukan;
      const url = isEdit ? `/api/dapukan/def/${selectedDapukan.id}` : '/api/dapukan/def';
      const method = isEdit ? 'PUT' : 'POST';
      const body = { nama_dapukan: name, tipe: formDapukanTipe };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Dapukan berhasil disimpan", "success");
        closeDapukanModal();
        fetchDapukanDefs();
      } else {
        showToast(data.error || "Gagal memproses data dapukan", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Kesalahan koneksi ke server", "error");
    }
  };

  const handleDeleteDapukan = async (id) => {
    if (!canManageDapukan) return;
    if (!confirm("Hapus master dapukan ini? Seluruh riwayat penugasan jamaah untuk dapukan ini akan otomatis terhapus.")) return;

    try {
      const res = await fetch(`/api/dapukan/def/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || "Dapukan berhasil dihapus", "success");
        fetchDapukanDefs();
      } else {
        showToast(data.error || "Gagal menghapus dapukan", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Kesalahan koneksi ke server", "error");
    }
  };

  if (!user || (!user.can_read_lokasi && !user.can_read_struktur && !user.can_read_wilayah && !user.can_read_dapukan)) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  // Helpers for tab 1
  const getAssignedJamaah = (dapukanDefId) => {
    return assignments.filter(a => a.dapukan_def_id === dapukanDefId);
  };

  const getFilteredJamaahOptions = () => {
    if (showAllJamaahForAssign || levelFilter === 'Daerah') {
      return jamaahList;
    }

    const currentDesa = locations.find(d => d.id === selectedDesaId);
    if (!currentDesa) return [];

    if (levelFilter === 'Desa') {
      return jamaahList.filter(j => j.desa === currentDesa.nama_desa);
    }

    if (levelFilter === 'Kelompok') {
      const currentKelompok = currentDesa.kelompoks.find(k => k.id === selectedKelompokId);
      if (!currentKelompok) return [];
      return jamaahList.filter(j => j.kelompok === currentKelompok.nama_kelompok);
    }

    return [];
  };

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Dapukan & Wilayah
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Kelola struktur pengurus (4S & Tim) serta administrasi data wilayah Desa dan Kelompok
          </p>
        </div>
      </div>

      {!canManageStruktur && !canManageWilayah && !canManageDapukan && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-left text-xs font-bold text-amber-700 flex items-center gap-2.5 mb-6">
          <Info size={18} className="text-amber-600 shrink-0" />
          <span>Anda berada dalam mode Read-Only. Hanya admin/pengurus yang memiliki hak akses modifikasi yang dapat mengubah data di halaman ini.</span>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-100 mb-6 gap-6 text-sm font-bold select-none">
        {(user.can_read_lokasi || user.can_read_struktur) && (
          <button 
            onClick={() => setActiveTab('struktur')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'struktur' 
                ? 'border-primary text-primary font-black' 
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <Users size={16} />
            <span>Struktur Pengurus</span>
          </button>
        )}

        {(user.can_read_lokasi || user.can_read_wilayah) && (
          <button 
            onClick={() => setActiveTab('wilayah')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'wilayah' 
                ? 'border-primary text-primary font-black' 
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <MapPin size={16} />
            <span>Manajemen Wilayah</span>
          </button>
        )}

        {(user.can_read_lokasi || user.can_read_dapukan) && (
          <button 
            onClick={() => setActiveTab('dapukan')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'dapukan' 
                ? 'border-primary text-primary font-black' 
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            <Settings size={16} />
            <span>Manajemen Dapukan</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* TAB 1: STRUKTUR PENGURUS */}
          {activeTab === 'struktur' && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Filter Bar */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tingkat Pengurus</span>
                  <select 
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer outline-none focus:border-primary"
                  >
                    <option value="Kelompok">Tingkat Kelompok</option>
                    <option value="Desa">Tingkat Desa</option>
                    <option value="Daerah">Tingkat Daerah</option>
                  </select>
                </div>

                {(levelFilter === 'Kelompok' || levelFilter === 'Desa') && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desa</span>
                    <select 
                      value={selectedDesaId}
                      onChange={(e) => handleDesaChange(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer outline-none focus:border-primary"
                    >
                      {locations.map(d => (
                        <option key={d.id} value={d.id}>Desa {d.nama_desa}</option>
                      ))}
                    </select>
                  </div>
                )}

                {levelFilter === 'Kelompok' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kelompok</span>
                    <select 
                      value={selectedKelompokId}
                      onChange={(e) => setSelectedKelompokId(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs cursor-pointer outline-none focus:border-primary"
                    >
                      {locations.find(d => d.id === selectedDesaId)?.kelompoks.map(k => (
                        <option key={k.id} value={k.id}>{k.nama_kelompok}</option>
                      )) || <option value="">Belum ada kelompok</option>}
                    </select>
                  </div>
                )}

                <div className="sm:ml-auto flex items-center text-xs font-bold text-slate-500 pt-3 sm:pt-0">
                  {levelFilter === 'Daerah' ? (
                    <span>Struktur Terpantau: <strong>Daerah / Pusat</strong></span>
                  ) : levelFilter === 'Desa' ? (
                    <span>Struktur Terpantau: Desa <strong>{locations.find(d => d.id === selectedDesaId)?.nama_desa || '-'}</strong></span>
                  ) : (
                    <span>Struktur Terpantau: Kelompok <strong>{locations.find(d => d.id === selectedDesaId)?.kelompoks.find(k => k.id === selectedKelompokId)?.nama_kelompok || '-'}</strong></span>
                  )}
                </div>
              </div>

              {/* 4S & Tim Split Layout Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* 4S Column */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">STRUKTUR 4S (Unsur Pimpinan)</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(() => {
                      const order4S = ['Imam', 'Wakil Imam', 'Mubaligh Tugasan', 'KU', 'Aghniya', 'Penerobos'];
                      const sorted4S = [...dapukanDefs]
                        .filter(d => d.tipe === '4S')
                        .sort((a, b) => {
                          const idxA = order4S.indexOf(a.nama_dapukan);
                          const idxB = order4S.indexOf(b.nama_dapukan);
                          if (idxA === -1 && idxB === -1) return a.nama_dapukan.localeCompare(b.nama_dapukan);
                          if (idxA === -1) return 1;
                          if (idxB === -1) return -1;
                          return idxA - idxB;
                        });
                      return sorted4S.map(role => {
                        return (
                        <div key={role.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-h-[105px]">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{role.nama_dapukan}</h4>
                              {canManageStruktur && (
                                <button 
                                  onClick={() => openAssignModal(role)}
                                  className="text-[9px] font-black text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <UserPlus size={11} />
                                  <span>Tambah</span>
                                </button>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 mt-2">
                              {getAssignedJamaah(role.id).length === 0 ? (
                                <span className="text-[10px] text-slate-400 italic font-semibold">Belum ditugaskan</span>
                              ) : (
                                getAssignedJamaah(role.id).map(a => (
                                  <div key={a.id} className="flex justify-between items-center py-1 px-2 bg-white border border-slate-100 rounded-lg text-xs font-bold text-slate-700">
                                    <span className="truncate max-w-[130px]" title={a.nama_jamaah}>{a.nama_jamaah}</span>
                                    {canManageStruktur && (
                                      <button 
                                        onClick={() => handleRemoveAssignment(a.id)}
                                        className="text-red-500 hover:text-red-750 p-0.5 cursor-pointer ml-1"
                                        title="Cabut tugas"
                                      >
                                        <X size={11} />
                                      </button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Tim Column */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500"></div>
                    <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">STRUKTUR TIM (Unsur Pelaksana)</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dapukanDefs.filter(d => d.tipe === 'Tim').map(role => {
                      return (
                        <div key={role.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 hover:shadow-sm transition-all duration-150 flex flex-col justify-between min-h-[105px]">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{role.nama_dapukan}</h4>
                              {canManageStruktur && (
                                <button 
                                  onClick={() => openAssignModal(role)}
                                  className="text-[9px] font-black text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <UserPlus size={11} />
                                  <span>Tambah</span>
                                </button>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 mt-2">
                              {getAssignedJamaah(role.id).length === 0 ? (
                                <span className="text-[10px] text-slate-400 italic font-semibold">Belum ditugaskan</span>
                              ) : (
                                getAssignedJamaah(role.id).map(a => (
                                  <div key={a.id} className="flex justify-between items-center py-1 px-2 bg-white border border-slate-100 rounded-lg text-xs font-bold text-slate-700">
                                    <span className="truncate max-w-[130px]" title={a.nama_jamaah}>{a.nama_jamaah}</span>
                                    {canManageStruktur && (
                                      <button 
                                        onClick={() => handleRemoveAssignment(a.id)}
                                        className="text-red-500 hover:text-red-750 p-0.5 cursor-pointer ml-1"
                                        title="Cabut tugas"
                                      >
                                        <X size={11} />
                                      </button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: MANAJEMEN WILAYAH */}
          {activeTab === 'wilayah' && (user.can_read_lokasi || user.can_read_wilayah) && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              <div className="flex justify-between items-center bg-white border border-slate-100 shadow-sm rounded-xl p-4">
                <span className="text-xs font-bold text-slate-500 text-left">
                  Daftar wilayah administrasi jamaah
                </span>
                {canManageWilayah && (
                  <button 
                    onClick={() => openDesaModal()}
                    className="flex items-center gap-2 py-1.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-xs shadow-md shadow-primary/10 transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Tambah Desa</span>
                  </button>
                )}
              </div>

              {locations.length === 0 ? (
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <MapPin size={44} className="opacity-40 mb-4" />
                  <p className="font-bold text-sm">Belum ada data lokasi dibuat.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {locations.map(desa => (
                    <div key={desa.id} className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col justify-between min-h-[260px] hover:shadow-md transition-all duration-200">
                      <div>
                        {/* Desa Item Header */}
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary animate-pulse" />
                            <h3 className="font-bold text-slate-800 text-sm leading-tight">Desa {desa.nama_desa}</h3>
                          </div>
                          {canManageWilayah && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button 
                                className="text-slate-400 hover:text-primary p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                                onClick={() => openDesaModal(desa)}
                                title="Edit Nama Desa"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                                onClick={() => handleDeleteDesa(desa)}
                                title="Hapus Desa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Kelompok List */}
                        <div className="mb-6">
                          {desa.kelompoks.length === 0 ? (
                            <p className="text-xs text-slate-400 font-bold italic py-2">Belum ada kelompok terdaftar</p>
                          ) : (
                            <div className="flex flex-col gap-2.5">
                              {desa.kelompoks.map(kelompok => (
                                <div 
                                  key={kelompok.id} 
                                  className="flex items-center justify-between py-2 px-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/60 rounded-xl transition-all"
                                >
                                  <span className="text-xs font-bold text-slate-700">{kelompok.nama_kelompok}</span>
                                  {canManageWilayah && (
                                    <div className="flex items-center gap-1">
                                      <button 
                                        className="text-slate-400 hover:text-primary p-1 rounded hover:bg-white/80 transition-all cursor-pointer"
                                        onClick={() => openKelompokModal(kelompok, desa)}
                                        title="Edit Nama Kelompok"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button 
                                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white/80 transition-all cursor-pointer"
                                        onClick={() => handleDeleteKelompok(kelompok)}
                                        title="Hapus Kelompok"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button: Add Kelompok */}
                      {canManageWilayah && (
                        <div>
                          <button 
                            onClick={() => openKelompokModal(null, desa)}
                            className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 font-bold text-[10px] bg-slate-50 hover:bg-primary-light text-slate-655 hover:text-primary rounded-lg transition-all border border-slate-100 cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>Tambah Kelompok</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANAJEMEN DAPUKAN */}
          {activeTab === 'dapukan' && (user.can_read_lokasi || user.can_read_dapukan) && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              <div className="flex justify-between items-center bg-white border border-slate-100 shadow-sm rounded-xl p-4">
                <span className="text-xs font-bold text-slate-500 text-left">
                  Kelola master nama jabatan dapukan pengurus yang tersedia di aplikasi
                </span>
                {canManageDapukan && (
                  <button 
                    onClick={() => openDapukanModal()}
                    className="flex items-center gap-2 py-1.5 px-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-xs shadow-md shadow-primary/10 transition-all cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Tambah Master Dapukan</span>
                  </button>
                )}
              </div>

              {dapukanDefs.length === 0 ? (
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Settings size={44} className="opacity-40 mb-4" />
                  <p className="font-bold text-sm">Belum ada master dapukan dibuat.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3 px-6">Nama Dapukan</th>
                        <th className="py-3 px-6">Tipe Struktur</th>
                        {canManageDapukan && <th className="py-3 px-6 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                      {dapukanDefs.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3.5 px-6 font-extrabold text-slate-800">{d.nama_dapukan}</td>
                          <td className="py-3.5 px-6">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              d.tipe === '4S' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'
                            }`}>
                              {d.tipe}
                            </span>
                          </td>
                          {canManageDapukan && (
                            <td className="py-3.5 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => openDapukanModal(d)}
                                  className="text-slate-400 hover:text-primary p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                                  title="Edit Dapukan"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteDapukan(d.id)}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                                  title="Hapus Dapukan"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================== MODALS ========================================== */}

      {/* 1. Assignment Modal (Tambah Pengurus) */}
      {isAssignModalOpen && canManageStruktur && assigningDapukanDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-855 tracking-tight">
                Tugaskan Pengurus: {assigningDapukanDef.nama_dapukan}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeAssignModal}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-assign-jamaah" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Jamaah</label>
                  <select 
                    id="form-assign-jamaah" 
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                    value={selectedAssignJamaahId}
                    onChange={(e) => setSelectedAssignJamaahId(e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Jamaah --</option>
                    {getFilteredJamaahOptions().map(j => (
                      <option key={j.id} value={j.id}>{j.nama_lengkap} ({j.kelompok})</option>
                    ))}
                  </select>
                </div>

                {levelFilter !== 'Daerah' && (
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="checkbox" 
                      id="checkbox-all-jamaah"
                      checked={showAllJamaahForAssign}
                      onChange={(e) => setShowAllJamaahForAssign(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <label htmlFor="checkbox-all-jamaah" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer">
                      Tampilkan semua jamaah di luar wilayah terpilih
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-2">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg transition-all" onClick={closeAssignModal}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. Desa Modal */}
      {isDesaModalOpen && canManageWilayah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">
                {selectedDesa ? 'Ubah Nama Desa' : 'Tambah Desa Baru'}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeDesaModal}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleDesaSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-desa-name" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Desa</label>
                  <input 
                    type="text" 
                    id="form-desa-name" 
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                    value={formDesaName}
                    onChange={(e) => setFormDesaName(e.target.value)}
                    required 
                    placeholder="Masukkan nama desa"
                  />
                </div>
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-2">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg transition-all" onClick={closeDesaModal}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Kelompok Modal */}
      {isKelompokModalOpen && canManageWilayah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">
                {selectedKelompok ? 'Ubah Nama Kelompok' : `Tambah Kelompok di Desa ${selectedDesaForKelompok?.nama_desa}`}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeKelompokModal}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleKelompokSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-kelompok-name" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Kelompok</label>
                  <input 
                    type="text" 
                    id="form-kelompok-name" 
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                    value={formKelompokName}
                    onChange={(e) => setFormKelompokName(e.target.value)}
                    required 
                    placeholder="Masukkan nama kelompok"
                  />
                </div>
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-2">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg transition-all" onClick={closeKelompokModal}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dapukan Definition Modal */}
      {isDapukanModalOpen && canManageDapukan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">
                {selectedDapukan ? 'Ubah Master Dapukan' : 'Tambah Master Dapukan Baru'}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeDapukanModal}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleDapukanSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-dapukan-name" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Dapukan</label>
                  <input 
                    type="text" 
                    id="form-dapukan-name" 
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                    value={formDapukanName}
                    onChange={(e) => setFormDapukanName(e.target.value)}
                    required 
                    placeholder="Masukkan nama dapukan (misal: Penerobos, Lansia)"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-dapukan-tipe" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipe Struktur</label>
                  <select 
                    id="form-dapukan-tipe" 
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                    value={formDapukanTipe}
                    onChange={(e) => setFormDapukanTipe(e.target.value)}
                    required
                  >
                    <option value="4S">4S (Unsur Pimpinan)</option>
                    <option value="Tim">Tim (Unsur Pelaksana)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-2">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg transition-all" onClick={closeDapukanModal}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
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
