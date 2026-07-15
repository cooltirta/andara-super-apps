"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Search, Edit2, Download, RefreshCw, X, Check, Save } from 'lucide-react';

export default function TimHajiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [jamaahList, setJamaahList] = useState([]);
  const [locations, setLocations] = useState([]);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterStatusHaji, setFilterStatusHaji] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedJamaah, setSelectedJamaah] = useState(null);
  const [formStatusHaji, setFormStatusHaji] = useState('Belum Haji');
  const [formTanggalHaji, setFormTanggalHaji] = useState('');

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
      // 1. Fetch User Session
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) throw new Error("Unauthenticated");
      const currentUser = await authRes.json();
      setUser(currentUser);

      if (!currentUser.can_read_haji) {
        alert("Akses Ditolak: Anda tidak memiliki akses ke data Haji");
        router.push('/dashboard');
        return;
      }

      // 2. Fetch Locations Tree
      const locRes = await fetch('/api/lokasi');
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData);
      }

      // 3. Fetch Jamaah List
      const jamRes = await fetch('/api/jamaah');
      if (jamRes.ok) {
        const jamData = await jamRes.json();
        setJamaahList(jamData);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      router.push('/login?callbackUrl=/dashboard/haji');
    }
  };

  useEffect(() => {
    fetchAuthAndData();
  }, []);

  const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return '';
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age + ' Tahun';
  };

  const handleEditClick = (j) => {
    setSelectedJamaah(j);
    setFormStatusHaji(j.status_haji || 'Belum Haji');
    setFormTanggalHaji(j.tanggal_keberangkatan_haji || '');
    setIsEditModalOpen(true);
  };

  const handleSaveHaji = async (e) => {
    e.preventDefault();
    if (!selectedJamaah) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/jamaah/${selectedJamaah.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status_haji: formStatusHaji,
          tanggal_keberangkatan_haji: formStatusHaji === 'Belum Haji' ? null : formTanggalHaji
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui status haji");

      showToast("Data status haji berhasil disimpan", "success");
      setIsEditModalOpen(false);
      fetchAuthAndData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  // Export filtered data as CSV
  const handleExportCsv = () => {
    if (filteredList.length === 0) {
      showToast("Tidak ada data untuk diekspor", "error");
      return;
    }

    const headers = ["Nama Lengkap", "Gender", "Usia", "Desa", "Kelompok", "Status Haji", "Tanggal Keberangkatan"];
    const rows = filteredList.map(j => [
      j.nama_lengkap,
      j.jenis_kelamin,
      j.tanggal_lahir ? calculateAge(j.tanggal_lahir) : '-',
      j.desa,
      j.kelompok,
      j.status_haji || 'Belum Haji',
      j.tanggal_keberangkatan_haji || '-'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Tim_Haji_SB_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Berhasil mengekspor laporan CSV", "success");
  };

  // Filter Logic
  const filteredList = jamaahList.filter(j => {
    const matchName = j.nama_lengkap.toLowerCase().includes(searchName.toLowerCase().trim());
    const matchStatusHaji = filterStatusHaji ? (j.status_haji || 'Belum Haji') === filterStatusHaji : true;
    const matchDesa = filterDesa ? j.desa === filterDesa : true;
    const matchKelompok = filterKelompok ? j.kelompok === filterKelompok : true;
    return matchName && matchStatusHaji && matchDesa && matchKelompok;
  });

  // Count summaries
  const countBelumHaji = jamaahList.filter(j => (j.status_haji || 'Belum Haji') === 'Belum Haji').length;
  const countSudahHaji = jamaahList.filter(j => j.status_haji === 'Sudah Haji').length;
  const countSudahPorsi = jamaahList.filter(j => j.status_haji === 'Sudah Porsi').length;

  // Render locations options
  const activeDesas = locations.map(d => d.nama_desa);
  const activeKelompoks = filterDesa 
    ? (locations.find(d => d.nama_desa === filterDesa)?.kelompoks.map(k => k.nama_kelompok) || [])
    : locations.flatMap(d => d.kelompoks.map(k => k.nama_kelompok));

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-9 h-9 text-primary animate-spin" />
          <h2 className="text-xs font-bold text-slate-400 tracking-wider">Memuat Halaman Tim Haji...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Compass className="text-primary w-7 h-7" />
            <span>Tim Haji &amp; Layanan KBIHU</span>
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Pantau dan kelola database porsi haji, status keberangkatan, dan laporan KBIHU
          </p>
        </div>

        <button 
          onClick={handleExportCsv}
          className="flex items-center justify-center gap-2 py-2.5 px-4 font-bold text-xs bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-300 rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Download size={14} />
          <span>Unduh Laporan Haji</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">BELUM PERNAH HAJI</span>
          <div className="flex justify-between items-baseline mt-3">
            <span className="text-3xl font-black text-slate-800 tracking-tight">{countBelumHaji}</span>
            <span className="text-[11px] font-bold text-slate-400">Orang</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">SUDAH DAPAT PORSI HAJI</span>
          <div className="flex justify-between items-baseline mt-3">
            <span className="text-3xl font-black text-amber-500 tracking-tight">{countSudahPorsi}</span>
            <span className="text-[11px] font-bold text-amber-500">Orang</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">SUDAH HAJI</span>
          <div className="flex justify-between items-baseline mt-3">
            <span className="text-3xl font-black text-emerald-500 tracking-tight">{countSudahHaji}</span>
            <span className="text-[11px] font-bold text-emerald-500">Orang</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-4 flex flex-wrap items-center gap-3.5 mb-6">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Cari nama jamaah..." 
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200/80 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700"
          />
        </div>

        {/* Status Haji Filter */}
        <select 
          value={filterStatusHaji}
          onChange={(e) => setFilterStatusHaji(e.target.value)}
          className="bg-slate-50 border border-slate-200/80 rounded-lg py-2.5 px-3 font-semibold text-xs text-slate-650 hover:bg-white hover:border-slate-300 focus:outline-none transition-all cursor-pointer min-w-[150px]"
        >
          <option value="">Semua Status Haji</option>
          <option value="Belum Haji">Belum Haji</option>
          <option value="Sudah Haji">Sudah Haji</option>
          <option value="Sudah Porsi">Sudah Porsi</option>
        </select>

        {/* Desa Filter */}
        <select 
          value={filterDesa}
          onChange={(e) => {
            setFilterDesa(e.target.value);
            setFilterKelompok('');
          }}
          className="bg-slate-50 border border-slate-200/80 rounded-lg py-2.5 px-3 font-semibold text-xs text-slate-650 hover:bg-white hover:border-slate-300 focus:outline-none transition-all cursor-pointer min-w-[140px]"
        >
          <option value="">Semua Desa</option>
          {activeDesas.sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Kelompok Filter */}
        <select 
          value={filterKelompok}
          onChange={(e) => setFilterKelompok(e.target.value)}
          className="bg-slate-50 border border-slate-200/80 rounded-lg py-2.5 px-3 font-semibold text-xs text-slate-650 hover:bg-white hover:border-slate-300 focus:outline-none transition-all cursor-pointer min-w-[140px]"
        >
          <option value="">Semua Kelompok</option>
          {activeKelompoks.sort().map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {/* Main Table / Cards List */}
      {filteredList.length === 0 ? (
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <Compass size={40} className="opacity-30 mb-4 animate-pulse" />
          <p className="font-bold text-sm">Tidak ada data jamaah haji ditemukan.</p>
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
                  <th className="px-6 py-4">Desa &amp; Kelompok</th>
                  <th className="px-6 py-4 text-center">Status Haji</th>
                  <th className="px-6 py-4">Tanggal Keberangkatan / Porsi</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredList.map(j => {
                  const status = j.status_haji || 'Belum Haji';
                  return (
                    <tr key={j.id} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                      <td className="px-6 py-4 leading-tight">
                        <div className="font-bold text-slate-800">{j.nama_lengkap}</div>
                        {j.tanggal_lahir && (
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Usia: {calculateAge(j.tanggal_lahir)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">{j.jenis_kelamin}</td>
                      <td className="px-6 py-4 leading-tight">
                        <div className="font-bold text-slate-700">{j.desa}</div>
                        <div className="text-[10px] text-primary font-bold mt-0.5 uppercase">{j.kelompok}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          status === 'Sudah Haji' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                            : status === 'Sudah Porsi'
                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                            : 'bg-slate-50 text-slate-400 border border-slate-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-mono">
                        {status === 'Belum Haji' ? '-' : (j.tanggal_keberangkatan_haji || 'Belum ditentukan')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleEditClick(j)}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary transition-all cursor-pointer border border-slate-200/40 inline-flex items-center justify-center"
                          title="Ubah Status Haji"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden divide-y divide-slate-100 bg-white">
            {filteredList.map(j => {
              const status = j.status_haji || 'Belum Haji';
              return (
                <div key={j.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/30 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-slate-800">
                        {j.nama_lengkap} {j.tanggal_lahir && `(${calculateAge(j.tanggal_lahir)})`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {j.desa} &bull; {j.kelompok}
                      </span>
                    </div>

                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                      status === 'Sudah Haji' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' 
                        : status === 'Sudah Porsi'
                        ? 'bg-amber-50 text-amber-600 border border-amber-150'
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}>
                      {status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-50 pt-2.5">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Keberangkatan: <span className="font-mono text-slate-600 font-bold">{status === 'Belum Haji' ? '-' : (j.tanggal_keberangkatan_haji || 'Belum ditentukan')}</span>
                    </span>

                    <button 
                      onClick={() => handleEditClick(j)}
                      className="py-1 px-2.5 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary transition-all text-[10px] font-bold border border-slate-200/50 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={10} />
                      <span>Ubah Status</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Haji Status Modal */}
      {isEditModalOpen && selectedJamaah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <form 
            onSubmit={handleSaveHaji}
            className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn overflow-hidden text-left"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Ubah Status Keanggotaan Haji</h2>
              <button 
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" 
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">NAMA JAMAAH</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">{selectedJamaah.nama_lengkap}</span>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                  {selectedJamaah.desa} &bull; Kelompok {selectedJamaah.kelompok}
                </span>
              </div>

              {/* Status Haji Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">STATUS HAJI</label>
                <select 
                  value={formStatusHaji}
                  onChange={(e) => setFormStatusHaji(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-bold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Belum Haji">Belum Haji</option>
                  <option value="Sudah Haji">Sudah Haji</option>
                  <option value="Sudah Porsi">Sudah Porsi (Menunggu Keberangkatan)</option>
                </select>
              </div>

              {/* Tanggal Keberangkatan */}
              {formStatusHaji !== 'Belum Haji' && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    {formStatusHaji === 'Sudah Haji' ? 'TAHUN / TANGGAL HAJI' : 'TANGGAL ESTIMASI KEBERANGKATAN'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 2024 atau 15 Juni 2028"
                    value={formTanggalHaji}
                    onChange={(e) => setFormTanggalHaji(e.target.value)}
                    className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  />
                  <p className="text-[9px] text-slate-400 font-bold leading-normal">
                    Format bebas, bisa berupa tahun saja (contoh: 2023) atau tanggal lengkap.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)}
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
                <span>{updating ? "Menyimpan..." : "Simpan Perubahan"}</span>
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
