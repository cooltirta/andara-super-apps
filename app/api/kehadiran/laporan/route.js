import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  let filterDesa = searchParams.get('desa') || '';
  let filterKelompok = searchParams.get('kelompok') || '';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date dan end_date wajib diisi" }, { status: 400 });
  }

  // Terapkan batas hak wewenang user ke filter
  if (user.role === 'Admin') {
    filterDesa = user.desa;
  } else if (user.role === 'Moderator') {
    filterDesa = user.desa;
    filterKelompok = user.kelompok;
  }

  try {
    // 1. Dapatkan daftar tanggal unik pengajian yang memiliki catatan presensi dalam jangkauan filter
    let dateQuery = `
      SELECT DISTINCT k.tanggal
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE k.tanggal >= ? AND k.tanggal <= ?
    `;
    const dateParams = [startDate, endDate];
    if (filterDesa) {
      dateQuery += " AND j.desa = ?";
      dateParams.push(filterDesa);
    }
    if (filterKelompok) {
      dateQuery += " AND j.kelompok = ?";
      dateParams.push(filterKelompok);
    }
    const dates = db.prepare(`${dateQuery} ORDER BY k.tanggal DESC;`).all(...dateParams);
    const totalSessions = dates.length;

    // 2. Dapatkan total agregat Hadir, Ijin, Tidak Hadir
    let statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN k.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN k.status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
        SUM(CASE WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE k.tanggal >= ? AND k.tanggal <= ?
    `;
    const statsParams = [startDate, endDate];
    if (filterDesa) {
      statsQuery += " AND j.desa = ?";
      statsParams.push(filterDesa);
    }
    if (filterKelompok) {
      statsQuery += " AND j.kelompok = ?";
      statsParams.push(filterKelompok);
    }
    const overallStats = db.prepare(statsQuery).get(...statsParams);

    // 3. Dapatkan distribusi kehadiran per kelompok
    let groupStatsQuery = `
      SELECT 
        j.kelompok,
        COUNT(*) as total,
        SUM(CASE WHEN k.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN k.status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
        SUM(CASE WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE k.tanggal >= ? AND k.tanggal <= ?
    `;
    const groupStatsParams = [startDate, endDate];
    if (filterDesa) {
      groupStatsQuery += " AND j.desa = ?";
      groupStatsParams.push(filterDesa);
    }
    if (filterKelompok) {
      groupStatsQuery += " AND j.kelompok = ?";
      groupStatsParams.push(filterKelompok);
    }
    groupStatsQuery += " GROUP BY j.kelompok ORDER BY j.kelompok ASC;";
    const groupStatsList = db.prepare(groupStatsQuery).all(...groupStatsParams);

    // 4. Rekapitulasi per jamaah (tabel detail)
    let jamaahQuery = `
      SELECT 
        j.id as jamaah_id, 
        j.nama_lengkap, 
        j.desa, 
        j.kelompok, 
        j.jenis_kelamin,
        COALESCE(SUM(CASE WHEN k.status = 'Hadir' THEN 1 ELSE 0 END), 0) as hadir,
        COALESCE(SUM(CASE WHEN k.status = 'Ijin' THEN 1 ELSE 0 END), 0) as ijin,
        COALESCE(SUM(CASE WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END), 0) as tidak_hadir
      FROM jamaah j
      LEFT JOIN kehadiran k ON j.id = k.jamaah_id AND k.tanggal >= ? AND k.tanggal <= ?
      WHERE j.status_kehidupan = 'Hidup'
    `;
    const jamaahParams = [startDate, endDate];
    if (filterDesa) {
      jamaahQuery += " AND j.desa = ?";
      jamaahParams.push(filterDesa);
    }
    if (filterKelompok) {
      jamaahQuery += " AND j.kelompok = ?";
      jamaahParams.push(filterKelompok);
    }
    jamaahQuery += " GROUP BY j.id ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;";
    const jamaahList = db.prepare(jamaahQuery).all(...jamaahParams);

    return NextResponse.json({
      totalSessions,
      stats: {
        hadir: overallStats.hadir || 0,
        ijin: overallStats.ijin || 0,
        tidak_hadir: overallStats.tidak_hadir || 0,
        total: overallStats.total || 0
      },
      distribusiKelompok: groupStatsList,
      rekapJamaah: jamaahList
    });
  } catch (error) {
    console.error("Gagal memuat laporan kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
