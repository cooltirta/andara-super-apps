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
  const filterDesa = searchParams.get('desa') || '';
  const filterKelompok = searchParams.get('kelompok') || '';
  const kategoriStr = searchParams.get('kategori') || '';
  const statusPernikahanStr = searchParams.get('status_pernikahan') || '';

  if (!start || !end) {
    return NextResponse.json({ error: "Parameter start dan end wajib diisi" }, { status: 400 });
  }

  const kategoriArray = kategoriStr ? kategoriStr.split(',') : [];
  const statusPernikahanArray = statusPernikahanStr ? statusPernikahanStr.split(',') : [];

  try {
    let baseQuery = `
      WITH session_counts AS (
        SELECT 
          k.tanggal,
          k.jamaah_id,
          COUNT(*) as count_sessions
        FROM kehadiran k
        JOIN jamaah j ON k.jamaah_id = j.id
        WHERE k.tanggal >= $1 AND k.tanggal <= $2
    `;
    
    const params = [start, end];
    let paramIdx = 3;

    if (!user.monitor_all_desas) {
      if (filterDesa) {
        if (user.desas_pantau && user.desas_pantau.includes(filterDesa)) {
          baseQuery += ` AND j.desa = $${paramIdx++}`;
          params.push(filterDesa);
        } else {
          baseQuery += " AND j.desa = ANY('{}'::text[])";
        }
      } else {
        baseQuery += ` AND j.desa = ANY($${paramIdx++}::text[])`;
        params.push(user.desas_pantau || []);
      }
    } else {
      if (filterDesa) {
        baseQuery += ` AND j.desa = $${paramIdx++}`;
        params.push(filterDesa);
      }
    }

    if (!user.monitor_all_kelompoks) {
      if (filterKelompok) {
        if (user.kelompoks_pantau && user.kelompoks_pantau.includes(filterKelompok)) {
          baseQuery += ` AND j.kelompok = $${paramIdx++}`;
          params.push(filterKelompok);
        } else {
          baseQuery += " AND j.kelompok = ANY('{}'::text[])";
        }
      } else {
        baseQuery += ` AND j.kelompok = ANY($${paramIdx++}::text[])`;
        params.push(user.kelompoks_pantau || []);
      }
    } else {
      if (filterKelompok) {
        baseQuery += ` AND j.kelompok = $${paramIdx++}`;
        params.push(filterKelompok);
      }
    }

    if (kategoriArray.length > 0) {
      baseQuery += ` AND j.kategori = ANY($${paramIdx++})`;
      params.push(kategoriArray);
    }
    if (statusPernikahanArray.length > 0) {
      baseQuery += ` AND j.status_pernikahan = ANY($${paramIdx++})`;
      params.push(statusPernikahanArray);
    }

    baseQuery += `
        GROUP BY k.tanggal, k.jamaah_id
      )
      SELECT 
        tanggal,
        MAX(count_sessions)::int as max_sessions
      FROM session_counts
      GROUP BY tanggal
      ORDER BY tanggal;
    `;

    const { rows } = await db.query(baseQuery, params);
    
    const sessionMap = {};
    rows.forEach(r => {
      sessionMap[r.tanggal] = r.max_sessions;
    });

    return NextResponse.json(sessionMap);
  } catch (error) {
    console.error("Gagal memuat sesi kalender:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
