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
  const [filterMarital, setFilterMarital] = useState('');
  
  // Keluarga Filters
  const [searchKeluarga, setSearchKeluarga] = useState('');
  const [filterKeluargaDesa, setFilterKeluargaDesa] = useState('');
  const [filterKeluargaKelompok, setFilterKeluargaKelompok] = useState('');

  // Statistik Filters
  const [filterStatsDesa, setFilterStatsDesa] = useState('');
  const [filterStatsKelompok, setFilterStatsKelompok] = useState('');

  // Modals state
  const [isJamaahModalOpen, setIsJamaahModalOpen] = useState(false);
  const [selectedJamaahId, setSelectedJamaahId] = useState(null); // null means ADD, otherwise EDIT
  const [formNama, setFormNama] = useState('');
  const [formGender, setFormGender] = useState('Laki-laki');
  const [formBirthplace, setFormBirthplace] = useState('');
  const [locations, setLocations] = useState([]);
  const [formDesa, setFormDesa] = useState('Andara');
  const [formKelompok, setFormKelompok] = useState('Andara 1');
  const [formBlood, setFormBlood] = useState('Tidak Diketahui');
  const [formStatus, setFormStatus] = useState('Hidup');
  const [formEducation, setFormEducation] = useState('Tidak Sekolah');
  const [formGradDate, setFormGradDate] = useState('');
  const [formKategori, setFormKategori] = useState('Dewasa');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formStatusPernikahan, setFormStatusPernikahan] = useState('Belum Menikah');

  const [isKeluargaModalOpen, setIsKeluargaModalOpen] = useState(false);
  const [selectedKkId, setSelectedKkId] = useState('');

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedKeluargaId, setSelectedKeluargaId] = useState('');
  const [selectedMemberJamaahId, setSelectedMemberJamaahId] = useState('');
  const [selectedMemberRel, setSelectedMemberRel] = useState('Anak');

  // QR Modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedQrJamaah, setSelectedQrJamaah] = useState(null);

  // RFID Modal state
  const [isRfidModalOpen, setIsRfidModalOpen] = useState(false);
  const [selectedRfidJamaah, setSelectedRfidJamaah] = useState(null);
  const [rfidInputMode, setRfidInputMode] = useState('view'); // 'view' or 'scan'
  const [rfidValue, setRfidValue] = useState('');
  const [rfidManualInput, setRfidManualInput] = useState(false);
  const [rfidSaving, setRfidSaving] = useState(false);

  // CSV Import Modal state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [importingCsv, setImportingCsv] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, filterKelompok, filterGender, filterBlood, filterStatus, filterMarital, rowsPerPage]);

  // Focus RFID input capture when scan mode is activated
  useEffect(() => {
    if (isRfidModalOpen && rfidInputMode === 'scan') {
      setTimeout(() => {
        const inputEl = document.getElementById('rfid-input-capture');
        if (inputEl) {
          inputEl.focus();
        }
      }, 300);
    }
  }, [isRfidModalOpen, rfidInputMode]);

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

  const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return '-';
    const birthDate = new Date(birthDateStr);
    if (isNaN(birthDate.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} Tahun`;
  };

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await userRes.json();
      setUser(currentUser);

      if (!currentUser.can_read_jamaah && !currentUser.can_read_keluarga) {
        showToast("Akses Ditolak: Anda tidak memiliki akses ke Database Jamaah", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      if (!currentUser.can_read_jamaah && currentUser.can_read_keluarga) {
        setActiveTab('keluarga');
      }

      const [jamaahRes, keluargaRes, lokasiRes] = await Promise.all([
        fetch('/api/jamaah'),
        fetch('/api/keluarga'),
        fetch('/api/lokasi')
      ]);

      if (jamaahRes.ok && keluargaRes.ok && lokasiRes.ok) {
        setJamaahList(await jamaahRes.json());
        setKeluargaList(await keluargaRes.json());
        setLocations(await lokasiRes.json());
      } else {
        throw new Error("Gagal mengambil data jamaah, keluarga, dan lokasi");
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
        setFormBirthplace(j.tempat_lahir || '');
        setFormDesa(j.desa);
        setFormKelompok(j.kelompok);
        setFormBlood(j.golongan_darah || 'Tidak Diketahui');
        setFormStatus(j.status_kehidupan);
        setFormEducation(j.pendidikan_terakhir);
        setFormGradDate(j.tanggal_lulus_pendidikan_terakhir || '');
        setFormKategori(j.kategori || 'Dewasa');
        setFormBirthDate(j.tanggal_lahir || '');
        setFormStatusPernikahan(j.status_pernikahan || 'Belum Menikah');
        setIsJamaahModalOpen(true);
      }
    } else {
      setSelectedJamaahId(null);
      setFormNama('');
      setFormGender('Laki-laki');
      setFormBirthplace('');
      const defaultDesa = user.role === 'Super Admin' 
        ? (locations[0]?.nama_desa || 'Andara') 
        : user.desa;
      setFormDesa(defaultDesa);
      const dObj = locations.find(d => d.nama_desa === defaultDesa);
      const defaultKelompok = user.role === 'Moderator' 
        ? user.kelompok 
        : (dObj && dObj.kelompoks.length > 0 ? dObj.kelompoks[0].nama_kelompok : '');
      setFormKelompok(defaultKelompok);
      setFormBlood('Tidak Diketahui');
      setFormStatus('Hidup');
      setFormEducation('Tidak Sekolah');
      setFormGradDate('');
      setFormKategori('Dewasa');
      setFormBirthDate('');
      setFormStatusPernikahan('Belum Menikah');
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

  const openRfidModal = (jamaah) => {
    setSelectedRfidJamaah(jamaah);
    setRfidValue(jamaah.rfid || '');
    setRfidInputMode(jamaah.rfid ? 'view' : 'scan');
    setRfidManualInput(false);
    setIsRfidModalOpen(true);
  };

  const closeRfidModal = () => {
    setIsRfidModalOpen(false);
    setSelectedRfidJamaah(null);
    setRfidValue('');
    setRfidInputMode('view');
    setRfidManualInput(false);
  };

  const handleSaveRfid = async (rfidValToSave) => {
    if (!selectedRfidJamaah) return;
    setRfidSaving(true);
    try {
      const res = await fetch(`/api/jamaah/${selectedRfidJamaah.id}/rfid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfid: rfidValToSave })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        closeRfidModal();
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan RFID", "error");
    } finally {
      setRfidSaving(false);
    }
  };

  const openCsvModal = () => {
    setCsvPreview([]);
    setCsvParsedRows([]);
    setIsCsvModalOpen(true);
  };

  const closeCsvModal = () => {
    setIsCsvModalOpen(false);
    setCsvPreview([]);
    setCsvParsedRows([]);
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCsvString(text);
      if (parsed.length < 2) {
        showToast("File CSV kosong atau hanya memiliki header", "error");
        return;
      }
      
      const headers = parsed[0].map(h => h.trim().toUpperCase());
      const nameIdx = headers.indexOf('NAMA LENGKAP') !== -1 ? headers.indexOf('NAMA LENGKAP') : (headers.indexOf('NAMA') !== -1 ? headers.indexOf('NAMA') : headers.indexOf('NAMA_LENGKAP'));
      const genderIdx = headers.indexOf('JENIS KELAMIN') !== -1 ? headers.indexOf('JENIS KELAMIN') : (headers.indexOf('GENDER') !== -1 ? headers.indexOf('GENDER') : headers.indexOf('JENIS_KELAMIN'));
      
      if (nameIdx === -1) {
        showToast("CSV harus memiliki minimal kolom 'Nama Lengkap' atau 'Nama'", "error");
        return;
      }
      
      const maritalIdx = headers.indexOf('STATUS PERNIKAHAN') !== -1 ? headers.indexOf('STATUS PERNIKAHAN') : headers.indexOf('STATUS_PERNIKAHAN');
      const birthPlaceIdx = headers.indexOf('TEMPAT LAHIR') !== -1 ? headers.indexOf('TEMPAT LAHIR') : headers.indexOf('TEMPAT_LAHIR');
      const birthDateIdx = headers.indexOf('TANGGAL LAHIR') !== -1 ? headers.indexOf('TANGGAL LAHIR') : headers.indexOf('TANGGAL_LAHIR');
      const lifeIdx = headers.indexOf('STATUS KEHIDUPAN') !== -1 ? headers.indexOf('STATUS KEHIDUPAN') : headers.indexOf('STATUS_KEHIDUPAN');
      const bloodIdx = headers.indexOf('GOLONGAN DARAH') !== -1 ? headers.indexOf('GOLONGAN DARAH') : (headers.indexOf('GOL. DARAH') !== -1 ? headers.indexOf('GOL. DARAH') : headers.indexOf('GOLONGAN_DARAH'));
      const categoryIdx = headers.indexOf('KATEGORI') !== -1 ? headers.indexOf('KATEGORI') : headers.indexOf('KATEGORI');
      const eduIdx = headers.indexOf('PENDIDIKAN TERAKHIR') !== -1 ? headers.indexOf('PENDIDIKAN TERAKHIR') : headers.indexOf('PENDIDIKAN_TERAKHIR');
      const gradIdx = headers.indexOf('TANGGAL LULUS') !== -1 ? headers.indexOf('TANGGAL LULUS') : headers.indexOf('TANGGAL_LULUS');
      const rfidIdx = headers.indexOf('RFID') !== -1 ? headers.indexOf('RFID') : headers.indexOf('CARD_ID');
      const desaIdx = headers.indexOf('DESA') !== -1 ? headers.indexOf('DESA') : headers.indexOf('DESA');
      const kelompokIdx = headers.indexOf('KELOMPOK') !== -1 ? headers.indexOf('KELOMPOK') : headers.indexOf('KELOMPOK');

      const rowsToImport = [];
      const previewRows = [];

      for (let i = 1; i < parsed.length; i++) {
        const cols = parsed[i];
        if (cols.length === 0 || !cols[nameIdx]) continue;
        
        const rowData = {
          nama_lengkap: cols[nameIdx] ? cols[nameIdx].trim() : '',
          jenis_kelamin: genderIdx !== -1 && cols[genderIdx] ? cols[genderIdx].trim() : '',
          status_pernikahan: maritalIdx !== -1 && cols[maritalIdx] ? cols[maritalIdx].trim() : '',
          tempat_lahir: birthPlaceIdx !== -1 && cols[birthPlaceIdx] ? cols[birthPlaceIdx].trim() : '',
          tanggal_lahir: birthDateIdx !== -1 && cols[birthDateIdx] ? cols[birthDateIdx].trim() : '',
          status_kehidupan: lifeIdx !== -1 && cols[lifeIdx] ? cols[lifeIdx].trim() : '',
          golongan_darah: bloodIdx !== -1 && cols[bloodIdx] ? cols[bloodIdx].trim() : '',
          kategori: categoryIdx !== -1 && cols[categoryIdx] ? cols[categoryIdx].trim() : '',
          pendidikan_terakhir: eduIdx !== -1 && cols[eduIdx] ? cols[eduIdx].trim() : '',
          tanggal_lulus_pendidikan_terakhir: gradIdx !== -1 && cols[gradIdx] ? cols[gradIdx].trim() : '',
          rfid: rfidIdx !== -1 && cols[rfidIdx] ? cols[rfidIdx].trim() : '',
          desa: desaIdx !== -1 && cols[desaIdx] ? cols[desaIdx].trim() : '',
          kelompok: kelompokIdx !== -1 && cols[kelompokIdx] ? cols[kelompokIdx].trim() : ''
        };

        if (rowData.nama_lengkap) {
          rowsToImport.push(rowData);
          if (previewRows.length < 5) {
            previewRows.push(rowData);
          }
        }
      }

      setCsvParsedRows(rowsToImport);
      setCsvPreview(previewRows);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (csvParsedRows.length === 0) return;
    setImportingCsv(true);
    try {
      const res = await fetch('/api/jamaah/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: csvParsedRows })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        if (data.errors && data.errors.length > 0) {
          console.warn("Import warnings:", data.errors);
        }
        closeCsvModal();
        loadData();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal mengimpor CSV", "error");
    } finally {
      setImportingCsv(false);
    }
  };

  const parseCsvString = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i+1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const handleJamaahSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nama_lengkap: formNama,
      jenis_kelamin: formGender,
      tempat_lahir: formBirthplace || null,
      golongan_darah: formBlood,
      kelompok: formKelompok,
      status_kehidupan: formStatus,
      pendidikan_terakhir: formEducation,
      tanggal_lulus_pendidikan_terakhir: formEducation === 'Tidak Sekolah' ? null : (formGradDate || null),
      desa: formDesa,
      kategori: formKategori,
      tanggal_lahir: formBirthDate || null,
      status_pernikahan: formStatusPernikahan
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
    const unassociated = jamaahList.filter(j => !associatedJamaahIds.includes(j.id));

    if (unassociated.length === 0) {
      showToast("Semua jamaah dalam wewenang Anda sudah memiliki keluarga.", "error");
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
    const unassociated = jamaahList.filter(j => !associatedJamaahIds.includes(j.id));

    if (unassociated.length === 0) {
      showToast("Semua jamaah sudah terdaftar di unit keluarga.", "error");
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

  if (!user || (!user.can_read_jamaah && !user.can_read_keluarga)) {
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
    const matchMarital = filterMarital 
      ? (filterMarital === 'Janda/Duda' 
          ? (j.status_pernikahan === 'Janda' || j.status_pernikahan === 'Duda') 
          : j.status_pernikahan === filterMarital)
      : true;
    return matchName && matchKelompok && matchGender && matchBlood && matchStatus && matchMarital;
  });

  const totalRows = filteredJamaah.length;
  const totalPages = rowsPerPage === 'Semua' ? 1 : Math.ceil(totalRows / rowsPerPage);
  const displayPage = Math.min(currentPage, totalPages || 1);
  const paginatedJamaah = rowsPerPage === 'Semua' 
    ? filteredJamaah 
    : filteredJamaah.slice((displayPage - 1) * rowsPerPage, displayPage * rowsPerPage);

  const associatedJamaahIdsForModal = keluargaList.flatMap(f => f.anggota.map(m => m.jamaah_id));
  const unassociatedJamaahForModal = jamaahList.filter(j => !associatedJamaahIdsForModal.includes(j.id));

  let scopeLabel = '';
  if (user) {
    if (user.monitor_all_desas && user.monitor_all_kelompoks) {
      scopeLabel = ' (Semua Wilayah)';
    } else {
      const monitoredDesas = user.desas_pantau || [];
      if (monitoredDesas.length > 0) {
        scopeLabel = ` (Desa: ${monitoredDesas.join(', ')})`;
      }
    }
  }

  const filteredKeluarga = keluargaList.filter(f => {
    const searchVal = searchKeluarga.toLowerCase().trim();
    const matchesSearch = !searchVal ? true : (
      f.nama_keluarga.toLowerCase().includes(searchVal) ||
      f.anggota.some(m => m.nama_lengkap.toLowerCase().includes(searchVal))
    );

    const matchesDesa = !filterKeluargaDesa ? true : (
      f.anggota.some(m => m.desa === filterKeluargaDesa)
    );

    const matchesKelompok = !filterKeluargaKelompok ? true : (
      f.anggota.some(m => m.kelompok === filterKeluargaKelompok)
    );

    return matchesSearch && matchesDesa && matchesKelompok;
  });

  // Available Desas for statistics filter based on user permissions/monitored scope
  const availableDesas = (() => {
    if (!user) return [];
    if (user.monitor_all_desas) {
      return [...locations].map(d => d.nama_desa).sort((a, b) => a.localeCompare(b));
    }
    return [...(user.desas_pantau || [])].sort((a, b) => a.localeCompare(b));
  })();

  // Available Kelompoks for statistics filter based on selected desa & user permissions/monitored scope
  const availableKelompoks = (() => {
    if (!user) return [];
    
    // Find all groups that the user is allowed to monitor in general
    let allowedKelompoks = [];
    if (user.monitor_all_kelompoks) {
      allowedKelompoks = locations
        .filter(d => user.monitor_all_desas || (user.desas_pantau || []).includes(d.nama_desa))
        .flatMap(d => d.kelompoks.map(k => k.nama_kelompok));
    } else {
      allowedKelompoks = user.kelompoks_pantau || [];
    }

    // If filterStatsDesa is selected, filter by that village
    if (filterStatsDesa) {
      const desaObj = locations.find(d => d.nama_desa === filterStatsDesa);
      const kelompoksInDesa = desaObj ? (desaObj.kelompoks || []).map(k => k.nama_kelompok) : [];
      return allowedKelompoks.filter(k => kelompoksInDesa.includes(k)).sort((a, b) => a.localeCompare(b));
    }

    // Otherwise (no village selected), return all allowed groups
    return [...new Set(allowedKelompoks)].sort((a, b) => a.localeCompare(b));
  })();

  // Statistik Calculations
  const statsActiveJamaah = jamaahList.filter(j => {
    if (j.status_kehidupan !== 'Hidup') return false;
    if (filterStatsDesa && j.desa !== filterStatsDesa) return false;
    if (filterStatsKelompok && j.kelompok !== filterStatsKelompok) return false;
    return true;
  });
  const totalActive = statsActiveJamaah.length;
  const maleCount = statsActiveJamaah.filter(j => j.jenis_kelamin === 'Laki-laki').length;
  const femaleCount = statsActiveJamaah.filter(j => j.jenis_kelamin === 'Perempuan').length;
  
  const statsActiveKeluarga = keluargaList.filter(f => {
    if (filterStatsDesa && !f.anggota.some(m => m.desa === filterStatsDesa)) return false;
    if (filterStatsKelompok && !f.anggota.some(m => m.kelompok === filterStatsKelompok)) return false;
    return true;
  });
  const totalKeluarga = statsActiveKeluarga.length;


  const getFreqWithGender = (list, key) => {
    const freq = {};
    list.forEach(j => {
      const val = j[key] || 'Lainnya';
      if (!freq[val]) {
        freq[val] = { total: 0, Laki: 0, Perempuan: 0 };
      }
      freq[val].total += 1;
      if (j.jenis_kelamin === 'Laki-laki') {
        freq[val].Laki += 1;
      } else if (j.jenis_kelamin === 'Perempuan') {
        freq[val].Perempuan += 1;
      }
    });
    return Object.entries(freq).sort((a, b) => b[1].total - a[1].total);
  };

  const kategoriStats = getFreqWithGender(statsActiveJamaah, 'kategori');
  const kelompokStats = getFreqWithGender(statsActiveJamaah, 'kelompok');
  const desaStats = getFreqWithGender(statsActiveJamaah, 'desa');
  const pendidikanStats = getFreqWithGender(statsActiveJamaah, 'pendidikan_terakhir');
  const statusPernikahanStats = getFreqWithGender(statsActiveJamaah, 'status_pernikahan');

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
          {user.can_create_keluarga && (
            <button id="btn-modal-keluarga" onClick={openKeluargaModal} className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg shadow-sm transition-all">
              <Home size={14} />
              <span>Buat Keluarga Baru</span>
            </button>
          )}
          {user.can_create_jamaah && (
            <button id="btn-modal-csv" onClick={openCsvModal} className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-lg shadow-sm transition-all cursor-pointer">
              <Download size={14} />
              <span>Upload CSV</span>
            </button>
          )}
          {user.can_create_jamaah && (
            <button id="btn-modal-jamaah" onClick={() => openJamaahModal()} className="flex items-center gap-2 py-2 px-3.5 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all">
              <UserPlus size={14} />
              <span>Tambah Jamaah</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-slate-100 mb-6 gap-6">
        {user.can_read_jamaah && (
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
        )}
        {user.can_read_keluarga && (
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
        )}
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
              {(user.role === 'Super Admin' 
                ? [...locations.flatMap(d => d.kelompoks)].sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
                : [...(locations.find(d => d.nama_desa === user.desa)?.kelompoks || [])].sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
              ).map(k => (
                <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
              ))}
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
              <option value="Tidak Diketahui">Tidak Diketahui</option>
            </select>
            <select 
              id="filter-status" 
              className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Semua Status Kehidupan</option>
              <option value="Hidup">Hidup</option>
              <option value="Meninggal">Meninggal</option>
            </select>
            <select 
              id="filter-marital" 
              className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
              value={filterMarital}
              onChange={(e) => setFilterMarital(e.target.value)}
            >
              <option value="">Semua Status Pernikahan</option>
              <option value="Belum Menikah">Belum Menikah</option>
              <option value="Menikah">Menikah</option>
              <option value="Janda/Duda">Janda/Duda</option>
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
                       <th className="px-6 py-4">Lahir</th>
                       <th className="px-6 py-4">Lokasi</th>
                       <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4 text-center">Gol. Darah</th>
                       <th className="px-6 py-4">Pendidikan</th>
                       <th className="px-6 py-4">Hub. Keluarga</th>
                       <th className="px-6 py-4 text-center">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedJamaah.map(j => {
                      const isAlive = j.status_kehidupan === 'Hidup';
                      return (
                        <tr key={j.id} id={`row-jamaah-${j.id}`} className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-650">
                           <td className="px-6 py-4 leading-tight">
                             <div className="font-bold text-slate-800 text-sm">{j.nama_lengkap}</div>
                             
                             {/* Badge Row inside Name column */}
                             <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                               {isAlive && j.tanggal_lahir && (
                                 <span className="text-[9.5px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                   Usia: {calculateAge(j.tanggal_lahir)}
                                 </span>
                               )}
                               <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                 j.jenis_kelamin === 'Laki-laki' 
                                   ? 'bg-blue-50 text-blue-600 border border-blue-100/50' 
                                   : 'bg-pink-50 text-pink-600 border border-pink-100/50'
                               }`}>
                                 {j.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}
                               </span>
                               <span className="text-[9.5px] font-bold bg-teal-50 text-teal-700 border border-teal-100/50 px-1.5 py-0.5 rounded">
                                 {j.kategori}
                               </span>
                               <span className="text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/50 px-1.5 py-0.5 rounded">
                                 {j.status_pernikahan || 'Belum Menikah'}
                               </span>
                             </div>
                           </td>
                           <td className="px-6 py-4 leading-tight">
                             <div className="font-bold text-slate-700">{j.tempat_lahir || '-'}</div>
                             {j.tanggal_lahir && (
                               <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                 {new Date(j.tanggal_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                               </div>
                             )}
                           </td>
                           <td className="px-6 py-4 leading-tight">
                             <div className="font-bold text-slate-800">{j.desa}</div>
                             <div className="text-[10px] text-primary font-bold mt-0.5 uppercase">{j.kelompok}</div>
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
                               {user.can_update_jamaah && (
                                 <button 
                                    className={`p-1.5 rounded-lg border transition-all font-bold text-[10px] cursor-pointer ${
                                      j.rfid 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80 hover:bg-emerald-500 hover:text-white' 
                                        : 'bg-slate-50 text-slate-400 border-slate-200/60 hover:bg-slate-200 hover:text-slate-700'
                                    }`}
                                    onClick={() => openRfidModal(j)} 
                                    title={j.rfid ? `Update RFID (${j.rfid})` : "Registrasi RFID"}
                                  >
                                    RFID
                                  </button>
                               )}
                               {user.can_update_jamaah && (
                                 <button className="p-1.5 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-600 hover:text-primary transition-all cursor-pointer" onClick={() => openJamaahModal(j.id)} title="Edit Data">
                                   <Edit2 size={13} />
                                 </button>
                               )}
                               {user.can_delete_jamaah && (
                                 <button className="p-1.5 rounded-lg bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all cursor-pointer" onClick={() => handleDeleteJamaah(j.id)} title="Hapus Data">
                                   <Trash2 size={13} />
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
                {paginatedJamaah.map(j => {
                  const isAlive = j.status_kehidupan === 'Hidup';
                  return (
                    <div key={j.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/30 transition-colors">
                      {/* Name, Status & Family Info */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                           <span className="text-sm font-bold text-slate-800 truncate">
                             {j.nama_lengkap}
                             {isAlive && j.tanggal_lahir && (
                               <span className="text-[10px] text-slate-400 font-bold ml-1.5">
                                 ({calculateAge(j.tanggal_lahir)})
                               </span>
                             )}
                           </span>
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
                        <span className="text-[9.5px] text-slate-400 font-semibold leading-relaxed">
                          Lahir: {j.tempat_lahir || '-'}{j.tanggal_lahir ? ` (${new Date(j.tanggal_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''} &bull; {j.status_pernikahan || 'Belum Menikah'}
                        </span>
                        <div className="flex gap-2">
                          <button className="py-1.5 px-3 rounded-lg bg-teal-50 hover:bg-teal-550 text-teal-755 hover:text-teal-700 transition-all font-bold text-[10px] cursor-pointer" onClick={() => handleOpenQrModal(j)} title="Cetak Kartu QR">
                            QR Card
                          </button>
                          {user.can_update_jamaah && (
                            <button 
                              className={`py-1.5 px-3 rounded-lg border transition-all font-bold text-[10px] cursor-pointer ${
                                j.rfid 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-150 hover:bg-emerald-500 hover:text-white' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200/50 hover:bg-slate-200 hover:text-slate-700'
                              }`} 
                              onClick={() => openRfidModal(j)} 
                              title={j.rfid ? `Update RFID (${j.rfid})` : "Registrasi RFID"}
                            >
                              RFID
                            </button>
                          )}
                          {user.can_update_jamaah && (
                            <button className="p-2 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary border border-slate-200/50 transition-all cursor-pointer" onClick={() => openJamaahModal(j.id)} title="Edit Data">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {user.can_delete_jamaah && (
                            <button className="p-2 rounded-lg bg-red-50 hover:bg-red-500 text-red-550 hover:text-white border border-red-100/30 transition-all cursor-pointer" onClick={() => handleDeleteJamaah(j.id)} title="Hapus Data">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="bg-slate-50/50 border-t border-slate-150 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Tampilkan</span>
                  <select 
                    value={rowsPerPage} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setRowsPerPage(val === 'Semua' ? 'Semua' : parseInt(val, 10));
                    }}
                    className="bg-white border border-slate-200 text-slate-700 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-xs cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="Semua">Semua</option>
                  </select>
                  <span>baris dari {totalRows} jamaah</span>
                </div>

                {rowsPerPage !== 'Semua' && totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={displayPage === 1}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    
                    <span className="px-3 text-slate-500 font-bold">
                      Halaman {displayPage} dari {totalPages}
                    </span>

                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={displayPage === totalPages}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        ) : activeTab === 'keluarga' ? (
          <>
            {/* Keluarga Filters Bar */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-3 flex flex-wrap items-center gap-3.5 mb-6" id="keluarga-search-filter-section">
              {/* Search bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  id="search-keluarga" 
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-755 text-xs font-semibold" 
                  placeholder="Cari nama keluarga atau nama anggota..."
                  value={searchKeluarga}
                  onChange={(e) => setSearchKeluarga(e.target.value)}
                />
              </div>
              
              {/* Dropdown Filters */}
              <div className="flex flex-wrap gap-2">
                {user.role === 'Super Admin' ? (
                  <select 
                    id="filter-keluarga-desa" 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterKeluargaDesa}
                    onChange={(e) => {
                      setFilterKeluargaDesa(e.target.value);
                      setFilterKeluargaKelompok(''); // Reset kelompok when desa changes
                    }}
                  >
                    <option value="">Semua Desa</option>
                    {[...locations].sort((a, b) => a.nama_desa.localeCompare(b.nama_desa)).map(d => (
                      <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                    ))}
                  </select>
                ) : null}

                <select 
                  id="filter-keluarga-kelompok" 
                  className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                  value={filterKeluargaKelompok}
                  onChange={(e) => setFilterKeluargaKelompok(e.target.value)}
                >
                  <option value="">Semua Kelompok</option>
                  {(user.role === 'Super Admin'
                    ? (filterKeluargaDesa 
                        ? (locations.find(d => d.nama_desa === filterKeluargaDesa)?.kelompoks || [])
                        : locations.flatMap(d => d.kelompoks))
                    : (locations.find(d => d.nama_desa === user.desa)?.kelompoks || [])
                  )
                  .sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok))
                  .map(k => (
                    <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredKeluarga.length === 0 ? (
              <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Home size={44} className="opacity-40 mb-4" />
                <p className="font-bold text-sm">Belum ada data keluarga dibuat atau tidak sesuai filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredKeluarga.map(f => {
                  return (
                    <div key={f.id} className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col justify-between min-h-[260px] hover:shadow-md transition-all duration-200">
                      <div>
                        {/* Family card Header */}
                        <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">{f.nama_keluarga}</h4>
                          {user.can_delete_keluarga && (
                            <button className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-50 transition-all shrink-0 cursor-pointer" onClick={() => handleDeleteKeluarga(f.id)} title="Hapus Unit Keluarga">
                              <Trash2 size={15} />
                            </button>
                          )}
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
                                  <th className="py-1.5">Kelompok</th>
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
                                      <td className="py-2 text-primary font-bold text-[10px] uppercase">{m.kelompok}</td>
                                      <td className="py-2 text-slate-400 text-[10px] font-bold">{m.jenis_anggota}</td>
                                      <td className="py-2 text-right">
                                        {user.can_update_keluarga && (
                                          <button className="text-red-500 hover:text-red-700 font-extrabold text-[10px] cursor-pointer" onClick={() => handleRemoveMember(m.anggota_id)} title="Keluarkan dari keluarga">
                                            Hapus
                                          </button>
                                        )}
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
                      {user.can_update_keluarga && (
                        <div>
                          <button className="flex items-center justify-center gap-1.5 w-full py-2 px-3 font-bold text-[10px] bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary rounded-lg transition-all border border-slate-100 cursor-pointer" onClick={() => openAddMemberModal(f.id)}>
                            <Plus size={12} />
                            <span>Tambah Anggota Keluarga</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* Baseline calculation info badge */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-emerald-850 text-xs font-semibold leading-relaxed">
                <Info className="w-5 h-5 shrink-0 text-emerald-650 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-950 mb-1">Dasar Perhitungan Statistik:</div>
                  <p>
                    {user.monitor_all_desas && user.monitor_all_kelompoks
                      ? "Statistik mencakup seluruh data jamaah dari semua desa dan kelompok (Semua Terpantau)."
                      : `Statistik disaring berdasarkan wilayah terpantau Anda: ` +
                        `Desa: ${user.monitor_all_desas ? 'Semua Desa' : (user.desas_pantau && user.desas_pantau.length > 0 ? user.desas_pantau.join(', ') : 'Tidak ada')}, ` +
                        `Kelompok: ${user.monitor_all_kelompoks ? 'Semua Kelompok' : (user.kelompoks_pantau && user.kelompoks_pantau.length > 0 ? user.kelompoks_pantau.join(', ') : 'Tidak ada')}.`}
                  </p>
                </div>
              </div>

              {/* Statistik Filters Dropdown */}
              <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-3 flex flex-wrap items-center gap-3.5" id="stats-filters-section">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Filter Wilayah Statistik</span>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <select 
                    id="stats-filter-desa" 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterStatsDesa}
                    onChange={(e) => {
                      setFilterStatsDesa(e.target.value);
                      setFilterStatsKelompok(''); // Reset kelompok when desa changes
                    }}
                  >
                    <option value="">Semua Desa Terpantau</option>
                    {availableDesas.map(desaName => (
                      <option key={desaName} value={desaName}>{desaName}</option>
                    ))}
                  </select>
                  <select 
                    id="stats-filter-kelompok" 
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] cursor-pointer outline-none focus:border-primary"
                    value={filterStatsKelompok}
                    onChange={(e) => setFilterStatsKelompok(e.target.value)}
                  >
                    <option value="">Semua Kelompok Terpantau</option>
                    {availableKelompoks.map(kelompokName => (
                      <option key={kelompokName} value={kelompokName}>{kelompokName}</option>
                    ))}
                  </select>
                </div>
              </div>
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
                    {kategoriStats.map(([kategori, data]) => {
                      const pct = totalActive > 0 ? Math.round((data.total / totalActive) * 100) : 0;
                      return (
                        <div key={kategori} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{kategori} <span className="text-[9px] text-slate-400 font-bold ml-1.5">(L: {data.Laki} | P: {data.Perempuan})</span></span>
                            <span>{data.total} orang ({pct}%)</span>
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
                    {pendidikanStats.map(([edu, data]) => {
                      const pct = totalActive > 0 ? Math.round((data.total / totalActive) * 100) : 0;
                      return (
                        <div key={edu} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{edu} <span className="text-[9px] text-slate-400 font-bold ml-1.5">(L: {data.Laki} | P: {data.Perempuan})</span></span>
                            <span>{data.total} orang ({pct}%)</span>
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
                    {kelompokStats.map(([kel, data]) => {
                      const pct = totalActive > 0 ? Math.round((data.total / totalActive) * 100) : 0;
                      return (
                        <div key={kel} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{kel} <span className="text-[9px] text-slate-400 font-bold ml-1.5">(L: {data.Laki} | P: {data.Perempuan})</span></span>
                            <span>{data.total} orang ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary-hover h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desa, Status Pernikahan & Goldar Distribution */}
                <div className="flex flex-col gap-6">
                  {/* Desa Stats */}
                  <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex-1">
                    <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">DISTRIBUSI PER DESA</h3>
                    <div className="flex flex-col gap-3">
                      {desaStats.map(([ds, data]) => {
                        const pct = totalActive > 0 ? Math.round((data.total / totalActive) * 100) : 0;
                        return (
                          <div key={ds} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                              <span>Desa {ds} <span className="text-[9px] text-slate-400 font-bold ml-1.5">(L: {data.Laki} | P: {data.Perempuan})</span></span>
                              <span>{data.total} orang ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Pernikahan Stats */}
                  <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex-1">
                    <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Distribusi Status Pernikahan</h3>
                    <div className="flex flex-col gap-3">
                      {statusPernikahanStats.map(([status, data]) => {
                        const pct = totalActive > 0 ? Math.round((data.total / totalActive) * 100) : 0;
                        return (
                          <div key={status} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                              <span>{status} <span className="text-[9px] text-slate-400 font-bold ml-1.5">(L: {data.Laki} | P: {data.Perempuan})</span></span>
                              <span>{data.total} orang ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-sky-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Goldar Stats */}
                  <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 flex-1">
                    <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">Golongan Darah</h3>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {['A', 'B', 'AB', 'O', 'Tidak Diketahui'].map(type => {
                        const count = statsActiveJamaah.filter(j => j.golongan_darah === type).length;
                        const males = statsActiveJamaah.filter(j => j.golongan_darah === type && j.jenis_kelamin === 'Laki-laki').length;
                        const females = statsActiveJamaah.filter(j => j.golongan_darah === type && j.jenis_kelamin === 'Perempuan').length;
                        const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                        return (
                          <div key={type} className="border border-slate-100 rounded-xl p-3 bg-slate-50/30 flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-500 block mb-1 truncate" title={type}>{type === 'Tidak Diketahui' ? 'N/A' : type}</span>
                            <span className="text-lg font-bold text-slate-800 block">{count}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-1">({pct}%)</span>
                            <span className="text-[9px] font-semibold text-slate-500 mt-1.5 block border-t border-slate-200/60 pt-1 w-full text-center">
                              L: {males} | P: {females}
                            </span>
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
                      placeholder="Kota kelahiran"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-birthdate" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal Lahir</label>
                    <input 
                      type="date" 
                      id="form-birthdate" 
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer" 
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-marital" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Pernikahan</label>
                    <select 
                      id="form-marital" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formStatusPernikahan}
                      onChange={(e) => setFormStatusPernikahan(e.target.value)}
                      required
                    >
                      <option value="Belum Menikah">Belum Menikah</option>
                      <option value="Menikah">Menikah</option>
                      <option value="Janda">Janda</option>
                      <option value="Duda">Duda</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-desa" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DESA</label>
                    {user.role === 'Super Admin' ? (
                      <select 
                        id="form-desa" 
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                        value={formDesa}
                        onChange={(e) => {
                          const newDesa = e.target.value;
                          setFormDesa(newDesa);
                          const dObj = locations.find(d => d.nama_desa === newDesa);
                          if (dObj && dObj.kelompoks.length > 0) {
                            setFormKelompok(dObj.kelompoks[0].nama_kelompok);
                          } else {
                            setFormKelompok('');
                          }
                        }}
                        required
                      >
                        {[...locations].sort((a, b) => a.nama_desa.localeCompare(b.nama_desa)).map(d => (
                          <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                        ))}
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
                    <label htmlFor="form-kelompok" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">KELOMPOK</label>
                    <select 
                      id="form-kelompok" 
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formKelompok}
                      onChange={(e) => setFormKelompok(e.target.value)}
                      required
                    >
                      {[...(locations.find(d => d.nama_desa === formDesa)?.kelompoks || [])].sort((a, b) => a.nama_kelompok.localeCompare(b.nama_kelompok)).map(k => (
                        <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                      ))}
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
                      <option value="Tidak Diketahui">Tidak Diketahui</option>
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
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                      value={formGradDate}
                      onChange={(e) => setFormGradDate(e.target.value)}
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
                    {[...unassociatedJamaahForModal].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)).map(j => (
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
                    {[...unassociatedJamaahForModal].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)).map(j => (
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

      {/* 5. RFID Registration Modal */}
      {isRfidModalOpen && selectedRfidJamaah && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full animate-scaleIn overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Registrasi Kartu RFID</h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeRfidModal}>
                <X size={18} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 text-center">
              <div className="mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NAMA JAMAAH</span>
                <h3 className="text-base font-black text-slate-800 mt-0.5">{selectedRfidJamaah.nama_lengkap}</h3>
                <span className="text-[10px] font-bold text-primary block mt-0.5">{selectedRfidJamaah.kelompok} &bull; {selectedRfidJamaah.desa}</span>
              </div>

              {rfidInputMode === 'view' ? (
                <div className="flex flex-col items-center gap-4 py-3 animate-fadeIn">
                  <div className="bg-emerald-50 text-emerald-600 px-5 py-3.5 rounded-2xl border border-emerald-100 inline-flex flex-col items-center gap-1 shadow-sm">
                    <span className="text-[9px] font-extrabold text-emerald-500 uppercase tracking-widest">KARTU RFID AKTIF</span>
                    <span className="text-base font-mono font-black tracking-wider">{selectedRfidJamaah.rfid}</span>
                  </div>
                  
                  <div className="flex gap-2 w-full mt-2">
                    <button 
                      type="button" 
                      onClick={() => handleSaveRfid('')}
                      disabled={rfidSaving}
                      className="flex-1 py-2.5 font-bold text-xs bg-red-50 hover:bg-red-100 text-red-650 rounded-xl transition-all border border-red-150 cursor-pointer"
                    >
                      Lepas Kartu
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setRfidValue('');
                        setRfidInputMode('scan');
                      }}
                      className="flex-1 py-2.5 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md shadow-primary/10 transition-all cursor-pointer"
                    >
                      Ganti Kartu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-1 animate-fadeIn">
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center animate-pulse">
                      <Download size={22} className="rotate-180" />
                    </div>
                    <p className="text-xs font-bold text-slate-655">Silakan tap kartu RFID pada Reader Anda...</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Biarkan kursor fokus pada kotak input di bawah.</p>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (rfidValue.trim()) {
                        const dup = jamaahList.find(x => x.rfid === rfidValue.trim() && x.id !== selectedRfidJamaah.id);
                        if (dup) {
                          showToast(`Gagal: RFID sudah terikat dengan nama '${dup.nama_lengkap}' dari kelompok '${dup.kelompok}'.`, "error");
                        } else {
                          handleSaveRfid(rfidValue.trim());
                        }
                      }
                    }}
                    className="w-full text-left flex flex-col gap-3"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ID KARTU (RFID UID)</label>
                      <input 
                        type="text"
                        autoFocus
                        value={rfidValue}
                        onChange={(e) => setRfidValue(e.target.value)}
                        placeholder="Menunggu pembaca kartu..."
                        className="w-full text-center font-mono text-sm font-black tracking-wider px-3 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-slate-50"
                        id="rfid-input-capture"
                        readOnly={false}
                      />
                    </div>

                    {rfidValue && jamaahList.find(x => x.rfid === rfidValue.trim() && x.id !== selectedRfidJamaah.id) && (
                      <div className="bg-red-50 border border-red-150 rounded-xl p-3 text-left text-[11px] font-semibold text-red-650 flex gap-2">
                        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <span>Kartu ini sudah terikat dengan:</span>
                          <span className="block font-bold mt-0.5 text-red-800">
                            {(() => {
                              const dup = jamaahList.find(x => x.rfid === rfidValue.trim() && x.id !== selectedRfidJamaah.id);
                              return `${dup.nama_lengkap} (Kelompok: ${dup.kelompok})`;
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-1">
                      <button 
                        type="button" 
                        onClick={() => setRfidManualInput(!rfidManualInput)}
                        className="text-[10px] text-primary font-black hover:underline cursor-pointer"
                      >
                        {rfidManualInput ? "Gunakan Tap Sensor" : "Ketik Manual ID Kartu"}
                      </button>
                    </div>

                    <div className="flex gap-2.5 border-t border-slate-100 pt-4 mt-2">
                      <button 
                        type="button" 
                        className="flex-1 py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all cursor-pointer" 
                        onClick={() => {
                          if (selectedRfidJamaah.rfid) {
                            setRfidInputMode('view');
                            setRfidValue(selectedRfidJamaah.rfid);
                          } else {
                            closeRfidModal();
                          }
                        }}
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        disabled={rfidSaving || !rfidValue.trim() || !!jamaahList.find(x => x.rfid === rfidValue.trim() && x.id !== selectedRfidJamaah.id)}
                        className={`flex-1 py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all cursor-pointer ${
                          (rfidSaving || !rfidValue.trim() || !!jamaahList.find(x => x.rfid === rfidValue.trim() && x.id !== selectedRfidJamaah.id)) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {rfidSaving ? "Menyimpan..." : "Simpan RFID"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Bulk CSV Upload Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-2xl w-full animate-scaleIn overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Unggah Data Massal (Bulk CSV)</h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={closeCsvModal}>
                <X size={18} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 flex flex-col gap-5">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-[11px] font-semibold text-slate-600 leading-relaxed text-left">
                <p className="font-extrabold text-xs text-slate-750 mb-1">Panduan Format Kolom CSV:</p>
                <ul className="list-disc pl-4 flex flex-col gap-0.5">
                  <li>Kolom wajib: <span className="text-red-650 font-bold">Nama Lengkap</span> (atau <span className="font-bold text-slate-700">Nama</span>).</li>
                  <li>Kolom opsional: <span className="font-bold text-slate-700">Jenis Kelamin</span> (L/P), <span className="font-bold text-slate-700">Status Pernikahan</span>, <span className="font-bold text-slate-700">Golongan Darah</span>, <span className="font-bold text-slate-700">Kategori</span> (Balita/Remaja/Dewasa/Lansia), <span className="font-bold text-slate-700">Pendidikan Terakhir</span>, <span className="font-bold text-slate-700">RFID</span>, <span className="font-bold text-slate-700">Desa</span>, <span className="font-bold text-slate-700">Kelompok</span>.</li>
                  <li>Nilai default otomatis jika dikosongkan:
                    <ul className="list-disc pl-4 font-bold text-primary flex flex-wrap gap-x-4 mt-0.5">
                      <li>Status Pernikahan: Belum Menikah</li>
                      <li>Gol. Darah: Tidak Diketahui</li>
                      <li>Status Kehidupan: Hidup</li>
                      <li>Kategori: Dewasa</li>
                      <li>Pendidikan: Tidak Sekolah</li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-primary transition-all cursor-pointer relative bg-slate-50/50">
                <input 
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-2">
                  <Download className="w-8 h-8 text-slate-400 rotate-180" />
                  <span className="text-xs font-bold text-slate-700">Pilih atau seret file CSV ke sini</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Format file wajib CSV sahaja &bull; Ukuran maks 5MB</span>
                </div>
              </div>

              {/* Preview Table */}
              {csvPreview.length > 0 && (
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pratinjau Data ({csvParsedRows.length} Jamaah Terdeteksi)</span>
                  <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[10px] font-semibold text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr className="font-bold text-slate-400 uppercase tracking-widest text-[8.5px] border-b border-slate-150 bg-slate-100">
                          <th className="px-4 py-2">Nama Lengkap</th>
                          <th className="px-4 py-2">Gender</th>
                          <th className="px-4 py-2">Status Nikah</th>
                          <th className="px-4 py-2">Gol. Darah</th>
                          <th className="px-4 py-2">Kategori</th>
                          <th className="px-4 py-2">Desa & Kelompok</th>
                          <th className="px-4 py-2">RFID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30">
                            <td className="px-4 py-2 font-bold text-slate-800">{row.nama_lengkap}</td>
                            <td className="px-4 py-2">{row.jenis_kelamin || '-'}</td>
                            <td className="px-4 py-2">{row.status_pernikahan || '-'}</td>
                            <td className="px-4 py-2">{row.golongan_darah || '-'}</td>
                            <td className="px-4 py-2">{row.kategori || '-'}</td>
                            <td className="px-4 py-2">{row.desa ? `${row.desa} (${row.kelompok || ''})` : '-'}</td>
                            <td className="px-4 py-2 font-mono">{row.rfid || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 mt-2">
                <button type="button" className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all cursor-pointer" onClick={closeCsvModal}>Batal</button>
                <button 
                  type="button" 
                  disabled={importingCsv || csvParsedRows.length === 0}
                  onClick={handleConfirmImport}
                  className={`py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-md shadow-primary/10 transition-all cursor-pointer ${
                    (importingCsv || csvParsedRows.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {importingCsv ? "Mengimpor..." : `Konfirmasi Import (${csvParsedRows.length} Jamaah)`}
                </button>
              </div>
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
