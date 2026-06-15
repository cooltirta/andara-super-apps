import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  // Ini dapat berisi string YYYY-MM-DD HH:MM:SS atau YYYY-MM-DD
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  let filterDesa = searchParams.get('desa') || '';
  let filterKelompok = searchParams.get('kelompok') || '';
  const kategoriStr = searchParams.get('kategori') || '';
  const statusPernikahanStr = searchParams.get('status_pernikahan') || '';

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

  const kategoriArray = kategoriStr ? kategoriStr.split(',') : [];
  const statusPernikahanArray = statusPernikahanStr ? statusPernikahanStr.split(',') : [];

  try {
    await logActivity(user.email, 'VISIT', 'PAGE', 'PRESENSI_LAPORAN', `Mengakses Laporan Kehadiran (${startDate} s/d ${endDate})`);

    // Helper untuk merangkai wewenang filter jamaah secara konsisten
    function buildConditions(startParamIdx) {
      let idx = startParamIdx;
      let sql = '';
      const params = [];
      
      if (filterDesa) {
        sql += ` AND j.desa = $${idx++}`;
        params.push(filterDesa);
      }
      if (filterKelompok) {
        sql += ` AND j.kelompok = $${idx++}`;
        params.push(filterKelompok);
      }
      if (kategoriArray.length > 0) {
        sql += ` AND j.kategori = ANY($${idx++})`;
        params.push(kategoriArray);
      }
      if (statusPernikahanArray.length > 0) {
        sql += ` AND j.status_pernikahan = ANY($${idx++})`;
        params.push(statusPernikahanArray);
      }
      return { sql, params, nextIdx: idx };
    }

    // 1. Dapatkan jumlah sesi unik (dikelompokkan per jam untuk menghindari double-count scan instan)
    let dateQuery = `
      SELECT DISTINCT COALESCE(SUBSTRING(k.waktu_presensi FROM 1 FOR 13), k.tanggal || ' 00') as sesi
      FROM kehadiran k
      JOIN jamaah j ON k.jamaah_id = j.id
      WHERE COALESCE(k.waktu_presensi, k.tanggal || ' 00:00:00') >= $1 
        AND COALESCE(k.waktu_presensi, k.tanggal || ' 23:59:59') <= $2
    `;
    const { sql: condSqlDates, params: condParamsDates } = buildConditions(3);
    dateQuery += condSqlDates;
    const dateParams = [startDate, endDate, ...condParamsDates];
    const { rows: dates } = await db.query(dateQuery, dateParams);
    const totalSessions = dates.length;

    // 2. Dapatkan total agregat Hadir, Ijin, Tidak Hadir (Secara Distinct per Jamaah)
    let statsQuery = `
      WITH status_per_jamaah AS (
        SELECT 
          j.id as jamaah_id,
          MAX(CASE WHEN k.status = 'Hadir' THEN 3 WHEN k.status = 'Ijin' THEN 2 WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END) as max_status_val
        FROM jamaah j
        LEFT JOIN kehadiran k ON j.id = k.jamaah_id 
          AND COALESCE(k.waktu_presensi, k.tanggal || ' 00:00:00') >= $1 
          AND COALESCE(k.waktu_presensi, k.tanggal || ' 23:59:59') <= $2
        WHERE j.status_kehidupan = 'Hidup'
    `;
    const { sql: condSqlStats, params: condParamsStats } = buildConditions(3);
    statsQuery += condSqlStats;
    statsQuery += `
        GROUP BY j.id
      )
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN max_status_val = 3 THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN max_status_val = 2 THEN 1 ELSE 0 END) as ijin,
        SUM(CASE WHEN max_status_val = 1 OR max_status_val = 0 THEN 1 ELSE 0 END) as tidak_hadir
      FROM status_per_jamaah;
    `;
    const statsParams = [startDate, endDate, ...condParamsStats];
    const { rows: statsRows } = await db.query(statsQuery, statsParams);
    const overallStats = statsRows[0] || { total: 0, hadir: 0, ijin: 0, tidak_hadir: 0 };

    // 3. Dapatkan distribusi kehadiran per kelompok (Secara Distinct per Jamaah)
    let groupQuery = `
      WITH status_per_jamaah AS (
        SELECT 
          j.id as jamaah_id,
          j.kelompok,
          MAX(CASE WHEN k.status = 'Hadir' THEN 3 WHEN k.status = 'Ijin' THEN 2 WHEN k.status = 'Tidak Hadir' THEN 1 ELSE 0 END) as max_status_val
        FROM jamaah j
        LEFT JOIN kehadiran k ON j.id = k.jamaah_id 
          AND COALESCE(k.waktu_presensi, k.tanggal || ' 00:00:00') >= $1 
          AND COALESCE(k.waktu_presensi, k.tanggal || ' 23:59:59') <= $2
        WHERE j.status_kehidupan = 'Hidup'
    `;
    const { sql: condSqlGroup, params: condParamsGroup } = buildConditions(3);
    groupQuery += condSqlGroup;
    groupQuery += `
        GROUP BY j.id, j.kelompok
      )
      SELECT 
        kelompok,
        COUNT(*) as total,
        SUM(CASE WHEN max_status_val = 3 THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN max_status_val = 2 THEN 1 ELSE 0 END) as ijin,
        SUM(CASE WHEN max_status_val = 1 OR max_status_val = 0 THEN 1 ELSE 0 END) as tidak_hadir
      FROM status_per_jamaah
      GROUP BY kelompok
      ORDER BY kelompok ASC;
    `;
    const groupParams = [startDate, endDate, ...condParamsGroup];
    const { rows: groupStatsList } = await db.query(groupQuery, groupParams);

    // 4. Rekapitulasi per jamaah (tabel detail - dihitung distinct per sesi jam)
    let jamaahQuery = `
      SELECT 
        j.id as jamaah_id, 
        j.nama_lengkap, 
        j.desa, 
        j.kelompok, 
        j.jenis_kelamin,
        COALESCE(COUNT(DISTINCT CASE WHEN k.status = 'Hadir' THEN COALESCE(SUBSTRING(k.waktu_presensi FROM 1 FOR 13), k.tanggal || ' 00') END), 0) as hadir,
        COALESCE(COUNT(DISTINCT CASE WHEN k.status = 'Ijin' THEN COALESCE(SUBSTRING(k.waktu_presensi FROM 1 FOR 13), k.tanggal || ' 00') END), 0) as ijin
      FROM jamaah j
      LEFT JOIN kehadiran k ON j.id = k.jamaah_id 
        AND COALESCE(k.waktu_presensi, k.tanggal || ' 00:00:00') >= $1 
        AND COALESCE(k.waktu_presensi, k.tanggal || ' 23:59:59') <= $2
      WHERE j.status_kehidupan = 'Hidup'
    `;
    const { sql: condSqlJamaah, params: condParamsJamaah } = buildConditions(3);
    jamaahQuery += condSqlJamaah;
    jamaahQuery += `
      GROUP BY j.id, j.nama_lengkap, j.desa, j.kelompok, j.jenis_kelamin
      ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;
    `;
    const jamaahParams = [startDate, endDate, ...condParamsJamaah];
    const { rows: jamaahList } = await db.query(jamaahQuery, jamaahParams);

    const parseNum = (val) => val === null || val === undefined ? 0 : parseInt(val, 10);

    const parsedJamaahList = jamaahList.map(j => {
      const hadir = parseNum(j.hadir);
      const ijin = parseNum(j.ijin);
      const tidak_hadir = Math.max(0, totalSessions - hadir - ijin);
      return {
        ...j,
        hadir,
        ijin,
        tidak_hadir
      };
    });

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
