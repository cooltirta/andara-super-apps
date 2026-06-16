"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Search, RotateCcw, ChevronLeft, ChevronRight, RefreshCw, FileText } from 'lucide-react';

export default function ActivityLogsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 25; // 25 logs per page

  // Filters
  const [filterEmail, setFilterEmail] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');

  // Dropdown options
  const actionOptions = [
    { value: '', label: 'Semua Aksi' },
    ...[
      { value: 'LOGIN', label: 'LOGIN (Masuk)' },
      { value: 'VISIT', label: 'VISIT (Akses Halaman)' },
      { value: 'ADD', label: 'ADD (Tambah Data)' },
      { value: 'EDIT', label: 'EDIT (Ubah Data)' },
      { value: 'DELETE', label: 'DELETE (Hapus Data)' },
      { value: 'SAVE_ATTENDANCE', label: 'SAVE_ATTENDANCE (Simpan Hadir)' },
      { value: 'RESET_ATTENDANCE', label: 'RESET_ATTENDANCE (Reset Hadir)' },
      { value: 'SCAN_QR', label: 'SCAN_QR (Scan QR Presensi)' },
      { value: 'ADD_MEMBER', label: 'ADD_MEMBER (Tambah Anggota)' },
      { value: 'DELETE_MEMBER', label: 'DELETE_MEMBER (Keluarkan Anggota)' }
    ].sort((a, b) => a.label.localeCompare(b.label))
  ];

  const targetTypeOptions = [
    { value: '', label: 'Semua Tipe' },
    ...[
      { value: 'AUTH', label: 'AUTH (Otentikasi)' },
      { value: 'PAGE', label: 'PAGE (Halaman)' },
      { value: 'JAMAAH', label: 'JAMAAH (Jamaah)' },
      { value: 'KELUARGA', label: 'KELUARGA (Keluarga)' },
      { value: 'USER', label: 'USER (User Akses)' },
      { value: 'KEHADIRAN', label: 'KEHADIRAN (Presensi)' }
    ].sort((a, b) => a.label.localeCompare(b.label))
  ];

  useEffect(() => {
    checkAuthAndLoad();
  }, [page]);

  const checkAuthAndLoad = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/login');
        return;
      }
      const user = await userRes.json();
      setCurrentUser(user);

      if (!user.can_read_logs) {
        router.push('/dashboard');
        return;
      }

      await fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (filterEmail) queryParams.append('email', filterEmail);
      if (filterAction) queryParams.append('action', filterAction);
      if (filterTargetType) queryParams.append('target_type', filterTargetType);

      const res = await fetch(`/api/activity-logs?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Gagal memuat rekam jejak:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setFilterEmail('');
    setFilterAction('');
    setFilterTargetType('');
    setPage(1);
    // Directly fetch with empty filters
    setTimeout(() => {
      fetchLogs();
    }, 50);
  };

  // Helper for action badge colors
  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'ADD':
      case 'ADD_MEMBER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'EDIT':
      case 'SAVE_ATTENDANCE':
      case 'SCAN_QR':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      case 'DELETE':
      case 'RESET_ATTENDANCE':
      case 'DELETE_MEMBER':
        return 'bg-rose-50 text-rose-700 border-rose-200/50';
      case 'LOGIN':
        return 'bg-sky-50 text-sky-700 border-sky-200/50';
      case 'VISIT':
        return 'bg-slate-100 text-slate-700 border-slate-200/50';
      default:
        return 'bg-grey-50 text-grey-700 border-grey-200/50';
    }
  };

  const formatTimestamp = (ts) => {
    try {
      const date = new Date(ts);
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return ts;
    }
  };

  if (!currentUser || !currentUser.can_read_logs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
        <p className="text-sm text-grey-500 mt-2 font-medium">Memeriksa hak akses...</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-extrabold text-grey-900 tracking-tight">Rekam Jejak Aktivitas (Logs)</h1>
          </div>
          <p className="text-sm text-grey-500 font-medium mt-1">
            Pantau seluruh aktivitas penambahan, pengubahan, penghapusan data, login, dan kunjungan halaman oleh pengguna.
          </p>
        </div>
        <div>
          <button 
            onClick={fetchLogs} 
            className="flex items-center gap-2 px-4 py-2 border border-grey-300 text-sm font-semibold rounded-sm text-grey-700 bg-white hover:bg-grey-50 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-grey-200/50 rounded-md p-4 mb-6 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-email" className="text-xs font-bold uppercase tracking-wider text-grey-500">Cari Email Pengguna</label>
            <div className="relative">
              <input 
                type="text" 
                id="filter-email" 
                className="w-full pl-9 pr-3 py-2 rounded-sm border border-grey-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-sm text-grey-900" 
                placeholder="nama@email.com..."
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-grey-400" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-action" className="text-xs font-bold uppercase tracking-wider text-grey-500">Filter Tipe Aksi</label>
            <select 
              id="filter-action" 
              className="w-full px-3 py-2 rounded-sm border border-grey-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-sm text-grey-900 cursor-pointer"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              {actionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-target" className="text-xs font-bold uppercase tracking-wider text-grey-500">Filter Tipe Target</label>
            <select 
              id="filter-target" 
              className="w-full px-3 py-2 rounded-sm border border-grey-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none bg-white text-sm text-grey-900 cursor-pointer"
              value={filterTargetType}
              onChange={(e) => setFilterTargetType(e.target.value)}
            >
              {targetTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 rounded-sm bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-sm hover:shadow active:scale-[0.98] transition-all cursor-pointer text-center"
            >
              Cari
            </button>
            <button 
              type="button" 
              onClick={handleResetFilters} 
              className="py-2 px-3 rounded-sm bg-grey-100 hover:bg-grey-200 border border-grey-200 text-grey-700 font-semibold text-sm transition-all cursor-pointer text-center"
              title="Reset Filter"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Logs Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white border border-grey-200/50 rounded-md shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mb-2"></div>
            <p className="text-sm text-grey-500 font-medium">Memuat data rekam jejak...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="w-12 h-12 text-grey-300 mb-3" />
            <h3 className="text-base font-bold text-grey-800">Tidak Ada Rekam Jejak</h3>
            <p className="text-sm text-grey-500 font-medium mt-1">
              Tidak ditemukan catatan log aktivitas yang cocok dengan kriteria pencarian Anda.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-grey-200">
                <thead className="bg-grey-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-grey-500 uppercase tracking-wider w-[180px]">Waktu</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-grey-500 uppercase tracking-wider w-[220px]">Pengguna</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-grey-500 uppercase tracking-wider w-[180px]">Aksi</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-grey-500 uppercase tracking-wider w-[150px]">Tipe Target</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-grey-500 uppercase tracking-wider">Keterangan Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-200 bg-white">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-grey-50/50 transition-colors">
                      <td className="px-6 py-3 text-xs text-grey-500 font-semibold whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-6 py-3 text-sm text-grey-800 font-bold whitespace-nowrap">
                        {log.user_email}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-grey-500 font-bold whitespace-nowrap uppercase">
                        {log.target_type}
                      </td>
                      <td className="px-6 py-3 text-sm text-grey-600 font-medium break-words max-w-[400px]">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-grey-150">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-grey-50/30 transition-colors flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-grey-400 font-bold">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className="text-[10px] text-grey-400 font-bold uppercase">
                      Tipe: {log.target_type}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-grey-800">{log.user_email}</h4>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(log.action)}`}>
                      {log.action}
                    </span>
                  </div>
                  <p className="text-xs text-grey-600 font-medium mt-1 bg-grey-50 p-2.5 rounded-sm border border-grey-100/50">
                    {log.details}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination Panel */}
            <div className="bg-white border-t border-grey-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-xs text-grey-500 font-semibold text-center sm:text-left">
                Menampilkan <span className="text-grey-800 font-bold">{Math.min(total, (page - 1) * limit + 1)}</span> sampai{' '}
                <span className="text-grey-800 font-bold">{Math.min(total, page * limit)}</span> dari{' '}
                <span className="text-grey-800 font-bold">{total}</span> rekam jejak
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1 || loading}
                  className="p-2 border border-grey-300 text-grey-700 bg-white hover:bg-grey-50 disabled:opacity-40 rounded-sm transition-all cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Pages Indicators */}
                <div className="text-sm font-bold text-grey-800 px-3">
                  Halaman {page} dari {totalPages}
                </div>

                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages || loading}
                  className="p-2 border border-grey-300 text-grey-700 bg-white hover:bg-grey-50 disabled:opacity-40 rounded-sm transition-all cursor-pointer"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
