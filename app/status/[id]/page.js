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

export default async function JamaahStatusPage({ params }) {
  const { id } = await params;

  // 1. Fetch Jamaah Profile
  const { rows: jamaahRows } = await db.query(
    "SELECT id, nama_lengkap, kelompok, desa, kategori, status_pernikahan, jenis_kelamin FROM jamaah WHERE id = $1 AND status_kehidupan = 'Hidup';",
    [id]
  );
  
  const jamaah = jamaahRows[0];

  if (!jamaah) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-red-900/10 blur-[100px] pointer-events-none"></div>
        <div className="w-16 h-16 bg-red-950/40 border border-red-500/20 text-red-400 flex items-center justify-center rounded-2xl mb-4">
          <XCircle size={32} />
        </div>
        <h1 className="text-xl font-black tracking-tight">Jamaah Tidak Ditemukan</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-xs font-semibold leading-relaxed">
          Data jamaah tidak terdaftar di sistem atau link QR Code tidak valid.
        </p>
      </div>
    );
  }

  // 2. Fetch all-time presence counts
  const { rows: presenceCounts } = await db.query(
    "SELECT status, COUNT(*)::int as count FROM kehadiran WHERE jamaah_id = $1 GROUP BY status;",
    [id]
  );
  
  const totalHadir = presenceCounts.find(r => r.status === 'Hadir')?.count || 0;
  const totalIjin = presenceCounts.find(r => r.status === 'Ijin')?.count || 0;

  // 3. Fetch total sessions held for this kelompok
  const { rows: sessionCounts } = await db.query(
    `SELECT COUNT(DISTINCT k.tanggal)::int as count 
     FROM kehadiran k
     JOIN jamaah j ON k.jamaah_id = j.id
     WHERE j.kelompok = $1 AND j.desa = $2;`,
    [jamaah.kelompok, jamaah.desa]
  );
  
  const totalSessions = sessionCounts[0]?.count || 0;
  const totalAlpha = Math.max(0, totalSessions - (totalHadir + totalIjin));
  const attendanceRate = totalSessions > 0 ? Math.round((totalHadir / totalSessions) * 100) : 0;

  // 4. Fetch last 30 sessions of their kelompok
  const { rows: sessionDates } = await db.query(
    `SELECT DISTINCT k.tanggal 
     FROM kehadiran k
     JOIN jamaah j ON k.jamaah_id = j.id
     WHERE j.kelompok = $1 AND j.desa = $2
     ORDER BY k.tanggal DESC
     LIMIT 30;`,
    [jamaah.kelompok, jamaah.desa]
  );

  let historyList = [];
  if (sessionDates.length > 0) {
    const datesArray = sessionDates.map(d => d.tanggal);
    const { rows: historyRows } = await db.query(
      `SELECT tanggal, status, waktu_presensi 
       FROM kehadiran 
       WHERE jamaah_id = $1 AND tanggal = ANY($2);`,
      [id, datesArray]
    );
    
    const presenceMap = {};
    historyRows.forEach(row => {
      presenceMap[row.tanggal] = row;
    });
    
    historyList = datesArray.map(tanggal => {
      const record = presenceMap[tanggal];
      return {
        tanggal,
        status: record ? record.status : 'Tidak Hadir',
        waktu_presensi: record ? record.waktu_presensi : null
      };
    });
  }

  // Get color for attendance percentage
  const getRateColor = (rate) => {
    if (rate >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-950/10';
    if (rate >= 60) return 'text-amber-400 border-amber-500/20 bg-amber-950/10';
    return 'text-red-400 border-red-500/20 bg-red-950/10';
  };

  const rateClass = getRateColor(attendanceRate);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden pb-12">
      {/* Background glowing gradients */}
      <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-emerald-900/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute -left-32 bottom-20 w-96 h-96 rounded-full bg-teal-900/10 blur-[100px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-md w-full mx-auto px-4 pt-6 flex flex-col gap-6 relative z-10">
        
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center font-black text-white text-sm">
              A
            </div>
            <span className="text-xs font-black tracking-widest text-slate-300 uppercase">ANDARA APPS</span>
          </div>
          <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-teal-950/50 border border-teal-500/20 text-teal-400 tracking-wider">
            STATUS CHECK
          </span>
        </div>

        {/* Profile Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4 shadow-xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center font-black text-xl text-white shadow-md shadow-teal-500/10 shrink-0">
            {jamaah.nama_lengkap.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-white tracking-tight truncate leading-snug">
              {jamaah.nama_lengkap}
            </h1>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mt-1">
              <MapPin size={12} className="text-teal-500 shrink-0" />
              <span className="truncate">{jamaah.kelompok} &bull; {jamaah.desa}</span>
            </div>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[9px] font-bold uppercase tracking-wider">
              {jamaah.kategori}
            </span>
          </div>
        </div>

        {/* Attendance Rate Display */}
        <div className={`border rounded-2xl p-6 text-center flex flex-col items-center gap-1.5 shadow-lg backdrop-blur-md ${rateClass}`}>
          <TrendingUp size={24} className="mb-0.5" />
          <span className="text-4xl font-mono font-black tracking-tight">{attendanceRate}%</span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">PERSENTASE KEHADIRAN</span>
          <span className="text-[9px] font-bold text-slate-400/80 mt-1">
            Dihitung dari {totalSessions} total sesi pengajian kelompok Anda
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Hadir */}
          <div className="bg-slate-900/60 border border-emerald-950/40 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-md">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-lg font-mono font-black text-white mt-1">{totalHadir}</span>
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">HADIR</span>
          </div>

          {/* Ijin */}
          <div className="bg-slate-900/60 border border-amber-950/40 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-md">
            <AlertTriangle size={18} className="text-amber-400" />
            <span className="text-lg font-mono font-black text-white mt-1">{totalIjin}</span>
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">IJIN</span>
          </div>

          {/* Alpha */}
          <div className="bg-slate-900/60 border border-red-950/40 rounded-xl p-4 flex flex-col items-center gap-1 text-center shadow-md">
            <XCircle size={18} className="text-red-400" />
            <span className="text-lg font-mono font-black text-white mt-1">{totalAlpha}</span>
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">ALPHA</span>
          </div>
        </div>

        {/* Timeline Title */}
        <div className="flex justify-between items-center mt-2 border-b border-slate-900 pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Riwayat 30 Sesi Terakhir
          </h2>
          <span className="text-[9px] font-bold text-slate-500">
            Urut berdasarkan terbaru
          </span>
        </div>

        {/* Presence Timeline list */}
        {historyList.length === 0 ? (
          <div className="text-center py-8 bg-slate-900/30 border border-slate-900/60 rounded-2xl text-slate-500 text-xs font-bold">
            Belum ada data kehadiran terekam saat ini.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historyList.map((item, idx) => {
              let statusBg = '';
              let statusText = '';
              let statusIcon = null;

              if (item.status === 'Hadir') {
                statusBg = 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400';
                statusText = 'Hadir';
                statusIcon = <CheckCircle2 size={12} className="text-emerald-400" />;
              } else if (item.status === 'Ijin') {
                statusBg = 'bg-amber-950/40 border-amber-900/30 text-amber-400';
                statusText = 'Ijin';
                statusIcon = <AlertTriangle size={12} className="text-amber-400" />;
              } else {
                statusBg = 'bg-red-950/40 border-red-900/30 text-red-400';
                statusText = 'Tidak Hadir';
                statusIcon = <XCircle size={12} className="text-red-400" />;
              }

              return (
                <div 
                  key={idx}
                  className="bg-slate-900/40 border border-slate-900/60 p-4 rounded-xl flex justify-between items-center gap-3 shadow-sm hover:bg-slate-900/60 transition-all duration-200"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {formatIndonesianDate(item.tanggal)}
                    </span>
                    {item.status === 'Hadir' && item.waktu_presensi && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5">
                        <Clock size={10} className="text-teal-500" />
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
