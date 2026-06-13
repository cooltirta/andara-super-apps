"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

export default function LokasiManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isDesaModalOpen, setIsDesaModalOpen] = useState(false);
  const [selectedDesa, setSelectedDesa] = useState(null); // null means ADD, otherwise EDIT
  const [formDesaName, setFormDesaName] = useState('');

  const [isKelompokModalOpen, setIsKelompokModalOpen] = useState(false);
  const [selectedKelompok, setSelectedKelompok] = useState(null); // null means ADD, otherwise EDIT
  const [selectedDesaForKelompok, setSelectedDesaForKelompok] = useState(null); // parent Desa when ADDing groups
  const [formKelompokName, setFormKelompokName] = useState('');

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

      if (currentUser.role !== 'Admin' && currentUser.role !== 'Super Admin') {
        showToast("Akses Ditolak: Anda tidak memiliki akses ke Manajemen Lokasi", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      await fetchLocations();
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
        setLocations(await res.json());
      } else {
        throw new Error("Gagal mengambil data lokasi");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isSuperAdmin = user?.role === 'Super Admin';

  // Desa Modal Triggers
  const openDesaModal = (desa = null) => {
    if (!isSuperAdmin) return;
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

  // Kelompok Modal Triggers
  const openKelompokModal = (kelompok = null, parentDesa = null) => {
    if (!isSuperAdmin) return;
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

  // Submit Desa
  const handleDesaSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

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

  // Delete Desa
  const handleDeleteDesa = async (desa) => {
    if (!isSuperAdmin) return;
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

  // Submit Kelompok
  const handleKelompokSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

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

  // Delete Kelompok
  const handleDeleteKelompok = async (kelompok) => {
    if (!isSuperAdmin) return;
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

  if (!user || (user.role !== 'Admin' && user.role !== 'Super Admin')) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Manajemen Lokasi Master
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Kelola master data Desa dan Kelompok pengajian untuk data input aplikasi
          </p>
        </div>
        {isSuperAdmin && (
          <button 
            id="btn-tambah-desa"
            onClick={() => openDesaModal()}
            className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Desa</span>
          </button>
        )}
      </div>

      {/* Role Notice */}
      {!isSuperAdmin && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-left text-xs font-bold text-amber-700 flex items-center gap-2.5 mb-6">
          <Info size={18} className="text-amber-600 shrink-0" />
          <span>Anda berada dalam mode Read-Only (Akses Desa). Hanya Super Admin yang memiliki hak akses penuh untuk melakukan perubahan master data lokasi.</span>
        </div>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <MapPin size={44} className="opacity-40 mb-4" />
          <p className="font-bold text-sm">Belum ada data lokasi master dibuat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map(desa => (
            <div key={desa.id} className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col justify-between min-h-[300px] hover:shadow-md transition-all duration-200">
              <div>
                {/* Desa Item Header */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-primary" />
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">Desa {desa.nama_desa}</h3>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        className="text-slate-400 hover:text-primary p-1.5 rounded-lg hover:bg-slate-50 transition-all"
                        onClick={() => openDesaModal(desa)}
                        title="Edit Nama Desa"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-50 transition-all"
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
                          {isSuperAdmin && (
                            <div className="flex items-center gap-1">
                              <button 
                                className="text-slate-400 hover:text-primary p-1 rounded hover:bg-white/80 transition-all"
                                onClick={() => openKelompokModal(kelompok, desa)}
                                title="Edit Nama Kelompok"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-white/80 transition-all"
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
              {isSuperAdmin && (
                <div>
                  <button 
                    onClick={() => openKelompokModal(null, desa)}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 font-bold text-[10px] bg-slate-50 hover:bg-primary-light text-slate-655 hover:text-primary rounded-lg transition-all border border-slate-100"
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

      {/* ========================================== MODALS ========================================== */}

      {/* 1. Desa Modal */}
      {isDesaModalOpen && isSuperAdmin && (
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
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all" onClick={closeDesaModal}>Batal</button>
                  <button type="submit" className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. Kelompok Modal */}
      {isKelompokModalOpen && isSuperAdmin && (
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
                  <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all" onClick={closeKelompokModal}>Batal</button>
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
