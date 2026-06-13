import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');
  const is_date_filtered = !!(start_date && end_date);

  try {
    let total_jamaah = 0;
    let total_keluarga = 0;
    let groups_dist = [];
    let last_session_stats = null;

    // 1. Total Jamaah
    if (user.role === 'Super Admin') {
      const { rows } = await db.query("SELECT COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup';");
      total_jamaah = parseInt(rows[0].count, 10);
    } else if (user.role === 'Admin') {
      const { rows } = await db.query("SELECT COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND desa = $1;", [user.desa]);
      total_jamaah = parseInt(rows[0].count, 10);
    } else { // Moderator / Member
      const { rows } = await db.query("SELECT COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND kelompok = $1 AND desa = $2;", [user.kelompok, user.desa]);
      total_jamaah = parseInt(rows[0].count, 10);
    }

    // 2. Total Keluarga
    if (user.role === 'Super Admin') {
      const { rows } = await db.query("SELECT COUNT(*) as count FROM keluarga;");
      total_keluarga = parseInt(rows[0].count, 10);
    } else if (user.role === 'Admin') {
      const { rows } = await db.query(`
        SELECT COUNT(DISTINCT k.id) as count 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.desa = $1;
      `, [user.desa]);
      total_keluarga = parseInt(rows[0].count, 10);
    } else { // Moderator / Member
      const { rows } = await db.query(`
        SELECT COUNT(DISTINCT k.id) as count 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.kelompok = $1 AND j.desa = $2;
      `, [user.kelompok, user.desa]);
      total_keluarga = parseInt(rows[0].count, 10);
    }

    // 3. Distribusi Kelompok
    if (user.role === 'Super Admin') {
      const { rows } = await db.query("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' GROUP BY kelompok;");
      groups_dist = rows;
    } else if (user.role === 'Admin') {
      const { rows } = await db.query("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND desa = $1 GROUP BY kelompok;", [user.desa]);
      groups_dist = rows;
    } else { // Moderator / Member
      const { rows } = await db.query("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND kelompok = $1 AND desa = $2 GROUP BY kelompok;", [user.kelompok, user.desa]);
      groups_dist = rows;
    }
    groups_dist = groups_dist.map(g => ({
      ...g,
      count: parseInt(g.count, 10)
    }));

    // 4. Kehadiran Sesi Terakhir OR Rekapitulasi Date Range
    if (is_date_filtered) {
      let stats = null;
      let sessionCount = 0;

      if (user.role === 'Super Admin') {
        const { rows } = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
            SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
          FROM kehadiran
          WHERE tanggal >= $1 AND tanggal <= $2;
        `, [start_date, end_date]);
        stats = rows[0] || {};
        
        const { rows: countRows } = await db.query("SELECT COUNT(DISTINCT tanggal) as count FROM kehadiran WHERE tanggal >= $1 AND tanggal <= $2;", [start_date, end_date]);
        sessionCount = parseInt(countRows[0].count, 10);
      } else if (user.role === 'Admin') {
        const { rows } = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
            SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
          FROM kehadiran k
          JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= $1 AND k.tanggal <= $2 AND j.desa = $3;
        `, [start_date, end_date, user.desa]);
        stats = rows[0] || {};

        const { rows: countRows } = await db.query(`
          SELECT COUNT(DISTINCT k.tanggal) as count 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= $1 AND k.tanggal <= $2 AND j.desa = $3;
        `, [start_date, end_date, user.desa]);
        sessionCount = parseInt(countRows[0].count, 10);
      } else { // Moderator / Member
        const { rows } = await db.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
            SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
          FROM kehadiran k
          JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= $1 AND k.tanggal <= $2 AND j.kelompok = $3 AND j.desa = $4;
        `, [start_date, end_date, user.kelompok, user.desa]);
        stats = rows[0] || {};

        const { rows: countRows } = await db.query(`
          SELECT COUNT(DISTINCT k.tanggal) as count 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= $1 AND k.tanggal <= $2 AND j.kelompok = $3 AND j.desa = $4;
        `, [start_date, end_date, user.kelompok, user.desa]);
        sessionCount = parseInt(countRows[0].count, 10);
      }

      const parseNum = (val) => val === null || val === undefined ? 0 : parseInt(val, 10);

      const virtual_sesi = {
        id: "range_summary",
        nama_sesi: `Rekapitulasi Kehadiran (${sessionCount} Hari)`,
        tanggal: `Rentang: ${start_date} s/d ${end_date}`,
        jenis_pengajian: "Agregat",
        kelompok: null,
        desa: user.desa || "Andara"
      };

      last_session_stats = {
        sesi: virtual_sesi,
        stats: {
          hadir: parseNum(stats.hadir),
          ijin: parseNum(stats.ijin),
          tidak_hadir: parseNum(stats.tidak_hadir)
        }
      };
    } else {
      // Default: Sesi Terakhir (Hari Terakhir Presensi)
      let lastDateObj = null;
      if (user.role === 'Super Admin') {
        const { rows } = await db.query("SELECT MAX(tanggal) as date FROM kehadiran;");
        lastDateObj = rows[0];
      } else if (user.role === 'Admin') {
        const { rows } = await db.query(`
          SELECT MAX(k.tanggal) as date 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE j.desa = $1;
        `, [user.desa]);
        lastDateObj = rows[0];
      } else { // Moderator / Member
        const { rows } = await db.query(`
          SELECT MAX(k.tanggal) as date 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE j.kelompok = $1 AND j.desa = $2;
        `, [user.kelompok, user.desa]);
        lastDateObj = rows[0];
      }

      const last_date = lastDateObj ? lastDateObj.date : null;

      if (last_date) {
        let stats = null;
        if (user.role === 'Super Admin') {
          const { rows } = await db.query(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
              SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
            FROM kehadiran
            WHERE tanggal = $1;
          `, [last_date]);
          stats = rows[0] || {};
        } else if (user.role === 'Admin') {
          const { rows } = await db.query(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
              SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.tanggal = $1 AND j.desa = $2;
          `, [last_date, user.desa]);
          stats = rows[0] || {};
        } else { // Moderator / Member
          const { rows } = await db.query(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
              SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.tanggal = $1 AND j.kelompok = $2 AND j.desa = $3;
          `, [last_date, user.kelompok, user.desa]);
          stats = rows[0] || {};
        }

        const parseNum = (val) => val === null || val === undefined ? 0 : parseInt(val, 10);

        const last_session = {
          id: "last_daily",
          nama_sesi: `Pengajian Terakhir`,
          tanggal: last_date,
          jenis_pengajian: "Harian",
          kelompok: user.kelompok || null,
          desa: user.desa || "Andara"
        };

        last_session_stats = {
          sesi: last_session,
          stats: {
            hadir: parseNum(stats.hadir),
            ijin: parseNum(stats.ijin),
            tidak_hadir: parseNum(stats.tidak_hadir)
          }
        };
      }
    }

    return NextResponse.json({
      total_jamaah,
      total_keluarga,
      distribusi_kelompok: groups_dist,
      sesi_terakhir: last_session_stats
    });
  } catch (error) {
    console.error("Gagal memuat statistik:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
