"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Search, Edit2, X, Save, RefreshCw, Sparkles, User, Image as ImageIcon } from 'lucide-react';

export default function TimPnkbPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [jamaahList, setJamaahList] = useState([]);
  const [locations, setLocations] = useState([]);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterMarital, setFilterMarital] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedJamaah, setSelectedJamaah] = useState(null);
  const [formSuku, setFormSuku] = useState('');
  const [formPreferensi, setFormPreferensi] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState(''); // Base64 data url

  // Matchmaking Comparison
  const [selectedPairs, setSelectedPairs] = useState([]); // Array of 2 jamaah objects
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // File Input Ref for Photo Upload
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

      if (!currentUser.can_read_pnkb) {
        alert("Akses Ditolak: Anda tidak memiliki akses ke data PNKB");
        router.push('/dashboard');
        return;
      }

      const locRes = await fetch('/api/lokasi');
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData);
      }

      const jamRes = await fetch('/api/jamaah?include_photo=true&single_only=true');
      if (jamRes.ok) {
        const jamData = await jamRes.json();
        setJamaahList(jamData);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      router.push('/login?callbackUrl=/dashboard/pnkb');
    }
  };

  useEffect(() => {
    fetchAuthAndData();
  }, []);

  const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return 'Usia -';
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age + ' Tahun';
  };

  // Convert and compress selected image to small base64 string
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast("File harus berupa gambar (JPG, PNG)", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran file maksimal 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress using Canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to low quality JPEG base64 (75% quality)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        setFormFotoUrl(compressedBase64);
        showToast("Foto berhasil dimuat & dikompresi", "success");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleEditClick = (j) => {
    setSelectedJamaah(j);
    setFormSuku(j.suku || '');
    setFormPreferensi(j.preferensi_pasangan || '');
    setFormFotoUrl(j.foto_url || '');
    setIsEditModalOpen(true);
  };

  const handleSavePnkb = async (e) => {
    e.preventDefault();
    if (!selectedJamaah) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/jamaah/${selectedJamaah.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suku: formSuku || null,
          preferensi_pasangan: formPreferensi || null,
          foto_url: formFotoUrl || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui profil PNKB");

      showToast("Profil PNKB berhasil diperbarui", "success");
      setIsEditModalOpen(false);
      fetchAuthAndData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  // Checkbox select for matchmaking comparison
  const handleTogglePair = (j) => {
    setSelectedPairs(prev => {
      const isSelected = prev.some(x => x.id === j.id);
      if (isSelected) {
        return prev.filter(x => x.id !== j.id);
      } else {
        if (prev.length >= 2) {
          showToast("Maksimal bandingkan 2 orang saja", "error");
          return prev;
        }
        return [...prev, j];
      }
    });
  };

  // Filter out married and deceased
  const singleList = jamaahList.filter(j => {
    const isSingle = ['Belum Menikah', 'Janda', 'Duda'].includes(j.status_pernikahan);
    const isAlive = j.status_kehidupan === 'Hidup';
    return isSingle && isAlive;
  });

  const filteredList = singleList.filter(j => {
    const matchName = j.nama_lengkap.toLowerCase().includes(searchName.toLowerCase().trim());
    const matchGender = filterGender ? j.jenis_kelamin === filterGender : true;
    const matchMarital = filterMarital 
      ? (filterMarital === 'Janda/Duda' 
          ? (j.status_pernikahan === 'Janda' || j.status_pernikahan === 'Duda') 
          : j.status_pernikahan === filterMarital)
      : true;
    const matchDesa = filterDesa ? j.desa === filterDesa : true;
    const matchKelompok = filterKelompok ? j.kelompok === filterKelompok : true;
    return matchName && matchGender && matchMarital && matchDesa && matchKelompok;
  });

  // Render location options
  const activeDesas = locations.map(d => d.nama_desa);
  const activeKelompoks = filterDesa 
    ? (locations.find(d => d.nama_desa === filterDesa)?.kelompoks.map(k => k.nama_kelompok) || [])
    : locations.flatMap(d => d.kelompoks.map(k => k.nama_kelompok));

  if (loading && !user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-9 h-9 text-primary animate-spin" />
          <h2 className="text-xs font-bold text-slate-400 tracking-wider">Memuat Halaman Tim PNKB...</h2>
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
            <Heart className="text-pink-500 w-7 h-7 fill-pink-500" />
            <span>Tim PNKB (Layanan Taaruf)</span>
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Kelola data jamaah lajang, janda, dan duda, serta jodohkan kriteria taaruf sabilillah
          </p>
        </div>

        {selectedPairs.length === 2 && (
          <button 
            onClick={() => setIsComparisonOpen(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4.5 font-bold text-xs bg-pink-500 hover:bg-pink-600 text-white rounded-lg shadow-md shadow-pink-500/20 transition-all cursor-pointer animate-bounce"
          >
            <Sparkles size={14} className="fill-white" />
            <span>Bandingkan ({selectedPairs.length}/2 Profil)</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-4 flex flex-wrap items-center gap-3.5 mb-6">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Cari nama lajang/duda/janda..." 
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200/80 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700"
          />
        </div>

        {/* Gender Filter */}
        <select 
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
          className="bg-slate-50 border border-slate-200/80 rounded-lg py-2.5 px-3 font-semibold text-xs text-slate-650 hover:bg-white hover:border-slate-300 focus:outline-none transition-all cursor-pointer min-w-[120px]"
        >
          <option value="">Semua Gender</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>

        {/* Status Pernikahan Filter */}
        <select 
          value={filterMarital}
          onChange={(e) => setFilterMarital(e.target.value)}
          className="bg-slate-50 border border-slate-200/80 rounded-lg py-2.5 px-3 font-semibold text-xs text-slate-650 hover:bg-white hover:border-slate-300 focus:outline-none transition-all cursor-pointer min-w-[150px]"
        >
          <option value="">Semua Status Nikah</option>
          <option value="Belum Menikah">Belum Menikah</option>
          <option value="Janda/Duda">Janda / Duda</option>
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

      {/* Main Grid View Cards */}
      {filteredList.length === 0 ? (
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <Heart size={40} className="opacity-30 mb-4 animate-pulse text-pink-400" />
          <p className="font-bold text-sm">Tidak ada data calon taaruf ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map(j => {
            const isPairSelected = selectedPairs.some(x => x.id === j.id);
            return (
              <div 
                key={j.id} 
                className={`bg-white border rounded-2xl p-5 flex flex-col justify-between shadow-sm relative transition-all duration-300 ${
                  isPairSelected 
                    ? 'border-pink-300 ring-2 ring-pink-500/10 shadow-pink-500/5' 
                    : 'border-slate-100 hover:border-slate-200 hover:shadow-md'
                }`}
              >
                {/* Header card: Checkbox & Edit Button */}
                <div className="flex justify-between items-center mb-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={isPairSelected}
                      onChange={() => handleTogglePair(j)}
                      className="rounded text-pink-500 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[10px] font-extrabold text-pink-500 tracking-wider">BANDINGKAN</span>
                  </label>

                  <button 
                    onClick={() => handleEditClick(j)}
                    className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-primary transition-all border border-transparent hover:border-slate-200/50 cursor-pointer"
                    title="Ubah Profil PNKB"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                {/* Profile Info Details */}
                <div className="flex gap-4 items-start flex-1 min-w-0">
                  {/* Photo Profile */}
                  <div className="w-20 h-24 rounded-xl bg-slate-50 border border-slate-150 shrink-0 overflow-hidden relative flex items-center justify-center">
                    {j.foto_url ? (
                      <img src={j.foto_url} alt={j.nama_lengkap} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-350">
                        <User size={28} className="opacity-40" />
                        <span className="text-[8px] font-extrabold tracking-widest mt-1">NO PHOTO</span>
                      </div>
                    )}
                  </div>

                  {/* Text Details */}
                  <div className="flex flex-col min-w-0 flex-1 text-left gap-0.5">
                    <h3 className="font-extrabold text-sm text-slate-800 truncate leading-snug" title={j.nama_lengkap}>
                      {j.nama_lengkap}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className={`text-[10px] font-bold ${j.jenis_kelamin === 'Laki-laki' ? 'text-primary' : 'text-pink-500'}`}>
                        {j.jenis_kelamin}
                      </span>
                      <span className="text-slate-300 text-[10px]">&bull;</span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        {calculateAge(j.tanggal_lahir)}
                      </span>
                    </div>
                    
                    <span className="inline-block self-start px-2 py-0.5 rounded bg-slate-100 text-slate-650 font-bold text-[9px] mt-1">
                      {j.status_pernikahan}
                    </span>

                    <div className="text-[9.5px] font-bold text-slate-400 mt-2 flex flex-col gap-0.5">
                      <span>Suku: <span className="text-slate-650">{j.suku || 'Belum diisi'}</span></span>
                      <span>Pendidikan: <span className="text-slate-650">{j.pendidikan_terakhir}</span></span>
                      <span className="truncate">Kelompok: <span className="text-slate-650 uppercase">{j.kelompok} ({j.desa})</span></span>
                    </div>
                  </div>
                </div>

                {/* Partner Preferences Section */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1 text-left flex-1">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">Kriteria Pasangan Yang Dicari:</span>
                  <p className="text-[11px] font-semibold text-slate-600 italic leading-relaxed line-clamp-3 mt-0.5">
                    {j.preferensi_pasangan ? `"${j.preferensi_pasangan}"` : '"Belum mengisi preferensi kriteria..."'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit PNKB Modal */}
      {isEditModalOpen && selectedJamaah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <form 
            onSubmit={handleSavePnkb}
            className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn overflow-hidden text-left"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Lengkapi Profil Taaruf PNKB</h2>
              <button 
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" 
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4.5 max-h-[60vh] overflow-y-auto">
              {/* Photo Upload Area */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-24 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                  {formFotoUrl ? (
                    <img src={formFotoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-slate-350 opacity-40 w-7 h-7" />
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">FOTO PROFIL</span>
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
                      className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 cursor-pointer shadow-sm transition-all"
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
                  <span className="text-[9px] text-slate-400 font-bold leading-normal">
                    Format gambar (JPG, PNG). Kompresi otomatis ke Base64 (Maks 100KB).
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">NAMA CALON</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">
                  {selectedJamaah.nama_lengkap} &bull; {selectedJamaah.status_pernikahan}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                  Gender: {selectedJamaah.jenis_kelamin} &bull; {calculateAge(selectedJamaah.tanggal_lahir)}
                </span>
              </div>

              {/* Suku */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">SUKU JAMAAH (MISAL: JAWA, SUNDA, MADURA, DLL.)</label>
                <input 
                  type="text" 
                  placeholder="Isi suku asal jamaah..."
                  value={formSuku}
                  onChange={(e) => setFormSuku(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              {/* Preferensi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">PREFERENSI KRITERIA PASANGAN</label>
                <textarea 
                  rows={4}
                  placeholder="Contoh: Sholeh, mandiri, mau tinggal di desa binaan, hafal juz amma, dsb."
                  value={formPreferensi}
                  onChange={(e) => setFormPreferensi(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-lg p-2.5 font-semibold text-xs bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none leading-relaxed"
                />
              </div>
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

      {/* Matchmaking Comparison Screen (Fullscreen Overlay) */}
      {isComparisonOpen && selectedPairs.length === 2 && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-6 overflow-y-auto animate-fadeIn select-none">
          {/* Top Bar */}
          <div className="flex justify-between items-center max-w-5xl w-full mx-auto pb-4 border-b border-slate-800">
            <h2 className="text-sm font-black text-pink-400 tracking-wider uppercase flex items-center gap-2">
              <Sparkles size={16} className="fill-pink-400 animate-spin" />
              <span>Komparasi Pasangan Taaruf SB</span>
            </h2>

            <button 
              onClick={() => {
                setIsComparisonOpen(false);
                setSelectedPairs([]);
              }}
              className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 font-bold text-xs cursor-pointer transition-all"
            >
              Tutup Perbandingan
            </button>
          </div>

          {/* Main Comparison Area */}
          <div className="flex-1 flex flex-col md:flex-row max-w-5xl w-full mx-auto gap-8 items-stretch justify-center py-8">
            {selectedPairs.map((p, idx) => (
              <div 
                key={p.id}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between gap-5 relative text-left"
              >
                {/* Photo profile */}
                <div className="w-full h-56 rounded-2xl bg-slate-950 border border-slate-850 overflow-hidden flex items-center justify-center relative">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nama_lengkap} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-700">
                      <User size={50} className="opacity-30" />
                      <span className="text-[10px] font-extrabold tracking-widest mt-2">NO PHOTO</span>
                    </div>
                  )}
                  {/* Pair Index tag */}
                  <div className="absolute top-4 right-4 bg-slate-900/80 border border-slate-850 px-3 py-1 rounded-full text-[9px] font-black text-pink-400">
                    CALON {idx + 1}
                  </div>
                </div>

                {/* Profile Header */}
                <div>
                  <h3 className="text-lg font-black text-white leading-tight tracking-wide truncate max-w-[280px]">
                    {p.nama_lengkap}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 font-bold text-xs">
                    <span className={p.jenis_kelamin === 'Laki-laki' ? 'text-teal-400' : 'text-pink-400'}>
                      {p.jenis_kelamin}
                    </span>
                    <span className="text-slate-750">&bull;</span>
                    <span className="text-slate-400">{calculateAge(p.tanggal_lahir)}</span>
                    <span className="text-slate-750">&bull;</span>
                    <span className="text-slate-400">{p.status_pernikahan}</span>
                  </div>
                </div>

                {/* Biodata List comparison */}
                <div className="flex flex-col gap-3.5 bg-slate-950/40 p-4 border border-slate-850/50 rounded-2xl text-xs font-semibold">
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span className="text-slate-500 font-bold">SUKU</span>
                    <span className="text-white font-extrabold uppercase">{p.suku || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span className="text-slate-500 font-bold">PENDIDIKAN</span>
                    <span className="text-white font-extrabold">{p.pendidikan_terakhir}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span className="text-slate-500 font-bold">GOL. DARAH</span>
                    <span className="text-white font-extrabold">{p.golongan_darah}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span className="text-slate-500 font-bold">KELOMPOK</span>
                    <span className="text-white font-extrabold uppercase">{p.kelompok}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">DESA</span>
                    <span className="text-white font-extrabold">{p.desa}</span>
                  </div>
                </div>

                {/* Preferences in Comparison */}
                <div className="bg-slate-950/30 p-4 border border-slate-850/30 rounded-2xl flex-1 flex flex-col gap-1.5">
                  <span className="text-[8px] font-black text-pink-400 uppercase tracking-widest">Kriteria yang dicari:</span>
                  <p className="text-[11.5px] font-semibold text-slate-300 italic leading-relaxed">
                    {p.preferensi_pasangan ? `"${p.preferensi_pasangan}"` : '"Belum mengisi preferensi kriteria..."'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Bar */}
          <div className="max-w-5xl w-full mx-auto border-t border-slate-800 pt-4 text-center text-slate-500 text-[10px] font-bold">
            TIM PERNIKAHAN DAN KELUARGA BAHAGIA (PNKB) &bull; ANDARA SUPER APPS
          </div>
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
