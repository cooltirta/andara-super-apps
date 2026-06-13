"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ShieldAlert, UserCheck, Trash2, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function UserAccessPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null); // null means ADD, otherwise EDIT
  const [formEmail, setFormEmail] = useState('');
  const [locations, setLocations] = useState([]);
  const [formDesa, setFormDesa] = useState('Andara');
  const [formRole, setFormRole] = useState('Member');
  const [formGroup, setFormGroup] = useState('');

  // Detailed permission checkboxes (for Super Admin customization)
  const [permDatabase, setPermDatabase] = useState(false);
  const [permPresensi, setPermPresensi] = useState(false);
  const [permScanQr, setPermScanQr] = useState(false);
  const [permUserAccess, setPermUserAccess] = useState(false);

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
    
    if (user.role === 'Super Admin') {
      return !isSelf && !isPrimarySuperAdmin;
    } else if (user.role === 'Admin') {
      return u.role === 'Member' || u.role === 'Moderator';
    }
    return false;
  };

  const canDeleteUser = (u) => {
    if (!user || !u) return false;
    const isSelf = u.email === user.email;
    const isPrimarySuperAdmin = u.email === 'cooltirta@gmail.com';
    
    if (user.role === 'Super Admin') {
      return !isSelf && !isPrimarySuperAdmin;
    } else if (user.role === 'Admin') {
      return u.role === 'Member' || u.role === 'Moderator';
    }
    return false;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) throw new Error("Tidak terautentikasi");
      const currentUser = await userRes.json();
      setUser(currentUser);

      // Check role access
      if (currentUser.role === 'Member') {
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
  const syncCheckboxesFromRole = (role) => {
    if (role === 'Super Admin') {
      setPermDatabase(true);
      setPermPresensi(true);
      setPermScanQr(true);
      setPermUserAccess(true);
    } else if (role === 'Admin') {
      setPermDatabase(true);
      setPermPresensi(true);
      setPermScanQr(true);
      setPermUserAccess(false);
    } else if (role === 'Moderator') {
      setPermDatabase(false);
      setPermPresensi(true);
      setPermScanQr(true);
      setPermUserAccess(false);
    } else {
      setPermDatabase(false);
      setPermPresensi(false);
      setPermScanQr(false);
      setPermUserAccess(false);
    }
  };

  // Sync role based on checkbox combination
  const updateRoleFromCheckboxes = (db, pres, qr, usr) => {
    if (usr) {
      setFormRole('Super Admin');
      // Auto-check others if Super Admin
      setPermDatabase(true);
      setPermPresensi(true);
      setPermScanQr(true);
    } else if (db) {
      setFormRole('Admin');
    } else if (pres || qr) {
      setFormRole('Moderator');
    } else {
      setFormRole('Member');
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
        setFormDesa(u.desa);
        setFormRole(u.role);
        setFormGroup(u.kelompok || '');
        syncCheckboxesFromRole(u.role);
        setIsModalOpen(true);
      }
    } else {
      // ADD mode
      setSelectedUserId(null);
      setFormEmail('');
      setFormDesa(user.role === 'Super Admin' ? (locations[0]?.nama_desa || 'Andara') : user.desa);
      
      // Default roles based on logged-in user role
      let initialRole = 'Moderator';
      if (user.role === 'Moderator') {
        initialRole = 'Member';
      }
      setFormRole(initialRole);
      setFormGroup('');
      syncCheckboxesFromRole(initialRole);
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

    const payload = {
      role: formRole,
      kelompok: (formRole === 'Moderator' || formRole === 'Admin') ? (formGroup || null) : null,
      desa: formDesa
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

  const getPermissionsList = (role, desa, kelompok) => {
    const isSuper = role === 'Super Admin';
    const isAdmin = role === 'Admin';
    const isMod = role === 'Moderator';

    return [
      {
        category: "Database Jamaah",
        items: [
          { name: "Melihat & membaca semua data jamaah", status: isSuper || isAdmin, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : "-" },
          { name: "Menambah data jamaah baru", status: isSuper || isAdmin, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : "-" },
          { name: "Mengubah / mengedit data jamaah", status: isSuper || isAdmin, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : "-" },
          { name: "Menghapus data jamaah", status: isSuper || isAdmin, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : "-" },
        ]
      },
      {
        category: "Presensi / Kehadiran",
        items: [
          { name: "Melihat laporan & summary kehadiran", status: isSuper || isAdmin || isMod, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : isMod ? `Desa ${desa}, Kelompok ${kelompok || 'Semua'}` : "-" },
          { name: "Mencatat / menginput kehadiran jamaah", status: isSuper || isAdmin || isMod, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : isMod ? `Desa ${desa}, Kelompok ${kelompok || 'Semua'}` : "-" },
          { name: "Menghapus data kehadiran harian", status: isSuper || isAdmin || isMod, scope: isSuper ? "Seluruh Desa" : isAdmin ? `Desa ${desa}` : isMod ? `Desa ${desa}, Kelompok ${kelompok || 'Semua'}` : "-" },
        ]
      },
      {
        category: "Fitur Khusus & Admin",
        items: [
          { name: "Melakukan scan QR Code presensi jamaah", status: isSuper || isAdmin || isMod, scope: "Aktif" },
          { name: "Mengatur hak akses akun Google user lain", status: isSuper || isAdmin, scope: isSuper ? "Seluruh User" : isAdmin ? `Moderator/Member Desa ${desa}` : "-" },
        ]
      }
    ];
  };

  if (!user || user.role === 'Member') {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  let scopeLabel = user.role === 'Admin' ? ` (Desa ${user.desa})` : user.role === 'Moderator' ? ` (Kelompok ${user.kelompok})` : '';

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
        <button id="btn-modal-user" onClick={() => openUserModal()} className="flex items-center gap-2 py-2.5 px-4 font-bold text-xs bg-primary hover:bg-primary-hover text-white rounded-xl shadow-sm transition-all active:scale-[0.98]">
          <UserCheck size={16} />
          <span>Tambah User Akses</span>
        </button>
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
                    <th className="px-6 py-4">Desa</th>
                    <th className="px-6 py-4">Hak Akses</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map(u => {
                    const isSelf = u.email === user.email;
                    const canEdit = canEditUser(u);
                    const canDelete = canDeleteUser(u);

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
                const canDelete = canDeleteUser(u);

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
                          Desa: {u.desa}
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
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/40">
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
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tingkat Hak Akses</h3>
                  <p className="text-xs font-bold text-primary">
                    {detailUser.role === 'Super Admin' ? 'Akses Penuh (Kelola Seluruh Sistem)' :
                     detailUser.role === 'Admin' ? 'Akses Tingkat Desa (Kelola Jamaah & Presensi Desa)' :
                     detailUser.role === 'Moderator' ? 'Akses Tingkat Kelompok (Input & Scan Presensi)' :
                     'Anggota Biasa (Tanpa Akses Khusus)'}
                  </p>
                </div>
              </div>

              {/* Scope Info */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Desa Terpantau</span>
                  <span className="text-xs font-bold text-slate-700">{detailUser.desa || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kelompok Terpantau</span>
                  <span className="text-xs font-bold text-slate-700">
                    {detailUser.role === 'Super Admin' ? 'Semua Kelompok' : 
                     (detailUser.role === 'Admin' || detailUser.role === 'Moderator') ? (detailUser.kelompok || 'Semua Kelompok') : 
                     '-'}
                  </span>
                </div>
              </div>

              {/* Checklist */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Daftar Wewenang Sistem</h3>
                <div className="flex flex-col gap-4.5">
                  {getPermissionsList(detailUser.role, detailUser.desa, detailUser.kelompok).map((cat, cIdx) => (
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
                            {item.status && item.scope && (
                              <span className="text-[8px] font-extrabold bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full shrink-0">
                                {item.scope}
                              </span>
                            )}
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
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scaleIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-850 tracking-tight">
                {selectedUserId ? 'Ubah Hak Akses User' : 'Tambah User Akses Baru'}
              </h2>
              <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <form id="user-access-form" onSubmit={handleUserSubmit} className="flex flex-col gap-4 text-left">
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="form-user-desa" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DESA</label>
                    {user.role === 'Super Admin' ? (
                      <select 
                        id="form-user-desa" 
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 cursor-pointer font-semibold text-sm"
                        value={formDesa}
                        onChange={(e) => {
                          const newDesa = e.target.value;
                          setFormDesa(newDesa);
                          setFormGroup(''); // Reset kelompok selection
                        }}
                        required
                      >
                        {locations.map(d => (
                          <option key={d.id} value={d.nama_desa}>{d.nama_desa}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        id="form-user-desa" 
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-450 font-semibold cursor-not-allowed outline-none text-sm" 
                        value={formDesa}
                        disabled 
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="form-user-role" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tingkat Hak Akses</label>
                    <select 
                      id="form-user-role" 
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 cursor-pointer font-semibold text-sm"
                      value={formRole}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setFormRole(newRole);
                        syncCheckboxesFromRole(newRole);
                      }}
                      required
                    >
                      {roleOptions}
                    </select>
                  </div>
                </div>

                {/* Detailed Checkboxes for Super Admin customization */}
                {user.role === 'Super Admin' && (
                  <div className="flex flex-col gap-2.5 border border-slate-100 bg-slate-50/40 rounded-xl p-3.5 mt-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                      Kustomisasi Hak Akses Rinci
                    </span>
                    
                    <label className="flex items-start gap-2.5 cursor-pointer select-none py-0.5">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-slate-350 text-primary focus:ring-primary cursor-pointer w-4 h-4" 
                        checked={permDatabase}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setPermDatabase(val);
                          updateRoleFromCheckboxes(val, permPresensi, permScanQr, permUserAccess);
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Akses Database Jamaah (CRUD)</span>
                        <span className="text-[10px] text-slate-400 font-semibold leading-normal">Membaca, menambah, mengubah, dan menghapus data jamaah</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none py-0.5">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-slate-350 text-primary focus:ring-primary cursor-pointer w-4 h-4" 
                        checked={permPresensi}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setPermPresensi(val);
                          updateRoleFromCheckboxes(permDatabase, val, permScanQr, permUserAccess);
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Akses Presensi & Kehadiran</span>
                        <span className="text-[10px] text-slate-400 font-semibold leading-normal">Mengisi kehadiran, melihat laporan rekapitulasi, dan menghapus presensi</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none py-0.5">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-slate-350 text-primary focus:ring-primary cursor-pointer w-4 h-4" 
                        checked={permScanQr}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setPermScanQr(val);
                          updateRoleFromCheckboxes(permDatabase, permPresensi, val, permUserAccess);
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Akses Scan QR Code</span>
                        <span className="text-[10px] text-slate-400 font-semibold leading-normal">Melakukan scan kartu QR presensi jamaah saat pengajian</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none py-0.5">
                      <input 
                        type="checkbox" 
                        className="mt-0.5 rounded border-slate-350 text-primary focus:ring-primary cursor-pointer w-4 h-4" 
                        checked={permUserAccess}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setPermUserAccess(val);
                          updateRoleFromCheckboxes(permDatabase, permPresensi, permScanQr, val);
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Akses Manajemen User & Akses Global</span>
                        <span className="text-[10px] text-slate-400 font-semibold leading-normal">Mengatur hak akses Google user lain di tingkat global (Super Admin)</span>
                      </div>
                    </label>
                  </div>
                )}
                
                {/* Dynamic Kelompok select, only shown for Moderator and Admin */}
                {(formRole === 'Moderator' || formRole === 'Admin') && (
                  <div className="flex flex-col gap-2" id="form-user-group-group">
                    <label htmlFor="form-user-group" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">KELOMPOK YANG DIAWASI</label>
                    <select 
                      id="form-user-group" 
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-primary outline-none bg-white text-slate-700 cursor-pointer font-semibold text-sm"
                      value={formGroup}
                      onChange={(e) => setFormGroup(e.target.value)}
                    >
                      <option value="">Semua Kelompok</option>
                      {(locations.find(d => d.nama_desa === formDesa)?.kelompoks || []).map(k => (
                        <option key={k.id} value={k.nama_kelompok}>{k.nama_kelompok}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-4">
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

