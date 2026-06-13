"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Home, UserPlus, Search, Edit2, Trash2, X, Plus, AlertTriangle, CheckCircle, Info, Download } from 'lucide-react';

export default function DatabasePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('jamaah'); // 'jamaah' or 'keluarga'
  const [jamaahList, setJamaahList] = useState([]);
  const [keluargaList, setKeluargaList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBlood, setFilterBlood] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals state
  const [isJamaahModalOpen, setIsJamaahModalOpen] = useState(false);
  const [selectedJamaahId, setSelectedJamaahId] = useState(null); // null means ADD, otherwise EDIT
  const [formNama, setFormNama] = useState('');
  const [formGender, setFormGender] = useState('Laki-laki');
  const [formBirthplace, setFormBirthplace] = useState('');
  const [formDesa, setFormDesa] = useState('Andara');
  const [formKelompok, setFormKelompok] = useState('Andara 1');
  const [formBlood, setFormBlood] = useState('O');
  const [formStatus, setFormStatus] = useState('Hidup');
  const [formEducation, setFormEducation] = useState('Tidak Sekolah');
  const [formGradDate, setFormGradDate] = useState('');
  const [formKategori, setFormKategori] = useState('Dewasa');

  const [isKeluargaModalOpen, setIsKeluargaModalOpen] = useState(false);
  const [selectedKkId, setSelectedKkId] = useState('');

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedKeluargaId, setSelectedKeluargaId] = useState('');
  const [selectedMemberJamaahId, setSelectedMemberJamaahId] = useState('');
  const [selectedMemberRel, setSelectedMemberRel] = useState('Anak');

  // QR Modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedQrJamaah, setSelectedQrJamaah] = useState(null);

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

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await userRes.json();
      setUser(currentUser);

      if (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin') {
        showToast("Akses Ditolak: Anda tidak memiliki akses ke Database Jamaah", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      const [jamaahRes, keluargaRes] = await Promise.all([
        fetch('/api/jamaah'),
        fetch('/api/keluarga')
      ]);

      if (jamaahRes.ok && keluargaRes.ok) {
        setJamaahList(await jamaahRes.json());
        setKeluargaList(await keluargaRes.json());
      } else {
        throw new Error("Gagal mengambil data jamaah dan keluarga");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openJamaahModal = (id = null) => {
    if (!user) return;
    
    if (id) {
      const j = jamaahList.find(item => item.id === id);
      if (j) {
        setSelectedJamaahId(id);
        setFormNama(j.nama_lengkap);
        setFormGender(j.jenis_kelamin);
        setFormBirthplace(j.tempat_lahir);
        setFormDesa(j.desa);
        setFormKelompok(j.kelompok);
        setFormBlood(j.golongan_darah);
        setFormStatus(j.status_kehidupan);
        setFormEducation(j.pendidikan_terakhir);
        setFormGradDate(j.tanggal_lulus_pendidikan_terakhir || '');
        setFormKategori(j.kategori || 'Dewasa');
        setIsJamaahModalOpen(true);
      }
    } else {
      setSelectedJamaahId(null);
      setFormNama('');
      setFormGender('Laki-laki');
      setFormBirthplace('');
      setFormDesa(user.role === 'Super Admin' ? 'Andara' : user.desa);
      setFormKelompok('Andara 1');
      setFormBlood('O');
      setFormStatus('Hidup');
      setFormEducation('Tidak Sekolah');
      setFormGradDate('');
      setFormKategori('Dewasa');
      setIsJamaahModalOpen(true);
    }
  };

  const closeJamaahModal = () => {
    setIsJamaahModalOpen(false);
    setSelectedJamaahId(null);
  };

  const handleOpenQrModal = (jamaah) => {
    setSelectedQrJamaah(jamaah);
    setIsQrModalOpen(true);
  };

  const handleCloseQrModal = () => {
    setIsQrModalOpen(false);
    setSelectedQrJamaah(null);
  };

  const handleJamaahSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nama_lengkap: formNama,
      jenis_kelamin: formGender,
      tempat_lahir: formBirthplace,
      golongan_darah: formBlood,
      kelompok: formKelompok,
      status_kehidupan: formStatus,
      pendidikan_terakhir: formEducation,
      tanggal_lulus_pendidikan_terakhir: formEducation === 'Tidak Sekolah' ? null : (formGradDate || null),
      desa: formDesa,
      kategori: formKategori
    };

    try {
      const url = selectedJamaahId ? `/api/jamaah/${selectedJamaahId}` : '/api/jamaah';
      const method = selectedJamaahId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        closeJamaahModal();
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan data jamaah", "error");
    }
  };

  const handleDeleteJamaah = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data jamaah ini? Seluruh riwayat presensi dan asosiasi keluarga juga akan terhapus.")) return;

    try {
      const res = await fetch(`/api/jamaah/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghapus data", "error");
    }
  };

  const openKeluargaModal = () => {
    const associatedJamaahIds = keluargaList.flatMap(f => f.anggota.map(m => m.jamaah_id));
    const unassociated = jamaahList.filter(j => !associatedJamaahIds.includes(j.id) && j.status_kehidupan === 'Hidup');

    if (unassociated.length === 0) {
      showToast("Semua jamaah yang hidup dalam wewenang Anda sudah memiliki keluarga.", "error");
      return;
    }

    setSelectedKkId(unassociated[0].id);
    setIsKeluargaModalOpen(true);
  };

  const handleKeluargaSubmit = async (e) => {
    e.preventDefault();
    if (!selectedKkId) return;

    try {
      const res = await fetch('/api/keluarga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kepala_keluarga_id: selectedKkId })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        setIsKeluargaModalOpen(false);
        setActiveTab('keluarga');
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal membuat keluarga", "error");
    }
  };

  const handleDeleteKeluarga = async (id) => {
    if (!confirm("Hapus unit keluarga ini? Anggota keluarga yang terhubung akan dilepaskan (tetapi tidak menghapus data jamaah itu sendiri).")) return;

    try {
      const res = await fetch(`/api/keluarga/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghapus keluarga", "error");
    }
  };

  const openAddMemberModal = (keluargaId) => {
    const associatedJamaahIds = keluargaList.flatMap(f => f.anggota.map(m => m.jamaah_id));
    const unassociated = jamaahList.filter(j => !associatedJamaahIds.includes(j.id) && j.status_kehidupan === 'Hidup');

    if (unassociated.length === 0) {
      showToast("Semua jamaah aktif sudah terdaftar di unit keluarga.", "error");
      return;
    }

    const kel = keluargaList.find(f => f.id === keluargaId);
    const hasKK = kel.anggota.some(m => m.jenis_anggota === 'Kepala Keluarga');

    setSelectedKeluargaId(keluargaId);
    setSelectedMemberJamaahId(unassociated[0].id);
    setSelectedMemberRel(hasKK ? 'Anak' : 'Kepala Keluarga');
    setIsMemberModalOpen(true);
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMemberJamaahId || !selectedMemberRel) return;

    try {
      const res = await fetch(`/api/keluarga/${selectedKeluargaId}/anggota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jamaah_id: selectedMemberJamaahId,
          jenis_anggota: selectedMemberRel
        })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        setIsMemberModalOpen(false);
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menambahkan anggota", "error");
    }
  };

  const handleRemoveMember = async (anggotaId) => {
    if (!confirm("Keluarkan jamaah ini dari unit keluarga?")) return;

    try {
      const res = await fetch(`/api/keluarga/anggota/${anggotaId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal mengeluarkan anggota", "error");
    }
  };

  if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  const filteredJamaah = jamaahList.filter(j => {
    const matchName = j.nama_lengkap.toLowerCase().includes(searchName.toLowerCase().trim());
    const matchKelompok = filterKelompok ? j.kelompok === filterKelompok : true;
    const matchGender = filterGender ? j.jenis_kelamin === filterGender : true;
    const matchBlood = filterBlood ? j.golongan_darah === filterBlood : true;
    const matchStatus = filterStatus ? j.status_kehidupan === filterStatus : true;
    return matchName && matchKelompok && matchGender && matchBlood && matchStatus;
  });

  const associatedJamaahIdsForModal = keluargaList.flatMap(f => f.anggota.map(m => m.jamaah_id));
  const unassociatedJamaahForModal = jamaahList.filter(j => !associatedJamaahIdsForModal.includes(j.id) && j.status_kehidupan === 'Hidup');

  let scopeLabel = user.role === 'Admin' ? ` (Desa ${user.desa})` : '';

  // Statistik Calculations
  const statsActiveJamaah = jamaahList.filter(j => j.status_kehidupan === 'Hidup');
  const totalActive = statsActiveJamaah.length;
  const maleCount = statsActiveJamaah.filter(j => j.jenis_kelamin === 'Laki-laki').length;
  const femaleCount = statsActiveJamaah.filter(j => j.jenis_kelamin === 'Perempuan').length;
  const totalKeluarga = keluargaList.length;

  const getFreq = (list, key) => {
    const freq = {};
    list.forEach(j => {
      const val = j[key] || 'Lainnya';
      freq[val] = (freq[val] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  };

  const kategoriStats = getFreq(statsActiveJamaah, 'kategori');
  const kelompokStats = getFreq(statsActiveJamaah, 'kelompok');
  const desaStats = getFreq(statsActiveJamaah, 'desa');
  const pendidikanStats = getFreq(statsActiveJamaah, 'pendidikan_terakhir');

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Database Jamaah & Keluarga{scopeLabel}
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Kelola informasi pribadi jamaah dan pengelompokan unit keluarga
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button id="btn-modal-keluarga" onClick={openKeluargaModal} className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg shadow-sm transition-all">
            <Home size={14} />
            <span>Buat Keluarga Baru</span>
          </button>
          <button id="btn-modal-jamaah" onClick={() => openJamaahModal()} className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">
            <UserPlus size={14} />
            <span>Tambah Jamaah</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-slate-100 mb-6 gap-6">
        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'jamaah' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          id="tab-jamaah" 
          onClick={() => setActiveTab('jamaah')}
        >
          Daftar Jamaah
        </button>
        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'keluarga' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          id="tab-keluarga" 
          onClick={() => setActiveTab('keluarga')}
        >
          Unit Keluarga
        </button>
        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'statistik' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          id="tab-statistik" 
          onClick={() => setActiveTab('statistik')}
        >
          Statistik Jamaah
        </button>
      </div>

      {/* Filters Area (Only on Jamaah Tab) */}
      {activeTab === 'jamaah' && (
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-3 flex flex-wrap items-center gap-3.5 mb-6" id="search-filter-section">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              id="search-jamaah-name" 
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-755 text-xs font-semibold" 
              placeholder="Cari nama jamaah..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>
          
          {/* Dropdown Filters */}
          <div className="flex flex-wrap gap-2">
            <select 
              id="filter-kelompok" 
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
            <select 
              id="filter-gender" 
              className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="">Semua Gender</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
            <select 
              id="filter-blood" 
              className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
              value={filterBlood}
              onChange={(e) => setFilterBlood(e.target.value)}
            >
              <option value="">Semua Gol. Darah</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="O">O</option>
              <option value="AB">AB</option>
            </select>
            <select 
              id="filter-status" 
              className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="Hidup">Hidup</option>
              <option value="Meninggal">Meninggal</option>
            </select>
          </div>
        </div>
      )}

      {/* Tab Contents */}
      <div id="db-tab-content">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : activeTab === 'jamaah' ? (
          filteredJamaah.length === 0 ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Users size={44} className="opacity-40 mb-4" />
              <p className="font-bold text-sm">Tidak ada data jamaah ditemukan.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Nama Lengkap</th>
                      <th className="px-6 py-4">Gender</th>
                      <th className="px-6 py-4">Tempat Lahir</th>
                      <th className="px-6 py-4">Desa</th>
                      <th className="px-6 py-4">Kelompok</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Gol. Darah</th>
                      <th className="px-6 py-4">Pendidikan</th>
                      <th className="px-6 py-4">Hub. Keluarga</th>
                      <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredJamaah.map(j => {
                      const isAlive = j.status_kehidupan === 'Hidup';
                      return (
                        <tr key={j.id} id={`row-jamaah-${j.id}`} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                          <td className="px-6 py-4 font-bold text-slate-800">{j.nama_lengkap}</td>
                          <td className="px-6 py-4">{j.jenis_kelamin}</td>
                          <td className="px-6 py-4">{j.tempat_lahir}</td>
                          <td className="px-6 py-4 text-primary font-bold">{j.desa}</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-2 py-0.5 rounded bg-primary-light text-primary font-bold text-[10px] uppercase">
                              {j.kelompok}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                              {j.kategori}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isAlive ? 'bg-pastel-green text-pastel-green-text' : 'bg-pastel-red text-pastel-red-text'
                            }`}>
                              {j.status_kehidupan}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-700">{j.golongan_darah}</td>
                          <td className="px-6 py-4 leading-tight">
                            <div className="font-bold text-slate-700">{j.pendidikan_terakhir}</div>
                            <span className="text-[9px] text-slate-400 font-bold">Lulus: {j.pendidikan_terakhir === 'Tidak Sekolah' ? '-' : (j.tanggal_lulus_pendidikan_terakhir || '-')}</span>
                          </td>
                          <td className={`px-6 py-4 ${j.nama_keluarga ? 'text-slate-600' : 'text-slate-350 font-medium italic'}`}>
                            {j.nama_keluarga ? `${j.nama_keluarga} (${j.jenis_anggota})` : 'Belum berasosiasi'}
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center justify-center gap-1.5">
                               <button className="p-1.5 rounded-lg bg-slate-50 hover:bg-teal-550 text-teal-655 hover:text-teal-700 transition-all font-bold text-[10px] cursor-pointer" onClick={() => handleOpenQrModal(j)} title="Cetak Kartu QR">
                                 QR
                               </button>
                               <button className="p-1.5 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-600 hover:text-primary transition-all cursor-pointer" onClick={() => openJamaahModal(j.id)} title="Edit Data">
                                 <Edit2 size={13} />
                               </button>
                               <button className="p-1.5 rounded-lg bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all cursor-pointer" onClick={() => handleDeleteJamaah(j.id)} title="Hapus Data">
                                 <Trash2 size={13} />
                               </button>
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
                {filteredJamaah.map(j => {
                  const isAlive = j.status_kehidupan === 'Hidup';
                  return (
                    <div key={j.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/30 transition-colors">
                      {/* Name, Status & Family Info */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm font-bold text-slate-800 truncate">{j.nama_lengkap}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {j.desa} &bull; {j.kelompok}
                          </span>
                          {j.nama_keluarga && (
                            <span className="text-[9px] text-primary/80 font-bold mt-0.5">
                              {j.nama_keluarga} ({j.jenis_anggota})
                            </span>
                          )}
                        </div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 uppercase ${
                          isAlive ? 'bg-pastel-green text-pastel-green-text' : 'bg-pastel-red text-pastel-red-text'
                        }`}>
                          {j.status_kehidupan}
                        </span>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-50/60 p-2 rounded-xl border border-slate-100 text-[9px] font-bold text-slate-500">
                        <div>
                          <span className="text-[7.5px] text-slate-400 block mb-0.5">KATEGORI</span>
                          <span className="truncate block text-slate-700">{j.kategori}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-slate-400 block mb-0.5">GENDER</span>
                          <span className="truncate block text-slate-700">{j.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-slate-400 block mb-0.5">GOL. DARAH</span>
                          <span className="truncate block text-slate-700">{j.golongan_darah || '-'}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] text-slate-400 block mb-0.5">PENDIDIKAN</span>
                          <span className="truncate block text-slate-700">{j.pendidikan_terakhir}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 mt-0.5">
                        <span className="text-[9.5px] text-slate-400 font-semibold">
                          Lahir: {j.tempat_lahir || '-'}
                        </span>
                        <div className="flex gap-2">
                          <button className="py-1.5 px-3 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white border border-teal-100/50 transition-all font-bold text-[10px] cursor-pointer" onClick={() => handleOpenQrModal(j)} title="Cetak Kartu QR">
                            QR Card
                          </button>
                          <button className="p-2 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary border border-slate-200/50 transition-all cursor-pointer" onClick={() => openJamaahModal(j.id)} title="Edit Data">
                            <Edit2 size={14} />
                          </button>
                          <button className="p-2 rounded-lg bg-red-50 hover:bg-red-500 text-red-550 hover:text-white border border-red-100/30 transition-all cursor-pointer" onClick={() => handleDeleteJamaah(j.id)} title="Hapus Data">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : activeTab === 'keluarga' ? (
          keluargaList.length === 0 ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Home size={44} className="opacity-40 mb-4" />
              <p className="font-bold text-sm">Belum ada data keluarga dibuat.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {keluargaList.map(f => {
                return (
                  <div key={f.id} className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col justify-between min-h-[260px] hover:shadow-md transition-all duration-200">
                    <div>
                      {/* Family card Header */}
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{f.nama_keluarga}</h4>
                        <button className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-50 transition-all shrink-0" onClick={() => handleDeleteKeluarga(f.id)} title="Hapus Unit Keluarga">
                          <Trash2 size={15} />
                        </button>
                      </div>
                      
                      {/* Members list */}
                      <div className="mb-6">
                        {f.anggota.length === 0 ? (
                          <p className="text-xs text-slate-400 font-bold italic py-2">Keluarga tidak memiliki anggota aktif</p>
                        ) : (
                          <table className="w-full text-left text-[11px] font-semibold">
                            <thead>
                              <tr className="border-b border-slate-100 text-slate-400 font-bold">
                                <th className="py-1.5">Nama Anggota</th>
                                <th className="py-1.5">Hubungan</th>
                                <th className="py-1.5 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {f.anggota.map(m => {
                                const isWafat = m.status_kehidupan === 'Meninggal';
                                return (
                                  <tr key={m.anggota_id} className="text-slate-600 hover:bg-slate-50/50">
                                    <td className="py-2 font-bold text-slate-800">
                                      {m.nama_lengkap}
                                      {isWafat && <span className="text-[8px] font-extrabold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full ml-1.5 uppercase tracking-wider">Wafat</span>}
                                    </td>
                                    <td className="py-2 text-slate-400 text-[10px] font-bold">{m.jenis_anggota}</td>
                                    <td className="py-2 text-right">
                                      <button className="text-red-500 hover:text-red-700 font-extrabold text-[10px]" onClick={() => handleRemoveMember(m.anggota_id)} title="Keluarkan dari keluarga">
                                        Hapus
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions button */}
                    <div>
                      <button className="flex items-center justify-center gap-1.5 w-full py-2 px-3 font-bold text-[10px] bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary rounded-lg transition-all border border-slate-100" onClick={() => openAddMemberModal(f.id)}>
                        <Plus size={12} />
                        <span>Tambah Anggota Keluarga</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) ) : (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xl font-bold text-slate-800">{totalActive}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jamaah Aktif</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pastel-green text-pastel-green-text flex items-center justify-center shrink-0">
                    <CheckCircle size={20} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xl font-bold text-pastel-green-text">
                      {totalActive > 0 ? Math.round((maleCount / totalActive) * 100) : 0}%
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Laki-laki ({maleCount})</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xl font-bold text-pink-500">
                      {totalActive > 0 ? Math.round((femaleCount / totalActive) * 100) : 0}%
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Perempuan ({femaleCount})</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pastel-yellow text-pastel-yellow-text flex items-center justify-center shrink-0">
                    <Home size={20} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xl font-bold text-pastel-yellow-text">{totalKeluarga}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Unit Keluarga</span>
                  </div>
                </div>
              </div>

              {/* Distributions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {/* Kategori Distribution */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Kategori Usia</h3>
                  <div className="flex flex-col gap-3">
                    {kategoriStats.map(([kategori, count]) => {
                      const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                      return (
                        <div key={kategori} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{kategori}</span>
                            <span>{count} orang ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pendidikan Distribution */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Pendidikan Terakhir</h3>
                  <div className="flex flex-col gap-3">
                    {pendidikanStats.map(([edu, count]) => {
                      const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                      return (
                        <div key={edu} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{edu}</span>
                            <span>{count} orang ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Kelompok Distribution */}
                <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5">
                  <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Per Kelompok</h3>
                  <div className="flex flex-col gap-3">
                    {kelompokStats.map(([kel, count]) => {
                      const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                      return (
                        <div key={kel} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{kel}</span>
                            <span>{count} orang ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary-hover h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desa & Goldar Distribution */}
                <div className="flex flex-col gap-6">
                  {/* Desa Stats */}
                  <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex-1">
                    <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Per Wilayah Desa</h3>
                    <div className="flex flex-col gap-3">
                      {desaStats.map(([ds, count]) => {
                        const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                        return (
                          <div key={ds} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                              <span>Desa {ds}</span>
                              <span>{count} orang ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Goldar Stats */}
                  <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex-1">
                    <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Golongan Darah</h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      {['A', 'B', 'AB', 'O'].map(type => {
                        const count = statsActiveJamaah.filter(j => j.golongan_darah === type).length;
                        const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                        return (
                          <div key={type} className="border border-slate-100 rounded-xl p-3 bg-slate-50/30">
                            <span className="text-xs font-black text-slate-500 block mb-1">{type}</span>
                            <span className="text-lg font-bold text-slate-800 block">{count}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-1">({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </div>

      {/* ========================================== MODALS ========================================== */}

      {/* 1. Jamaah Form Modal */}
      {isJamaahModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">
                {selectedJamaahId ? 'Ubah Data Jamaah' : 'Tambah Jamaah Baru'}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeJamaahModal}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form id="jamaah-form" onSubmit={handleJamaahSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-nama" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Lengkap</label>
                  <input 
                    type="text" 
                    id="form-nama" 
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    required 
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-gender" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jenis Kelamin</label>
                    <select 
                      id="form-gender" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value)}
                      required
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-birthplace" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tempat Lahir</label>
                    <input 
                      type="text" 
                      id="form-birthplace" 
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold" 
                      value={formBirthplace}
                      onChange={(e) => setFormBirthplace(e.target.value)}
                      required 
                      placeholder="Kota kelahiran"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-desa" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Wilayah Desa</label>
                    {user.role === 'Super Admin' ? (
                      <select 
                        id="form-desa" 
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                        value={formDesa}
                        onChange={(e) => setFormDesa(e.target.value)}
                        required
                      >
                        <option value="Andara">Andara</option>
                        <option value="Bojong">Bojong</option>
                        <option value="Cisadane">Cisadane</option>
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        id="form-desa" 
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 font-semibold outline-none cursor-not-allowed text-xs" 
                        value={formDesa}
                        disabled 
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-kelompok" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kelompok Pengajian</label>
                    <select 
                      id="form-kelompok" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formKelompok}
                      onChange={(e) => setFormKelompok(e.target.value)}
                      required
                    >
                      <option value="Andara 1">Andara 1</option>
                      <option value="Andara 2">Andara 2</option>
                      <option value="Andara 3">Andara 3</option>
                      <option value="Andara 4">Andara 4</option>
                      <option value="Andara 5">Andara 5</option>
                      <option value="Lain-lain">Lain-lain</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-blood" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Golongan Darah</label>
                    <select 
                      id="form-blood" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formBlood}
                      onChange={(e) => setFormBlood(e.target.value)}
                      required
                    >
                      <option value="O">O</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-status" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Kehidupan</label>
                    <select 
                      id="form-status" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      required
                    >
                      <option value="Hidup">Hidup</option>
                      <option value="Meninggal">Meninggal</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-kategori" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kategori</label>
                    <select 
                      id="form-kategori" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formKategori}
                      onChange={(e) => setFormKategori(e.target.value)}
                      required
                    >
                      <option value="Balita">Balita</option>
                      <option value="CBR/PAUD">CBR/PAUD</option>
                      <option value="Pra Remaja">Pra Remaja</option>
                      <option value="Remaja">Remaja</option>
                      <option value="Pra Nikah">Pra Nikah</option>
                      <option value="Dewasa">Dewasa</option>
                      <option value="Lansia">Lansia</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-education" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendidikan Terakhir</label>
                    <select 
                      id="form-education" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formEducation}
                      onChange={(e) => setFormEducation(e.target.value)}
                      required
                    >
                      <option value="Tidak Sekolah">Tidak Sekolah</option>
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                      <option value="S1">S1</option>
                      <option value="S2">S2</option>
                      <option value="S3">S3</option>
                    </select>
                  </div>
                </div>
                {formEducation !== 'Tidak Sekolah' && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-grad-date" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal Lulus</label>
                    <input 
                      type="date" 
                      id="form-grad-date" 
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold"
                      value={formGradDate}
                      onChange={(e) => setFormGradDate(e.target.value)}
                      required
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-4">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-all" onClick={closeJamaahModal}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. Keluarga Baru Modal */}
      {isKeluargaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">Buat Keluarga Baru</h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={() => setIsKeluargaModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 mb-4 font-semibold leading-relaxed">
                Keluarga baru akan dinamai otomatis berdasarkan <strong>Kepala Keluarga</strong> yang dipilih.
              </p>
              <form id="keluarga-form" onSubmit={handleKeluargaSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-fam-kk" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Kepala Keluarga</label>
                  <select 
                    id="form-fam-kk" 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-bold cursor-pointer"
                    value={selectedKkId}
                    onChange={(e) => setSelectedKkId(e.target.value)}
                    required
                  >
                    {unassociatedJamaahForModal.map(j => (
                      <option key={j.id} value={j.id}>{j.nama_lengkap} ({j.desa} - {j.kelompok})</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-2">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all" onClick={() => setIsKeluargaModalOpen(false)}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Tambah Anggota Keluarga Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">Tambah Anggota Keluarga</h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={() => setIsMemberModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <h4 className="font-bold text-slate-800 text-sm mb-4 leading-tight">
                {keluargaList.find(f => f.id === selectedKeluargaId)?.nama_keluarga}
              </h4>
              <form id="member-form" onSubmit={handleMemberSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-memb-jamaah" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Jamaah</label>
                  <select 
                    id="form-memb-jamaah" 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-bold cursor-pointer"
                    value={selectedMemberJamaahId}
                    onChange={(e) => setSelectedMemberJamaahId(e.target.value)}
                    required
                  >
                    {unassociatedJamaahForModal.map(j => (
                      <option key={j.id} value={j.id}>{j.nama_lengkap} ({j.desa} - {j.kelompok})</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-memb-rel" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hubungan / Jenis Anggota</label>
                  <select 
                    id="form-memb-rel" 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-bold cursor-pointer"
                    value={selectedMemberRel}
                    onChange={(e) => setSelectedMemberRel(e.target.value)}
                    required
                  >
                    {!keluargaList.find(f => f.id === selectedKeluargaId)?.anggota.some(m => m.jenis_anggota === 'Kepala Keluarga') && (
                      <option value="Kepala Keluarga">Kepala Keluarga</option>
                    )}
                    <option value="Istri">Istri</option>
                    <option value="Anak">Anak</option>
                    <option value="Ayah">Ayah</option>
                    <option value="Ibu">Ibu</option>
                    <option value="Ayah Mertua">Ayah Mertua</option>
                    <option value="Ibu Mertua">Ibu Mertua</option>
                    <option value="Famili Lain">Famili Lain</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-5 mt-2">
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all" onClick={() => setIsMemberModalOpen(false)}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. QR Code & Membership Card Modal */}
      {isQrModalOpen && selectedQrJamaah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn print:bg-white print:p-0">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-xl w-full animate-scaleIn print:shadow-none print:border-none print:max-w-none print:w-auto">
            {/* Header (Hidden on Print) */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 print:hidden">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Kartu Anggota & QR Code Kehadiran</h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={handleCloseQrModal}>
                <X size={18} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 flex flex-col items-center gap-6">
              {/* Card Container for Printing */}
              <div 
                id="print-card-area" 
                className="w-[380px] h-[240px] bg-gradient-to-br from-teal-800 to-emerald-950 text-white rounded-2xl p-5 flex flex-col justify-between shadow-md relative overflow-hidden border border-teal-700/30 print:shadow-none print:border print:rounded-2xl"
              >
                {/* Decorative circles */}
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-white/5 pointer-events-none"></div>
                <div className="absolute -left-10 -bottom-10 w-24 h-24 rounded-full bg-white/5 pointer-events-none"></div>
                
                {/* Card Top */}
                <div className="flex justify-between items-start border-b border-white/10 pb-3 z-10">
                  <div className="text-left">
                    <h3 className="text-sm font-extrabold tracking-tight uppercase text-teal-300">KARTU PRESENSI JAMAAH</h3>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black">
                    A
                  </div>
                </div>
 
                {/* Card Middle (Info & QR) */}
                <div className="flex justify-between items-center my-auto gap-4 z-10">
                  {/* Left: Info */}
                  <div className="text-left flex flex-col gap-2 min-w-0">
                    <div className="mb-1">
                      <span className="text-sm font-black truncate block text-white max-w-[210px]">{selectedQrJamaah.nama_lengkap}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div>
                        <span className="text-[6px] font-bold text-teal-300 uppercase tracking-wider block">Desa</span>
                        <span className="text-[9px] font-bold text-white truncate block">{selectedQrJamaah.desa}</span>
                      </div>
                      <div>
                        <span className="text-[6px] font-bold text-teal-300 uppercase tracking-wider block">Kelompok</span>
                        <span className="text-[9px] font-bold text-white truncate block">{selectedQrJamaah.kelompok}</span>
                      </div>
                    </div>
                  </div>
 
                  {/* Right: QR Code */}
                  <div className="bg-white p-1.5 rounded-lg shrink-0 shadow-sm">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                        typeof window !== 'undefined' 
                          ? `${window.location.origin}/dashboard/presensi/scan?jamaah_id=${selectedQrJamaah.id}`
                          : `http://localhost:3000/dashboard/presensi/scan?jamaah_id=${selectedQrJamaah.id}`
                      )}`} 
                      alt="QR Code" 
                      className="w-[90px] h-[90px]"
                    />
                  </div>
                </div>
 
                {/* Card Footer */}
                <div className="text-center text-[7.5px] font-extrabold text-teal-300 border-t border-white/10 pt-2.5 z-10 uppercase tracking-widest">
                  Harap Dibawa Saat Pengajian
                </div>
              </div>
 
              {/* Instructions (Hidden on Print) */}
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed text-center px-4 print:hidden">
                Gunakan tombol cetak di bawah untuk mencetak kartu anggota. Cetak kartu ini di atas kertas tebal (Art Paper atau PVC) agar dapat dipindai oleh Moderator saat pengajian berlangsung.
              </p>
 
              {/* Actions (Hidden on Print) */}
              <div className="flex justify-end gap-2.5 w-full border-t border-slate-100 pt-4 print:hidden">
                <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all" onClick={handleCloseQrModal}>Tutup</button>
                <button type="button" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all flex items-center gap-1.5" onClick={() => window.print()}>
                  <Download size={14} />
                  <span>Cetak Kartu</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Printable CSS Override */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-card-area, #print-card-area * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #print-card-area {
                position: fixed !important;
                left: 50% !important;
                top: 50% !important;
                transform: translate(-50%, -50%) scale(1.3) !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: 1px solid #115e59 !important;
              }
            }
          `}} />
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
