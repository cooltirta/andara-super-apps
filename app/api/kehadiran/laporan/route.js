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
    let dateParamIdx = 1;
    let dateQuery = `
      SELECT DISTINCT k.tanggal
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE k.tanggal >= $${dateParamIdx++} AND k.tanggal <= $${dateParamIdx++}
    `;
    const dateParams = [startDate, endDate];
    if (filterDesa) {
      dateQuery += ` AND j.desa = $${dateParamIdx++}`;
      dateParams.push(filterDesa);
    }
    if (filterKelompok) {
      dateQuery += ` AND j.kelompok = $${dateParamIdx++}`;
      dateParams.push(filterKelompok);
    }
    const { rows: dates } = await db.query(`${dateQuery} ORDER BY k.tanggal DESC;`, dateParams);
    const totalSessions = dates.length;

    // 2. Dapatkan total agregat Hadir, Ijin, Tidak Hadir
    let statsParamIdx = 1;
    let statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN k.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN k.status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
        SUM(CASE WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE k.tanggal >= $${statsParamIdx++} AND k.tanggal <= $${statsParamIdx++}
    `;
    const statsParams = [startDate, endDate];
    if (filterDesa) {
      statsQuery += ` AND j.desa = $${statsParamIdx++}`;
      statsParams.push(filterDesa);
    }
    if (filterKelompok) {
      statsQuery += ` AND j.kelompok = $${statsParamIdx++}`;
      statsParams.push(filterKelompok);
    }
    const { rows: statsRows } = await db.query(statsQuery, statsParams);
    const overallStats = statsRows[0] || {};

    // 3. Dapatkan distribusi kehadiran per kelompok
    let groupStatsParamIdx = 1;
    let groupStatsQuery = `
      SELECT 
        j.kelompok,
        COUNT(*) as total,
        SUM(CASE WHEN k.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN k.status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
        SUM(CASE WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE k.tanggal >= $${groupStatsParamIdx++} AND k.tanggal <= $${groupStatsParamIdx++}
    `;
    const groupStatsParams = [startDate, endDate];
    if (filterDesa) {
      groupStatsQuery += ` AND j.desa = $${groupStatsParamIdx++}`;
      groupStatsParams.push(filterDesa);
    }
    if (filterKelompok) {
      groupStatsQuery += ` AND j.kelompok = $${groupStatsParamIdx++}`;
      groupStatsParams.push(filterKelompok);
    }
    groupStatsQuery += " GROUP BY j.kelompok ORDER BY j.kelompok ASC;";
    const { rows: groupStatsList } = await db.query(groupStatsQuery, groupStatsParams);

    // 4. Rekapitulasi per jamaah (tabel detail)
    let jamaahParamIdx = 1;
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
      LEFT JOIN kehadiran k ON j.id = k.jamaah_id AND k.tanggal >= $${jamaahParamIdx++} AND k.tanggal <= $${jamaahParamIdx++}
      WHERE j.status_kehidupan = 'Hidup'
    `;
    const jamaahParams = [startDate, endDate];
    if (filterDesa) {
      jamaahQuery += ` AND j.desa = $${jamaahParamIdx++}`;
      jamaahParams.push(filterDesa);
    }
    if (filterKelompok) {
      jamaahQuery += ` AND j.kelompok = $${jamaahParamIdx++}`;
      jamaahParams.push(filterKelompok);
    }
    jamaahQuery += " GROUP BY j.id, j.nama_lengkap, j.desa, j.kelompok, j.jenis_kelamin ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;";
    const { rows: jamaahList } = await db.query(jamaahQuery, jamaahParams);

    // Parse string aggregates to integers
    const parseNum = (val) => val === null || val === undefined ? 0 : parseInt(val, 10);

    const parsedJamaahList = jamaahList.map(j => ({
      ...j,
      hadir: parseNum(j.hadir),
      ijin: parseNum(j.ijin),
      tidak_hadir: parseNum(j.tidak_hadir)
    }));

    const parsedGroupStatsList = groupStatsList.map(g => ({
      ...g,
      total: parseNum(g.total),
      hadir: parseNum(g.hadir),
      ijin: parseNum(g.ijin),
      tidak_hadir: parseNum(g.tidak_hadir)
    }));

    return NextResponse.json({
      totalSessions,
      stats: {
        hadir: parseNum(overallStats.hadir),
        ijin: parseNum(overallStats.ijin),
        tidak_hadir: parseNum(overallStats.tidak_hadir),
        total: parseNum(overallStats.total)
      },
      distribusiKelompok: parsedGroupStatsList,
      rekapJamaah: parsedJamaahList
    });
  } catch (error) {
    console.error("Gagal memuat laporan kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
