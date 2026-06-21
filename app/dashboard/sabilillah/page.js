"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Search, Edit2, Trash2, Plus, Download, X, Save, RefreshCw, ClipboardList, CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react';

export default function BendaSabilillahPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('barang'); // 'barang' or 'peminjaman'

  // Data lists
  const [barangList, setBarangList] = useState([]);
  const [peminjamanList, setPeminjamanList] = useState([]);
  const [locations, setLocations] = useState([]);

  // Filters
  const [searchBarang, setSearchBarang] = useState('');
  const [searchPeminjam, setSearchPeminjam] = useState('');

  // Modals state
  const [isBarangModalOpen, setIsBarangModalOpen] = useState(false);
  const [selectedBarangId, setSelectedBarangId] = useState(null); // null means ADD, otherwise EDIT
  const [formNamaBarang, setFormNamaBarang] = useState('');
  const [formJumlahTotal, setFormJumlahTotal] = useState(0);
  const [formTempatSimpan, setFormTempatSimpan] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formDesa, setFormDesa] = useState('Andara');
  const [formKelompok, setFormKelompok] = useState('Andara 1');

  const [isPinjamModalOpen, setIsPinjamModalOpen] = useState(false);
  const [formPinjamBarangId, setFormPinjamBarangId] = useState('');
  const [formPeminjamNama, setFormPeminjamNama] = useState('');
  const [formJumlahPinjam, setFormJumlahPinjam] = useState(1);
  const [formTujuanPinjam, setFormTujuanPinjam] = useState('');
  const [formTanggalKembaliRencana, setFormTanggalKembaliRencana] = useState('');

  const [updating, setUpdating] = useState(false);
  const fileInputRef = useRef(null);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchAuthAndData = async () => {
    try {
      setLoading(true);
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) throw new Error("Unauthenticated");
      const currentUser = await authRes.json();
      setUser(currentUser);

      if (currentUser.role === 'Member') {
        alert("Akses Ditolak: Halaman ini hanya untuk pengurus SB");
        router.push('/dashboard');
        return;
      }

      // Fetch Locations Tree
      const locRes = await fetch('/api/lokasi');
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData);
        if (locData.length > 0) {
          setFormDesa(locData[0].nama_desa);
          if (locData[0].kelompoks.length > 0) {
            setFormKelompok(locData[0].kelompoks[0].nama_kelompok);
          }
        }
      }

      await loadAllData();
      setLoading(false);
    } catch (err) {
      console.error(err);
      router.push('/login?callbackUrl=/dashboard/sabilillah');
    }
  };

  const loadAllData = async () => {
    // Fetch Barang
    const barangRes = await fetch('/api/sabilillah/barang');
    if (barangRes.ok) {
      const bData = await barangRes.json();
      setBarangList(bData);
    }

    // Fetch Peminjaman
    const pinjamRes = await fetch('/api/sabilillah/peminjaman');
    if (pinjamRes.ok) {
      const pData = await pinjamRes.json();
      setPeminjamanList(pData);
    }
  };

  useEffect(() => {
    fetchAuthAndData();
  }, []);

  // Sync groups based on selected village in modal form
  useEffect(() => {
    if (formDesa && locations.length > 0) {
      const selectedDesaObj = locations.find(d => d.nama_desa === formDesa);
      if (selectedDesaObj && selectedDesaObj.kelompoks.length > 0) {
        const groupNames = selectedDesaObj.kelompoks.map(k => k.nama_kelompok);
        if (!groupNames.includes(formKelompok)) {
          setFormKelompok(groupNames[0]);
        }
      }
    }
  }, [formDesa, locations]);

  // Image Upload helper
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setFormFotoUrl(base64);
        showToast("Foto barang berhasil dimuat", "success");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const openBarangModal = (id = null) => {
    setSelectedBarangId(id);
    if (id) {
      const b = barangList.find(x => x.id === id);
      setFormNamaBarang(b.nama_barang);
      setFormJumlahTotal(b.jumlah_total);
      setFormTempatSimpan(b.tempat_simpan);
      setFormFotoUrl(b.foto_url || '');
      setFormKeterangan(b.keterangan || '');
      setFormDesa(b.desa);
      setFormKelompok(b.kelompok);
    } else {
      setFormNamaBarang('');
      setFormJumlahTotal(0);
      setFormTempatSimpan('');
      setFormFotoUrl('');
      setFormKeterangan('');
      if (locations.length > 0) {
        setFormDesa(locations[0].nama_desa);
        if (locations[0].kelompoks.length > 0) {
          setFormKelompok(locations[0].kelompoks[0].nama_kelompok);
        }
      }
    }
    setIsBarangModalOpen(true);
  };

  const handleSaveBarang = async (e) => {
    e.preventDefault();
    setUpdating(true);

    const payload = {
      nama_barang: formNamaBarang,
      jumlah_total: formJumlahTotal,
      tempat_simpan: formTempatSimpan,
      foto_url: formFotoUrl || null,
      keterangan: formKeterangan || null,
      desa: formDesa,
      kelompok: formKelompok
    };

    try {
      const url = selectedBarangId ? `/api/sabilillah/barang/${selectedBarangId}` : '/api/sabilillah/barang';
      const method = selectedBarangId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan barang");

      showToast("Data barang sabilillah berhasil disimpan", "success");
      setIsBarangModalOpen(false);
      await loadAllData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteBarang = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus barang ini?")) return;

    try {
      const res = await fetch(`/api/sabilillah/barang/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus barang");

      showToast("Barang berhasil dihapus", "success");
      await loadAllData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const openPinjamModal = () => {
    if (barangList.length === 0) {
      showToast("Tambahkan barang ke inventaris terlebih dahulu", "error");
      return;
    }
    setFormPinjamBarangId(barangList[0].id);
    setFormPeminjamNama('');
    setFormJumlahPinjam(1);
    setFormTujuanPinjam('');
    setFormTanggalKembaliRencana('');
    setIsPinjamModalOpen(true);
  };

  const handleCreatePeminjaman = async (e) => {
    e.preventDefault();
    setUpdating(true);

    const payload = {
      barang_id: formPinjamBarangId,
      peminjam_nama: formPeminjamNama,
      jumlah_pinjam: formJumlahPinjam,
      tujuan_pinjam: formTujuanPinjam,
      tanggal_kembali_rencana: formTanggalKembaliRencana
    };

    try {
      const res = await fetch('/api/sabilillah/peminjaman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan peminjaman");

      showToast("Peminjaman barang berhasil dicatat", "success");
      setIsPinjamModalOpen(false);
      await loadAllData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleReturnBarang = async (id) => {
    if (!confirm("Apakah Anda yakin barang sudah dikembalikan?")) return;

    try {
      const res = await fetch(`/api/sabilillah/peminjaman/${id}`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses pengembalian");

      showToast("Barang berhasil dikembalikan!", "success");
      await loadAllData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Filter lists
  const filteredBarang = barangList.filter(b => 
    b.nama_barang.toLowerCase().includes(searchBarang.toLowerCase().trim()) ||
    b.tempat_simpan.toLowerCase().includes(searchBarang.toLowerCase().trim())
  );

  const filteredPeminjaman = peminjamanList.filter(p => 
    p.peminjam_nama.toLowerCase().includes(searchPeminjam.toLowerCase().trim()) ||
    p.nama_barang.toLowerCase().includes(searchPeminjam.toLowerCase().trim())
  );

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-9 h-9 text-primary animate-spin" />
          <h2 className="text-xs font-bold text-slate-400 tracking-wider">Memuat Inventaris Sabilillah...</h2>
        </div>
      </div>
    );
  }

  // Find available stock for the current selected item in borrow modal
  const selectedPinjamBarang = barangList.find(b => b.id === formPinjamBarangId);
  const maxAvailable = selectedPinjamBarang ? selectedPinjamBarang.stok_tersedia : 0;

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Package className="text-primary w-7 h-7" />
            <span>Tim Benda Sabilillah (SB)</span>
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Pendataan inventaris barang milik kelompok/desa dan pengelolaan formulir pinjam-pakai digital
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => openBarangModal()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Barang</span>
          </button>

          <button 
            onClick={openPinjamModal}
            className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <ClipboardList size={14} className="text-primary" />
            <span>Catat Peminjaman</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-slate-100 mb-6 gap-6">
        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'barang' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          onClick={() => setActiveTab('barang')}
        >
          Daftar Barang SB
        </button>

        <button 
          className={`py-3 px-1 font-bold text-sm cursor-pointer border-b-2 transition-all ${
            activeTab === 'peminjaman' 
              ? 'text-primary border-primary' 
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`} 
          onClick={() => setActiveTab('peminjaman')}
        >
          Peminjaman &amp; Log SB
        </button>
      </div>

      {/* TAB 1: BARANG SABILILLAH */}
      {activeTab === 'barang' && (
        <>
          {/* Search bar */}
          <div className="relative max-w-md w-full mb-6">
            <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari barang atau tempat penyimpanan..." 
              value={searchBarang}
              onChange={(e) => setSearchBarang(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700 shadow-sm"
            />
          </div>

          {filteredBarang.length === 0 ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Package size={40} className="opacity-30 mb-4 animate-pulse" />
              <p className="font-bold text-sm">Tidak ada barang inventaris ditemukan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBarang.map(b => (
                <div key={b.id} className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200">
                  {/* Photo area */}
                  <div className="w-full h-44 rounded-xl bg-slate-50 border border-slate-150 overflow-hidden flex items-center justify-center relative mb-4">
                    {b.foto_url ? (
                      <img src={b.foto_url} alt={b.nama_barang} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-350">
                        <Package size={36} className="opacity-30" />
                        <span className="text-[9px] font-extrabold tracking-widest mt-1.5 uppercase">NO PHOTO</span>
                      </div>
                    )}

                    {/* Stock available badge */}
                    <div className={`absolute bottom-3 right-3 px-3 py-1 rounded-full text-[9px] font-black border ${
                      b.stok_tersedia > 0 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' 
                        : 'bg-red-50 text-red-500 border-red-200/50'
                    }`}>
                      TERSEDIA: {b.stok_tersedia} / {b.jumlah_total}
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm text-slate-800 truncate" title={b.nama_barang}>
                      {b.nama_barang}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                      Penyimpanan: <span className="text-slate-650 font-extrabold">{b.tempat_simpan}</span>
                    </span>
                    <span className="text-[9.5px] font-bold text-slate-400 block uppercase mt-0.5">
                      Wilayah: {b.kelompok} ({b.desa})
                    </span>

                    <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-2 line-clamp-2">
                      {b.keterangan || '-'}
                    </p>
                  </div>

                  {/* Footer actions */}
                  <div className="flex justify-end gap-2 border-t border-slate-50 pt-3 mt-4">
                    <button 
                      onClick={() => openBarangModal(b.id)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-600 hover:text-primary transition-all border border-slate-200/40 cursor-pointer"
                      title="Edit Barang"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={() => handleDeleteBarang(b.id)}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-100/30 cursor-pointer"
                      title="Hapus Barang"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: LOG PEMINJAMAN SABILILLAH */}
      {activeTab === 'peminjaman' && (
        <>
          {/* Search bar */}
          <div className="relative max-w-md w-full mb-6">
            <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari nama peminjam atau barang..." 
              value={searchPeminjam}
              onChange={(e) => setSearchPeminjam(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700 shadow-sm"
            />
          </div>

          {filteredPeminjaman.length === 0 ? (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <ClipboardList size={40} className="opacity-30 mb-4 animate-pulse text-primary" />
              <p className="font-bold text-sm">Tidak ada riwayat peminjaman ditemukan.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Barang &amp; Penyimpanan</th>
                      <th className="px-6 py-4">Peminjam</th>
                      <th className="px-6 py-4 text-center">Jumlah Pinjam</th>
                      <th className="px-6 py-4">Tujuan Penggunaan</th>
                      <th className="px-6 py-4">Tanggal Peminjaman</th>
                      <th className="px-6 py-4">Estimasi Pengembalian</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPeminjaman.map(p => {
                      const isBorrowed = p.status === 'Dipinjam';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                          <td className="px-6 py-4 leading-tight">
                            <div className="font-bold text-slate-800">{p.nama_barang}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">Simpan: {p.tempat_simpan}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">{p.peminjam_nama}</td>
                          <td className="px-6 py-4 text-center font-bold text-slate-700">{p.jumlah_pinjam} pcs</td>
                          <td className="px-6 py-4 font-medium text-slate-600 italic">"{p.tujuan_pinjam}"</td>
                          <td className="px-6 py-4 text-slate-500 font-mono">{p.tanggal_pinjam || '-'}</td>
                          <td className="px-6 py-4 leading-tight">
                            <div className="font-mono text-slate-500">{p.tanggal_kembali_rencana}</div>
                            {!isBorrowed && p.tanggal_kembali_aktual && (
                              <div className="text-[9.5px] text-emerald-500 font-bold font-mono mt-0.5">Kembali: {p.tanggal_kembali_aktual.slice(0, 10)}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isBorrowed 
                                ? 'bg-amber-50 text-amber-500 border border-amber-250/20 animate-pulse' 
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-250/20'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isBorrowed ? (
                              <button 
                                onClick={() => handleReturnBarang(p.id)}
                                className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all text-[10px] font-bold border border-emerald-200/50 cursor-pointer"
                              >
                                Kembalikan
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                <span>Selesai</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-slate-100 bg-white">
                {filteredPeminjaman.map(p => {
                  const isBorrowed = p.status === 'Dipinjam';
                  return (
                    <div key={p.id} className="p-4 flex flex-col gap-2.5 hover:bg-slate-50/30 transition-colors text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-800">{p.nama_barang}</span>
                          <span className="text-[10px] text-slate-400 font-bold">Peminjam: {p.peminjam_nama} ({p.jumlah_pinjam} pcs)</span>
                        </div>

                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isBorrowed 
                            ? 'bg-amber-50 text-amber-500 border border-amber-150 animate-pulse' 
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-150'
                        }`}>
                          {p.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed text-left bg-slate-50 p-2 rounded-lg">
                        Tujuan: "{p.tujuan_pinjam}"
                      </p>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-50 font-semibold">
                        <div className="flex flex-col">
                          <span>Pinjam: <span className="font-mono text-slate-600">{p.tanggal_pinjam?.slice(0, 10) || '-'}</span></span>
                          <span>Kembali: <span className="font-mono text-slate-650">{p.tanggal_kembali_rencana}</span></span>
                        </div>

                        {isBorrowed ? (
                          <button 
                            onClick={() => handleReturnBarang(p.id)}
                            className="py-1 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all text-[10px] font-bold border border-emerald-200/50 cursor-pointer"
                          >
                            Kembalikan
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
                            <CheckCircle2 size={12} />
                            <span>Selesai</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 1. Modal Tambah/Edit Barang */}
      {isBarangModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <form 
            onSubmit={handleSaveBarang}
            className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                {selectedBarangId ? "Ubah Data Barang" : "Tambah Inventaris Barang Baru"}
              </h2>
              <button 
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" 
                onClick={() => setIsBarangModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {formFotoUrl ? (
                    <img src={formFotoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-slate-350 opacity-40 w-6 h-6" />
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">FOTO BARANG (OPSIONAL)</span>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 cursor-pointer transition-all shadow-sm"
                    >
                      Pilih Foto
                    </button>
                    {formFotoUrl && (
                      <button 
                        type="button"
                        onClick={() => setFormFotoUrl('')}
                        className="py-1.5 px-3 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 text-[10px] font-bold text-red-650 cursor-pointer transition-all"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Nama Barang */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">NAMA BARANG</label>
                <input 
                  type="text" 
                  placeholder="Misal: Piring Sendok Gelas Kursi..."
                  value={formNamaBarang}
                  onChange={(e) => setFormNamaBarang(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
              </div>

              {/* Jumlah Total */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">JUMLAH STOK TOTAL</label>
                <input 
                  type="number" 
                  min={0}
                  value={formJumlahTotal}
                  onChange={(e) => setFormJumlahTotal(parseInt(e.target.value, 10) || 0)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
              </div>

              {/* Lokasi Simpan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">TEMPAT PENYIMPANAN</label>
                <input 
                  type="text" 
                  placeholder="Misal: Lemari Masjid lt.2, Gudang RW 05..."
                  value={formTempatSimpan}
                  onChange={(e) => setFormTempatSimpan(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
              </div>

              {/* Desa */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">DESA KEPEMILIKAN</label>
                <select 
                  value={formDesa}
                  onChange={(e) => setFormDesa(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-bold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                >
                  {locations.map(d => (
                    <option key={d.nama_desa} value={d.nama_desa}>{d.nama_desa}</option>
                  ))}
                </select>
              </div>

              {/* Kelompok */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">KELOMPOK KEPEMILIKAN</label>
                <select 
                  value={formKelompok}
                  onChange={(e) => setFormKelompok(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-bold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                >
                  {(locations.find(d => d.nama_desa === formDesa)?.kelompoks.map(k => k.nama_kelompok) || []).map(kName => (
                    <option key={kName} value={kName}>{kName}</option>
                  ))}
                </select>
              </div>

              {/* Keterangan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">KETERANGAN / SPESIFIKASI</label>
                <textarea 
                  rows={3}
                  placeholder="Isi warna, kondisi barang, dsb..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsBarangModalOpen(false)}
                className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={updating}
                className="flex items-center gap-1.5 py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={13} />
                <span>{updating ? "Menyimpan..." : "Simpan Barang"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Modal Catat Peminjaman */}
      {isPinjamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <form 
            onSubmit={handleCreatePeminjaman}
            className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Catat Peminjaman Barang SB</h2>
              <button 
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" 
                onClick={() => setIsPinjamModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-4">
              {/* Pilih Barang */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">BARANG YANG INGIN DIPINJAM</label>
                <select 
                  value={formPinjamBarangId}
                  onChange={(e) => {
                    setFormPinjamBarangId(e.target.value);
                    setFormJumlahPinjam(1);
                  }}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-bold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                >
                  {barangList.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.nama_barang} (Tersedia: {b.stok_tersedia} / {b.jumlah_total} unit - {b.tempat_simpan})
                    </option>
                  ))}
                </select>
              </div>

              {/* Nama Peminjam */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">NAMA LENGKAP PEMINJAM</label>
                <input 
                  type="text" 
                  placeholder="Ketik nama jamaah / kelompok / organisasi peminjam..."
                  value={formPeminjamNama}
                  onChange={(e) => setFormPeminjamNama(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
              </div>

              {/* Jumlah Pinjam */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">JUMLAH YANG DIPINJAM</label>
                <input 
                  type="number" 
                  min={1}
                  max={maxAvailable}
                  value={formJumlahPinjam}
                  onChange={(e) => setFormJumlahPinjam(parseInt(e.target.value, 10) || 1)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
                <span className="text-[9.5px] text-slate-400 font-bold block">
                  Batas kuantitas maksimal pinjam: <span className="text-primary font-extrabold">{maxAvailable} unit</span>
                </span>
              </div>

              {/* Tujuan Pinjam */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">TUJUAN PEMINJAMAN</label>
                <input 
                  type="text" 
                  placeholder="Misal: Acara Walimahan kelompok 2, Ta'lim Akbar..."
                  value={formTujuanPinjam}
                  onChange={(e) => setFormTujuanPinjam(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
              </div>

              {/* Estimasi Pengembalian */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">ESTIMASI TANGGAL PENGEMBALIAN</label>
                <input 
                  type="text" 
                  placeholder="Contoh: 2026-06-25 atau 3 hari lagi"
                  value={formTanggalKembaliRencana}
                  onChange={(e) => setFormTanggalKembaliRencana(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  required
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsPinjamModalOpen(false)}
                className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={updating || maxAvailable === 0}
                className="flex items-center gap-1.5 py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={13} />
                <span>{updating ? "Menyimpan..." : "Simpan Formulir Pinjam"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Toast Alerts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto p-4 rounded-xl border flex items-center gap-3 shadow-lg animate-slideIn ${
              t.type === 'success' 
                ? 'bg-emerald-50 border-emerald-150 text-emerald-700' 
                : t.type === 'error'
                ? 'bg-red-50 border-red-150 text-red-700'
                : 'bg-slate-50 border-slate-150 text-slate-700'
            }`}
          >
            <div className="w-2 shrink-0" />
            <span className="text-xs font-bold leading-relaxed">{t.message}</span>
            <button className="ml-auto p-1 rounded-lg hover:bg-slate-100/50 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
