import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_read_laporan) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: "Parameter start dan end wajib diisi" }, { status: 400 });
  }

  try {
    let baseQuery = `
      SELECT tanggal, COUNT(*)::int as count_sessions 
      FROM sesi 
      WHERE tanggal >= $1 AND tanggal <= $2
    `;
    const params = [start, end];
    let paramIdx = 3;

    // Filter sesi berdasarkan wilayah wewenang pengguna jika bukan Admin global
    if (user.role !== 'Admin' && !user.monitor_all_desas) {
      const allowedDesas = [user.desa, ...(user.desas_pantau || [])];
      const allowedKelompoks = [user.kelompok, ...(user.kelompoks_pantau || [])];

      baseQuery += ` AND (desas && $${paramIdx++}::varchar[] OR kelompoks && $${paramIdx++}::varchar[])`;
      params.push(allowedDesas, allowedKelompoks);
    }

    baseQuery += ` GROUP BY tanggal ORDER BY tanggal;`;

    const { rows } = await db.query(baseQuery, params);
    
    const sessionMap = {};
    rows.forEach(r => {
      sessionMap[r.tanggal] = r.count_sessions;
    });

    return NextResponse.json(sessionMap);
  } catch (error) {
    console.error("Gagal memuat sesi kalender:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
