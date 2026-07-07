"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ShieldAlert, UserCheck, Trash2, X, AlertTriangle, CheckCircle, Info, ChevronDown } from 'lucide-react';

export default function UserAccessPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null); // null means ADD, otherwise EDIT
  const [formEmail, setFormEmail] = useState('');
  const [formDesa, setFormDesa] = useState('Andara');
  const [formGroup, setFormGroup] = useState('');
  const [formRole, setFormRole] = useState('Member');

  // Monitored Locations Scopes
  const [monitorAllDesas, setMonitorAllDesas] = useState(false);
  const [desasPantau, setDesasPantau] = useState([]);
  const [monitorAllKelompoks, setMonitorAllKelompoks] = useState(false);
  const [kelompoksPantau, setKelompoksPantau] = useState([]);

  // 21 detailed permissions
  const [canCreateJamaah, setCanCreateJamaah] = useState(false);
  const [canReadJamaah, setCanReadJamaah] = useState(false);
  const [canUpdateJamaah, setCanUpdateJamaah] = useState(false);
  const [canDeleteJamaah, setCanDeleteJamaah] = useState(false);

  const [canCreateKeluarga, setCanCreateKeluarga] = useState(false);
  const [canReadKeluarga, setCanReadKeluarga] = useState(false);
  const [canUpdateKeluarga, setCanUpdateKeluarga] = useState(false);
  const [canDeleteKeluarga, setCanDeleteKeluarga] = useState(false);

  const [canCreateKehadiran, setCanCreateKehadiran] = useState(false);
  const [canReadKehadiran, setCanReadKehadiran] = useState(false);
  const [canUpdateKehadiran, setCanUpdateKehadiran] = useState(false);
  const [canDeleteKehadiran, setCanDeleteKehadiran] = useState(false);

  const [canReadLaporan, setCanReadLaporan] = useState(false);

  const [canCreateUser, setCanCreateUser] = useState(false);
  const [canReadUser, setCanReadUser] = useState(false);
  const [canUpdateUser, setCanUpdateUser] = useState(false);
  const [canDeleteUser, setCanDeleteUser] = useState(false);

  const [canCreateLokasi, setCanCreateLokasi] = useState(false);
  const [canReadLokasi, setCanReadLokasi] = useState(false);
  const [canUpdateLokasi, setCanUpdateLokasi] = useState(false);
  const [canDeleteLokasi, setCanDeleteLokasi] = useState(false);

  const [canReadLogs, setCanReadLogs] = useState(false);

  // Detail Modal States
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

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

  const canEditUser = (u) => {
    if (!user || !u) return false;
    const isSelf = u.email === user.email;
    const isPrimarySuperAdmin = u.email === 'cooltirta@gmail.com';
    
    if (isSelf || isPrimarySuperAdmin) return false;
    if (!user.can_update_user) return false;

    // Check monitored bounds
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(u.desa))) {
      return false;
    }
    if (u.kelompok && !user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(u.kelompok))) {
      return false;
    }
    return true;
  };

  const checkCanDeleteUser = (u) => {
    if (!user || !u) return false;
    const isSelf = u.email === user.email;
    const isPrimarySuperAdmin = u.email === 'cooltirta@gmail.com';
    
    if (isSelf || isPrimarySuperAdmin) return false;
    if (!user.can_delete_user) return false;

    // Check monitored bounds
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(u.desa))) {
      return false;
    }
    if (u.kelompok && !user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(u.kelompok))) {
      return false;
    }
    return true;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await userRes.json();
      setUser(currentUser);

      // Check access permission instead of hardcoded role
      if (!currentUser.can_read_user) {
        showToast("Akses Ditolak: Anda tidak memiliki akses ke User Access Management", "error");
        setTimeout(() => router.push('/dashboard'), 1500);
        return;
      }

      const lokasiRes = await fetch('/api/lokasi');
      if (lokasiRes.ok) {
        setLocations(await lokasiRes.json());
      }

      await fetchUsers();
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsersList(await res.json());
      } else {
        throw new Error("Gagal memuat daftar user akses");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync checkboxes based on preset role selection
  const syncCheckboxesFromRole = (role, currentDesa = formDesa, currentGroup = formGroup) => {
    if (role === 'Super Admin') {
      setMonitorAllDesas(true);
      setDesasPantau([]);
      setMonitorAllKelompoks(true);
      setKelompoksPantau([]);

      setCanCreateJamaah(true); setCanReadJamaah(true); setCanUpdateJamaah(true); setCanDeleteJamaah(true);
      setCanCreateKeluarga(true); setCanReadKeluarga(true); setCanUpdateKeluarga(true); setCanDeleteKeluarga(true);
      setCanCreateKehadiran(true); setCanReadKehadiran(true); setCanUpdateKehadiran(true); setCanDeleteKehadiran(true);
      setCanReadLaporan(true);
      setCanCreateUser(true); setCanReadUser(true); setCanUpdateUser(true); setCanDeleteUser(true);
      setCanCreateLokasi(true); setCanReadLokasi(true); setCanUpdateLokasi(true); setCanDeleteLokasi(true);
      setCanReadLogs(true);
    } else if (role === 'Admin') {
      setMonitorAllDesas(false);
      setDesasPantau([currentDesa]);
      setMonitorAllKelompoks(true);
      setKelompoksPantau([]);

      setCanCreateJamaah(true); setCanReadJamaah(true); setCanUpdateJamaah(true); setCanDeleteJamaah(true);
      setCanCreateKeluarga(true); setCanReadKeluarga(true); setCanUpdateKeluarga(true); setCanDeleteKeluarga(true);
      setCanCreateKehadiran(true); setCanReadKehadiran(true); setCanUpdateKehadiran(true); setCanDeleteKehadiran(true);
      setCanReadLaporan(true);
      setCanCreateUser(true); setCanReadUser(true); setCanUpdateUser(true); setCanDeleteUser(true);
      setCanCreateLokasi(false); setCanReadLokasi(true); setCanUpdateLokasi(false); setCanDeleteLokasi(false);
      setCanReadLogs(false);
    } else if (role === 'Moderator') {
      setMonitorAllDesas(false);
      setDesasPantau([currentDesa]);
      setMonitorAllKelompoks(false);
      setKelompoksPantau(currentGroup ? [currentGroup] : []);

      setCanCreateJamaah(false); setCanReadJamaah(true); setCanUpdateJamaah(false); setCanDeleteJamaah(false);
      setCanCreateKeluarga(false); setCanReadKeluarga(true); setCanUpdateKeluarga(false); setCanDeleteKeluarga(false);
      setCanCreateKehadiran(true); setCanReadKehadiran(true); setCanUpdateKehadiran(true); setCanDeleteKehadiran(true);
      setCanReadLaporan(true);
      setCanCreateUser(false); setCanReadUser(false); setCanUpdateUser(false); setCanDeleteUser(false);
      setCanCreateLokasi(false); setCanReadLokasi(true); setCanUpdateLokasi(false); setCanDeleteLokasi(false);
      setCanReadLogs(false);
    } else {
      // Member / Biasa
      setMonitorAllDesas(false);
      setDesasPantau([currentDesa]);
      setMonitorAllKelompoks(false);
      setKelompoksPantau(currentGroup ? [currentGroup] : []);

      setCanCreateJamaah(false); setCanReadJamaah(false); setCanUpdateJamaah(false); setCanDeleteJamaah(false);
      setCanCreateKeluarga(false); setCanReadKeluarga(false); setCanUpdateKeluarga(false); setCanDeleteKeluarga(false);
      setCanCreateKehadiran(false); setCanReadKehadiran(false); setCanUpdateKehadiran(false); setCanDeleteKehadiran(false);
      setCanReadLaporan(false);
      setCanCreateUser(false); setCanReadUser(false); setCanUpdateUser(false); setCanDeleteUser(false);
      setCanCreateLokasi(false); setCanReadLokasi(false); setCanUpdateLokasi(false); setCanDeleteLokasi(false);
      setCanReadLogs(false);
    }
  };

  const openUserModal = (id = null) => {
    if (!user) return;
    
    if (id) {
      // EDIT mode
      const u = usersList.find(item => item.id === id);
      if (u) {
        setSelectedUserId(id);
        setFormEmail(u.email);
        setFormDesa(u.desa || 'Andara');
        setFormGroup(u.kelompok || '');
        setFormRole(u.role);

        setMonitorAllDesas(!!u.monitor_all_desas);
        setDesasPantau(u.desas_pantau || []);
        setMonitorAllKelompoks(!!u.monitor_all_kelompoks);
        setKelompoksPantau(u.kelompoks_pantau || []);

        setCanCreateJamaah(!!u.can_create_jamaah);
        setCanReadJamaah(!!u.can_read_jamaah);
        setCanUpdateJamaah(!!u.can_update_jamaah);
        setCanDeleteJamaah(!!u.can_delete_jamaah);

        setCanCreateKeluarga(!!u.can_create_keluarga);
        setCanReadKeluarga(!!u.can_read_keluarga);
        setCanUpdateKeluarga(!!u.can_update_keluarga);
        setCanDeleteKeluarga(!!u.can_delete_keluarga);

        setCanCreateKehadiran(!!u.can_create_kehadiran);
        setCanReadKehadiran(!!u.can_read_kehadiran);
        setCanUpdateKehadiran(!!u.can_update_kehadiran);
        setCanDeleteKehadiran(!!u.can_delete_kehadiran);

        setCanReadLaporan(!!u.can_read_laporan);

        setCanCreateUser(!!u.can_create_user);
        setCanReadUser(!!u.can_read_user);
        setCanUpdateUser(!!u.can_update_user);
        setCanDeleteUser(!!u.can_delete_user);

        setCanCreateLokasi(!!u.can_create_lokasi);
        setCanReadLokasi(!!u.can_read_lokasi);
        setCanUpdateLokasi(!!u.can_update_lokasi);
        setCanDeleteLokasi(!!u.can_delete_lokasi);

        setCanReadLogs(!!u.can_read_logs);

        setIsModalOpen(true);
      }
    } else {
      // ADD mode
      setSelectedUserId(null);
      setFormEmail('');
      const defaultDesa = user.monitor_all_desas 
        ? (locations[0]?.nama_desa || 'Andara') 
        : (user.desas_pantau && user.desas_pantau.length > 0 ? user.desas_pantau[0] : 'Andara');
      setFormDesa(defaultDesa);
      setFormGroup('');
      
      let initialRole = 'Moderator';
      if (user.role === 'Moderator') {
        initialRole = 'Member';
      }
      setFormRole(initialRole);
      
      syncCheckboxesFromRole(initialRole, defaultDesa, '');
      setIsModalOpen(true);
    }
  };

  const openDetailModal = (u) => {
    setDetailUser(u);
    setIsDetailOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const isEdit = selectedUserId !== null;

    // Calculate primary village (desa) automatically based on desas_pantau or default
    let computedDesa = 'Andara';
    if (!monitorAllDesas && desasPantau.length > 0) {
      computedDesa = desasPantau[0];
    } else if (user.monitor_all_desas) {
      computedDesa = locations[0]?.nama_desa || 'Andara';
    } else {
      computedDesa = user.desas_pantau?.[0] || 'Andara';
    }

    // Calculate primary group (kelompok) automatically based on kelompoks_pantau
    let computedGroup = null;
    if (!monitorAllKelompoks && kelompoksPantau.length > 0) {
      computedGroup = kelompoksPantau[0];
    }

    // Calculate role preset automatically based on detailed permissions
    let computedRole = 'Member';
    if (canCreateUser || canUpdateUser || canReadLogs) {
      computedRole = 'Super Admin';
    } else if (canCreateJamaah || canCreateKeluarga) {
      computedRole = 'Admin';
    } else if (canCreateKehadiran) {
      computedRole = 'Moderator';
    }

    const payload = {
      role: computedRole,
      kelompok: computedGroup,
      desa: computedDesa,

      monitor_all_desas: monitorAllDesas,
      desas_pantau: desasPantau,
      monitor_all_kelompoks: monitorAllKelompoks,
      kelompoks_pantau: kelompoksPantau,

      can_create_jamaah: canCreateJamaah,
      can_read_jamaah: canReadJamaah,
      can_update_jamaah: canUpdateJamaah,
      can_delete_jamaah: canDeleteJamaah,

      can_create_keluarga: canCreateKeluarga,
      can_read_keluarga: canReadKeluarga,
      can_update_keluarga: canUpdateKeluarga,
      can_delete_keluarga: canDeleteKeluarga,

      can_create_kehadiran: canCreateKehadiran,
      can_read_kehadiran: canReadKehadiran,
      can_update_kehadiran: canUpdateKehadiran,
      can_delete_kehadiran: canDeleteKehadiran,

      can_read_laporan: canReadLaporan,

      can_create_user: canCreateUser,
      can_read_user: canReadUser,
      can_update_user: canUpdateUser,
      can_delete_user: canDeleteUser,

      can_create_lokasi: canCreateLokasi,
      can_read_lokasi: canReadLokasi,
      can_update_lokasi: canUpdateLokasi,
      can_delete_lokasi: canDeleteLokasi,

      can_read_logs: canReadLogs
    };

    if (!isEdit) {
      payload.email = formEmail;
    }

    try {
      const url = isEdit ? `/api/users/${selectedUserId}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, "success");
        setIsModalOpen(false);
        fetchUsers();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan data user", "error");
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm("Hapus hak akses user ini? Jamaah tersebut tidak akan bisa menggunakan fitur-fitur khusus lagi.")) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        fetchUsers();
      } else {
        showToast(data.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menghapus user", "error");
    }
  };

  const getPermissionsList = (u) => {
    if (!u) return [];
    return [
      {
        category: "Database Jamaah",
        items: [
          { name: "Melihat & membaca data jamaah", status: u.can_read_jamaah },
          { name: "Menambah data jamaah baru", status: u.can_create_jamaah },
          { name: "Mengubah / mengedit data jamaah", status: u.can_update_jamaah },
          { name: "Menghapus data jamaah", status: u.can_delete_jamaah },
        ]
      },
      {
        category: "Unit Keluarga",
        items: [
          { name: "Melihat & membaca data keluarga", status: u.can_read_keluarga },
          { name: "Membuat unit keluarga baru", status: u.can_create_keluarga },
          { name: "Mengubah / menambah anggota keluarga", status: u.can_update_keluarga },
          { name: "Menghapus unit keluarga", status: u.can_delete_keluarga },
        ]
      },
      {
        category: "Presensi / Kehadiran",
        items: [
          { name: "Melihat & membaca data kehadiran", status: u.can_read_kehadiran },
          { name: "Mencatat / menginput kehadiran jamaah", status: u.can_create_kehadiran },
          { name: "Mengubah data kehadiran", status: u.can_update_kehadiran },
          { name: "Menghapus data kehadiran", status: u.can_delete_kehadiran },
          { name: "Melihat laporan rekapitulasi kehadiran", status: u.can_read_laporan },
        ]
      },
      {
        category: "Manajemen User & Lokasi",
        items: [
          { name: "Melihat daftar user akses", status: u.can_read_user },
          { name: "Menambah user akses baru", status: u.can_create_user },
          { name: "Mengubah hak akses user", status: u.can_update_user },
          { name: "Menghapus user akses", status: u.can_delete_user },
          { name: "Membaca data lokasi desa/kelompok", status: u.can_read_lokasi },
          { name: "Menambah lokasi desa/kelompok", status: u.can_create_lokasi },
          { name: "Mengubah lokasi desa/kelompok", status: u.can_update_lokasi },
          { name: "Menghapus lokasi desa/kelompok", status: u.can_delete_lokasi },
        ]
      },
      {
        category: "Rekam Jejak",
        items: [
          { name: "Membaca rekam jejak aktivitas (Logs)", status: u.can_read_logs }
        ]
      }
    ];
  };

  if (!user || !user.can_read_user) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

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

  // Calculate available role options for modal based on logged in user's role
  let roleOptions = [];
  if (user.role === 'Moderator') {
    roleOptions = [<option key="Member" value="Member">Anggota Biasa (Tanpa Akses Khusus)</option>];
  } else if (user.role === 'Admin') {
    roleOptions = [
      <option key="Member" value="Member">Anggota Biasa (Tanpa Akses Khusus)</option>,
      <option key="Moderator" value="Moderator">Akses Tingkat Kelompok (Input & Scan Presensi)</option>
    ];
  } else if (user.role === 'Super Admin') {
    roleOptions = [
      <option key="Member" value="Member">Anggota Biasa (Tanpa Akses Khusus)</option>,
      <option key="Moderator" value="Moderator">Akses Tingkat Kelompok (Input & Scan Presensi)</option>,
      <option key="Admin" value="Admin">Akses Tingkat Desa (Kelola Jamaah & Presensi Desa)</option>,
      <option key="Super Admin" value="Super Admin">Akses Penuh (Kelola Seluruh Sistem)</option>
    ];
  }

  // All desas list
  const desas = locations.map(l => l.nama_desa);

  return (
    <div className="font-sans text-slate-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Manajemen Akses Pengguna{scopeLabel}
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Atur tingkat dan hak akses fungsional untuk akun Google jamaah
          </p>
        </div>
        {user.can_create_user && (
          <button id="btn-modal-user" onClick={() => openUserModal()} className="flex items-center gap-2 py-2.5 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-xl shadow-sm transition-all active:scale-[0.98]">
            <UserCheck size={16} />
            <span>Tambah User Akses</span>
          </button>
        )}
      </div>

      <div id="users-content-area">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : usersList.length === 0 ? (
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <ShieldAlert size={48} className="opacity-40 mb-4 text-slate-400" />
            <p className="font-bold text-sm">Tidak ada data user terdaftar dalam wewenang Anda.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Email Pengguna</th>
                    <th className="px-6 py-4">Desa Utama</th>
                    <th className="px-6 py-4">Hak Akses</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map(u => {
                    const isSelf = u.email === user.email;
                    const canEdit = canEditUser(u);
                    const canDelete = checkCanDeleteUser(u);

                    return (
                      <tr key={u.id} id={`row-user-${u.id}`} className="hover:bg-slate-50/50 transition-colors text-sm font-semibold text-slate-650">
                        <td className="px-6 py-4.5 font-bold text-slate-800">
                          {u.email} {isSelf && <span className="text-xs text-primary font-bold ml-1">(Anda)</span>}
                        </td>
                        <td className="px-6 py-4.5 text-secondary font-bold">{u.desa}</td>
                        <td className="px-6 py-4.5">
                          <button 
                            onClick={() => openDetailModal(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary border border-slate-200/60 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <Info size={13} className="shrink-0 text-slate-400 group-hover:text-primary" />
                            <span>Detail Akses</span>
                          </button>
                        </td>
                        <td className="px-6 py-4.5">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit && (
                              <button className="p-2 rounded-lg bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary transition-all duration-150 btn-edit-user cursor-pointer" onClick={() => openUserModal(u.id)} title="Ubah Hak Akses">
                                <Shield size={15} />
                              </button>
                            )}
                            {canDelete && (
                              <button className="p-2 rounded-lg bg-red-50 hover:bg-red-500 text-red-700 hover:text-white transition-all duration-150 btn-delete-user cursor-pointer" onClick={() => handleDeleteUser(u.id)} title="Hapus User">
                                <Trash2 size={15} />
                              </button>
                            )}
                            {!canEdit && !canDelete && (
                              <span className="text-xs text-slate-400 font-bold italic">Tidak ada aksi</span>
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
              {usersList.map(u => {
                const isSelf = u.email === user.email;
                const canEdit = canEditUser(u);
                const canDelete = checkCanDeleteUser(u);

                return (
                  <div key={u.id} className="p-4 flex flex-col gap-3.5 hover:bg-slate-50/30 transition-colors">
                    {/* User email & Desa */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-bold text-slate-800 break-all">
                          {u.email}
                          {isSelf && <span className="text-xs text-primary font-bold ml-1.5">(Anda)</span>}
                        </span>
                        <span className="text-[10px] text-slate-405 font-bold uppercase tracking-wide">
                          Desa Utama: {u.desa}
                        </span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] uppercase shrink-0">
                        {u.role === 'Super Admin' ? 'Penuh' : u.role === 'Admin' ? 'Desa' : u.role === 'Moderator' ? 'Klpk' : 'Biasa'}
                      </span>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-4 mt-1 border-t border-slate-50 pt-3">
                      {/* Detail button */}
                      <button 
                        onClick={() => openDetailModal(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary border border-slate-200/60 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <Info size={14} className="shrink-0 text-slate-400" />
                        <span>Detail Akses</span>
                      </button>

                      {/* Edit/Delete buttons */}
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button className="p-2.5 rounded-xl bg-slate-50 hover:bg-primary-light text-slate-650 hover:text-primary border border-slate-200/40 transition-all duration-150 btn-edit-user cursor-pointer" onClick={() => openUserModal(u.id)} title="Ubah Hak Akses">
                            <Shield size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button className="p-2.5 rounded-xl bg-red-50 hover:bg-red-500 text-red-750 hover:text-white border border-red-100/30 transition-all duration-150 btn-delete-user cursor-pointer" onClick={() => handleDeleteUser(u.id)} title="Hapus User">
                            <Trash2 size={16} />
                          </button>
                        )}
                        {!canEdit && !canDelete && (
                          <span className="text-[11px] text-slate-400 font-bold italic">Tidak ada aksi</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Detail Hak Akses */}
      {isDetailOpen && detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn" id="detail-modal-backdrop">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/40 border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-850 tracking-tight">Rincian Detail Hak Akses</h2>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{detailUser.email}</p>
              </div>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" onClick={() => { setIsDetailOpen(false); setDetailUser(null); }}>
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 text-left">
              {/* Preset Info */}
              <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10 flex items-center gap-3">
                <Shield className="text-primary shrink-0" size={20} />
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tingkat Hak Akses Preset</h3>
                  <p className="text-xs font-bold text-primary text-emerald-700">
                    {detailUser.role === 'Super Admin' ? 'Akses Penuh (Kelola Seluruh Sistem)' :
                     detailUser.role === 'Admin' ? 'Akses Tingkat Desa (Kelola Desa)' :
                     detailUser.role === 'Moderator' ? 'Akses Tingkat Kelompok (Mencatat Presensi)' :
                     'Anggota Biasa (Tanpa Akses Khusus)'}
                  </p>
                </div>
              </div>

              {/* Scope Info */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 flex flex-col gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Desa Terpantau</span>
                  <span className="text-xs font-bold text-slate-700">
                    {detailUser.monitor_all_desas 
                      ? 'Semua Desa (Akses Global)' 
                      : (detailUser.desas_pantau && detailUser.desas_pantau.length > 0 ? detailUser.desas_pantau.join(', ') : 'Tidak ada')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kelompok Terpantau</span>
                  <span className="text-xs font-bold text-slate-700">
                    {detailUser.monitor_all_kelompoks 
                      ? 'Semua Kelompok (Akses Global)' 
                      : (detailUser.kelompoks_pantau && detailUser.kelompoks_pantau.length > 0 ? detailUser.kelompoks_pantau.join(', ') : 'Tidak ada')}
                  </span>
                </div>
              </div>

              {/* Checklist */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Daftar Wewenang Sistem</h3>
                <div className="flex flex-col gap-4.5">
                  {getPermissionsList(detailUser).map((cat, cIdx) => (
                    <div key={cIdx} className="flex flex-col gap-2">
                      <h4 className="text-[10px] font-extrabold text-slate-400 border-b border-slate-100 pb-1">{cat.category}</h4>
                      <div className="flex flex-col gap-1.5">
                        {cat.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex items-center justify-between py-1 px-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              {item.status ? (
                                <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0 font-extrabold text-[10px]">✓</span>
                              ) : (
                                <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-red-50 text-red-500 shrink-0 font-extrabold text-[10px]">✕</span>
                              )}
                              <span className={`text-xs font-bold ${item.status ? 'text-slate-650' : 'text-slate-400 line-through decoration-slate-250'}`}>
                                {item.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex justify-end gap-2.5">
              <button 
                type="button" 
                className="py-2 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all active:scale-[0.98]"
                onClick={() => { setIsDetailOpen(false); setDetailUser(null); }}
              >
                Tutup
              </button>
              {canEditUser(detailUser) && (
                <button 
                  type="button" 
                  className="py-2 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm shadow-primary/10 transition-all active:scale-[0.98]"
                  onClick={() => {
                    const targetId = detailUser.id;
                    setIsDetailOpen(false);
                    setDetailUser(null);
                    openUserModal(targetId);
                  }}
                >
                  Ubah Hak Akses
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit User Access */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn" id="user-modal-backdrop">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">
                {selectedUserId ? 'Ubah Hak Akses User' : 'Tambah User Akses Baru'}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="user-access-form" onSubmit={handleUserSubmit} className="flex flex-col gap-5 text-left">
                {/* Email input */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="form-user-email" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Akun Google</label>
                  {selectedUserId ? (
                    <input 
                      type="email" 
                      id="form-user-email" 
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 font-semibold cursor-not-allowed outline-none text-sm" 
                      value={formEmail}
                      disabled 
                    />
                  ) : (
                    <input 
                      type="email" 
                      id="form-user-email" 
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none bg-white text-slate-700 font-semibold text-sm" 
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required 
                      placeholder="contoh@gmail.com"
                    />
                  )}
                </div>
                
                {/* Monitored Locations Section (Dropdown Multi-Select) */}
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 flex flex-col gap-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1.5">
                    Konfigurasi Wilayah Terpantau
                  </span>

                  {/* Desa Terpantau */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-605">Desa Terpantau</span>
                      {user.monitor_all_desas && (
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            checked={monitorAllDesas}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setMonitorAllDesas(val);
                              setDesasPantau([]);
                            }}
                          />
                          <span>PANTAU SEMUA DESA</span>
                        </label>
                      )}
                    </div>
                    {!monitorAllDesas && (
                      <MultiSelectDropdown
                        label=""
                        options={user.monitor_all_desas ? desas : (user.desas_pantau || [])}
                        selected={desasPantau}
                        onChange={setDesasPantau}
                        placeholder="Pilih Desa Terpantau..."
                        allLabel="Semua Desa"
                        badgeCountLabel="Desa Terpilih"
                      />
                    )}
                  </div>

                  {/* Kelompoks monitored dropdown */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-605">Kelompok Terpantau</span>
                      {user.monitor_all_kelompoks && (
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            checked={monitorAllKelompoks}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setMonitorAllKelompoks(val);
                              setKelompoksPantau([]);
                            }}
                          />
                          <span>PANTAU SEMUA KELOMPOK</span>
                        </label>
                      )}
                    </div>
                    {!monitorAllKelompoks && (
                      <GroupedMultiSelectDropdown
                        label=""
                        groupedOptions={locations
                          .filter(l => monitorAllDesas || desasPantau.includes(l.nama_desa))
                          .map(l => ({
                            desa: l.nama_desa,
                            kelompoks: l.kelompoks
                              .filter(k => user.monitor_all_kelompoks || (user.kelompoks_pantau || []).includes(k.nama_kelompok))
                              .map(k => k.nama_kelompok)
                          }))
                          .filter(g => g.kelompoks.length > 0)}
                        selected={kelompoksPantau}
                        onChange={setKelompoksPantau}
                        placeholder="Pilih Kelompok Terpantau..."
                      />
                    )}
                  </div>
                </div>

                {/* 21 Detailed Permission Custom Checkboxes Grid */}
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 flex flex-col gap-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1.5">
                    Kustomisasi Hak Akses Fungsional (Rinci)
                  </span>

                  {/* 1. Daftar Jamaah */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">1. Daftar Jamaah</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadJamaah} onChange={(e) => setCanReadJamaah(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canCreateJamaah} onChange={(e) => setCanCreateJamaah(e.target.checked)} />
                        <span>Menambah (Create)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canUpdateJamaah} onChange={(e) => setCanUpdateJamaah(e.target.checked)} />
                        <span>Mengubah (Update)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canDeleteJamaah} onChange={(e) => setCanDeleteJamaah(e.target.checked)} />
                        <span>Menghapus (Delete)</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. Unit Keluarga */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">2. Unit Keluarga</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadKeluarga} onChange={(e) => setCanReadKeluarga(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canCreateKeluarga} onChange={(e) => setCanCreateKeluarga(e.target.checked)} />
                        <span>Membuat (Create)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canUpdateKeluarga} onChange={(e) => setCanUpdateKeluarga(e.target.checked)} />
                        <span>Mengubah (Update)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canDeleteKeluarga} onChange={(e) => setCanDeleteKeluarga(e.target.checked)} />
                        <span>Menghapus (Delete)</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Presensi & Kehadiran */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">3. Presensi & Kehadiran</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadKehadiran} onChange={(e) => setCanReadKehadiran(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canCreateKehadiran} onChange={(e) => setCanCreateKehadiran(e.target.checked)} />
                        <span>Menambah (Create)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canUpdateKehadiran} onChange={(e) => setCanUpdateKehadiran(e.target.checked)} />
                        <span>Mengubah (Update)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canDeleteKehadiran} onChange={(e) => setCanDeleteKehadiran(e.target.checked)} />
                        <span>Menghapus (Delete)</span>
                      </label>
                    </div>
                  </div>

                  {/* 4. Laporan Kehadiran */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">4. Laporan Kehadiran</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none col-span-2">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadLaporan} onChange={(e) => setCanReadLaporan(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                    </div>
                  </div>

                  {/* 5. User Access */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">5. User Access</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadUser} onChange={(e) => setCanReadUser(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canCreateUser} onChange={(e) => setCanCreateUser(e.target.checked)} />
                        <span>Menambah (Create)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canUpdateUser} onChange={(e) => setCanUpdateUser(e.target.checked)} />
                        <span>Mengubah (Update)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canDeleteUser} onChange={(e) => setCanDeleteUser(e.target.checked)} />
                        <span>Menghapus (Delete)</span>
                      </label>
                    </div>
                  </div>

                  {/* 6. Manajemen Lokasi */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">6. Manajemen Lokasi</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadLokasi} onChange={(e) => setCanReadLokasi(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canCreateLokasi} onChange={(e) => setCanCreateLokasi(e.target.checked)} />
                        <span>Menambah (Create)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canUpdateLokasi} onChange={(e) => setCanUpdateLokasi(e.target.checked)} />
                        <span>Mengubah (Update)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canDeleteLokasi} onChange={(e) => setCanDeleteLokasi(e.target.checked)} />
                        <span>Menghapus (Delete)</span>
                      </label>
                    </div>
                  </div>

                  {/* 7. Rekam Jejak */}
                  <div className="flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">7. Rekam Jejak (Logs)</span>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-655 cursor-pointer select-none col-span-2">
                        <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" checked={canReadLogs} onChange={(e) => setCanReadLogs(e.target.checked)} />
                        <span>Membaca (Read)</span>
                      </label>
                    </div>
                  </div>
                </div>
                

                
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-4 shrink-0">
                  <button type="button" className="py-2.5 px-4 font-bold text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all" onClick={() => setIsModalOpen(false)}>Batal</button>
                  <button type="submit" className="py-2.5 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-lg transition-all">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <div className="toast-container fixed bottom-8 right-8 z-50 flex flex-col gap-3" id="toast-container">
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
      {label && <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</span>}
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
                <label key={opt} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-pointer font-semibold text-slate-655 text-xs">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt)}
                    className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
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
      {label && <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</span>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-755 font-bold text-xs flex items-center justify-between hover:border-primary transition-all shadow-sm cursor-pointer outline-none min-h-[34px]"
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
                      <label key={k} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-slate-50 cursor-pointer font-semibold text-slate-655 text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOption(k)}
                          className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
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
