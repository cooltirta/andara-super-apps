import db from '@/lib/db';
import Link from 'next/link';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MapPin, 
  Calendar, 
  Clock, 
  TrendingUp,
  User,
  ArrowLeft
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatIndonesianDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${days[date.getDay()]}, ${parseInt(day)} ${months[date.getMonth()]} ${year}`;
}

export default async function JamaahStatusPage({ params, searchParams }) {
  const { id } = await params;
  const sParams = await searchParams;

  // Helper to get GMT+7 dates
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt7 = new Date(utc + (3600000 * 7));
  const y = gmt7.getFullYear();
  const m = String(gmt7.getMonth() + 1).padStart(2, '0');
  const d = String(gmt7.getDate()).padStart(2, '0');
  
  const todayStr = `${y}-${m}-${d}`;
  const startOfMonthStr = `${y}-${m}-01`;

  const startDateVal = sParams.start_date || startOfMonthStr;
  const endDateVal = sParams.end_date || todayStr;

  // 1. Fetch Jamaah Profile
  const { rows: jamaahRows } = await db.query(
    "SELECT id, nama_lengkap, kelompok, desa, kategori, status_pernikahan, jenis_kelamin FROM jamaah WHERE id = $1 AND status_kehidupan = 'Hidup';",
    [id]
  );
  
  const jamaah = jamaahRows[0];

  if (!jamaah) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-red-100/30 blur-[100px] pointer-events-none"></div>
        <div className="w-16 h-16 bg-red-50 border border-red-200 text-red-500 flex items-center justify-center rounded-2xl mb-4 shadow-sm">
          <XCircle size={32} />
        </div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Jamaah Tidak Ditemukan</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-xs font-semibold leading-relaxed">
          Data jamaah tidak terdaftar di sistem atau link QR Code tidak valid.
        </p>
      </div>
    );
  }

  // 2. Fetch all targeted sessions for this jamaah and their attendance status within date range
  const { rows: allTargetedSessions } = await db.query(
    `WITH session_attendance AS (
      SELECT DISTINCT ON (s.id)
        s.id as sesi_id, 
        s.tanggal, 
        s.jenis_pengajian,
        s.waktu_mulai,
        k.status, 
        k.waktu_presensi
      FROM sesi s
      JOIN jamaah j ON j.id = $1
      LEFT JOIN kehadiran k ON k.jamaah_id = j.id AND (k.sesi_id::text = s.id::text OR (k.sesi_id IS NULL AND k.tanggal = s.tanggal))
      WHERE j.kelompok = ANY(s.kelompoks)
        AND j.desa = ANY(s.desas)
        AND j.jenis_kelamin = ANY(s.genders)
        AND j.status_pernikahan = ANY(s.marital_statuses)
        AND j.kategori = ANY(s.kategoris)
        AND s.tanggal >= $2
        AND s.tanggal <= $3
      ORDER BY s.id, k.status DESC, k.waktu_presensi DESC
    )
    SELECT * 
    FROM session_attendance
    ORDER BY tanggal DESC, waktu_mulai DESC;`,
    [id, startDateVal, endDateVal]
  );

  const totalSessions = allTargetedSessions.length;
  const totalHadir = allTargetedSessions.filter(r => r.status === 'Hadir').length;
  const totalIjin = allTargetedSessions.filter(r => r.status === 'Ijin').length;
  const totalAlpha = allTargetedSessions.filter(r => !r.status || r.status === 'Tidak Hadir').length;
  const attendanceRate = totalSessions > 0 ? Math.round((totalHadir / totalSessions) * 100) : 0;

  // 3. Slice the first 30 sessions for the timeline history display
  const historyList = allTargetedSessions.slice(0, 30).map(r => ({
    tanggal: r.tanggal,
    status: r.status || 'Tidak Hadir',
    waktu_presensi: r.waktu_presensi
  }));

  // Get color for attendance percentage (light theme)
  const getRateColor = (rate) => {
    if (rate >= 80) return 'text-emerald-700 border-emerald-100 bg-emerald-50/50';
    if (rate >= 60) return 'text-amber-700 border-amber-100 bg-amber-50/50';
    return 'text-red-700 border-red-100 bg-red-50/50';
  };

  const rateClass = getRateColor(attendanceRate);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative overflow-hidden pb-12">
      {/* Background glowing gradients (subtle light colors) */}
      <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-teal-100/30 blur-[100px] pointer-events-none"></div>
      <div className="absolute -left-32 bottom-20 w-96 h-96 rounded-full bg-emerald-100/35 blur-[100px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-md w-full mx-auto px-4 pt-6 flex flex-col gap-6 relative z-10">
        
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/logo.png" alt="Taqlima Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-black tracking-widest text-slate-800 uppercase">TAQLIMA</span>
          </div>
          <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-700 tracking-wider">
            STATUS CHECK
          </span>
        </div>

        {/* Profile Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm shadow-slate-100/50">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center font-black text-xl text-white shadow-md shadow-teal-500/10 shrink-0">
            {jamaah.nama_lengkap.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-800 tracking-tight truncate leading-snug">
              {jamaah.nama_lengkap}
            </h1>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mt-1">
              <MapPin size={12} className="text-teal-600 shrink-0" />
              <span className="truncate">{jamaah.kelompok} &bull; {jamaah.desa}</span>
            </div>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-655 text-[9px] font-extrabold uppercase tracking-wider">
              {jamaah.kategori}
            </span>
          </div>
        </div>

        {/* Date Filter Form */}
        <form method="GET" className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Filter Tanggal</h3>
            <Link href={`/status/${id}`} className="text-[9px] font-bold text-teal-700 hover:underline">Reset</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-450 uppercase">Mulai</label>
              <input 
                type="date" 
                name="start_date" 
                defaultValue={startDateVal}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-600 bg-slate-50 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-450 uppercase">Sampai</label>
              <input 
                type="date" 
                name="end_date" 
                defaultValue={endDateVal}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-600 bg-slate-50 cursor-pointer"
              />
            </div>
          </div>
          <button type="submit" className="w-full py-2 bg-teal-700 hover:bg-teal-850 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer transition-all">
            Terapkan Filter
          </button>
        </form>

        {/* Attendance Rate Display */}
        <div className={`border rounded-2xl p-6 text-center flex flex-col items-center gap-1.5 shadow-sm shadow-slate-100/40 ${rateClass}`}>
          <TrendingUp size={24} className="mb-0.5" />
          <span className="text-4xl font-mono font-black tracking-tight">{attendanceRate}%</span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">PERSENTASE KEHADIRAN</span>
          <span className="text-[9px] font-bold text-slate-500/80 mt-1">
            Dihitung dari {totalSessions} sesi dalam rentang tanggal terpilih
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Hadir */}
          <div className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-sm">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-lg font-mono font-black text-slate-800 mt-1">{totalHadir}</span>
            <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">HADIR</span>
          </div>

          {/* Ijin */}
          <div className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-sm">
            <AlertTriangle size={18} className="text-amber-500" />
            <span className="text-lg font-mono font-black text-slate-800 mt-1">{totalIjin}</span>
            <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">IJIN</span>
          </div>

          {/* Alpha */}
          <div className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-sm">
            <XCircle size={18} className="text-red-500" />
            <span className="text-lg font-mono font-black text-slate-800 mt-1">{totalAlpha}</span>
            <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider">ALPHA</span>
          </div>
        </div>

        {/* Timeline Title */}
        <div className="flex justify-between items-center mt-2 border-b border-slate-200 pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Riwayat 30 Sesi Terakhir
          </h2>
          <span className="text-[9px] font-bold text-slate-400">
            Urut berdasarkan terbaru
          </span>
        </div>

        {/* Presence Timeline list */}
        {historyList.length === 0 ? (
          <div className="text-center py-8 bg-white border border-slate-150 rounded-2xl text-slate-400 text-xs font-bold shadow-sm">
            Belum ada data kehadiran terekam saat ini.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historyList.map((item, idx) => {
              let statusBg = '';
              let statusText = '';
              let statusIcon = null;

              if (item.status === 'Hadir') {
                statusBg = 'bg-emerald-50 border-emerald-100 text-emerald-700';
                statusText = 'Hadir';
                statusIcon = <CheckCircle2 size={12} className="text-emerald-600" />;
              } else if (item.status === 'Ijin') {
                statusBg = 'bg-amber-50 border-amber-100 text-amber-700';
                statusText = 'Ijin';
                statusIcon = <AlertTriangle size={12} className="text-amber-600" />;
              } else {
                statusBg = 'bg-red-50 border-red-100 text-red-750';
                statusText = 'Tidak Hadir';
                statusIcon = <XCircle size={12} className="text-red-600" />;
              }

              return (
                <div 
                  key={idx}
                  className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center gap-3 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {formatIndonesianDate(item.tanggal)}
                    </span>
                    {item.status === 'Hadir' && item.waktu_presensi && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5">
                        <Clock size={10} className="text-teal-600" />
                        <span>Tap pada: {item.waktu_presensi.split(' ')[1].substring(0, 5)} WIB</span>
                      </div>
                    )}
                  </div>

                  <div className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide flex items-center gap-1.5 shrink-0 ${statusBg}`}>
                    {statusIcon}
                    <span>{statusText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
