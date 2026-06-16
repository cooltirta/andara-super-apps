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
  const start_date = searchParams.get('start_date');
  const end_date = searchParams.get('end_date');
  const is_date_filtered = !!(start_date && end_date);

  try {
    await logActivity(user.email, 'VISIT', 'PAGE', 'BERANDA', 'Mengakses halaman Beranda');

    let total_jamaah = 0;
    let total_keluarga = 0;
    let groups_dist = [];
    let last_session_stats = null;

    // Helper function to build dynamic conditions for monitored locations
    function buildFilter(params, prefix = "j") {
      let conditions = [];
      let paramIdx = params.length + 1;

      if (!user.monitor_all_desas) {
        conditions.push(`${prefix}.desa = ANY($${paramIdx++}::text[])`);
        params.push(user.desas_pantau || []);
      }
      if (!user.monitor_all_kelompoks) {
        conditions.push(`${prefix}.kelompok = ANY($${paramIdx++}::text[])`);
        params.push(user.kelompoks_pantau || []);
      }

      return conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : "";
    }

    // 1. Total Jamaah
    const jamaahParams = [];
    const jamaahFilter = buildFilter(jamaahParams, "j");
    const { rows: jamaahRows } = await db.query(
      `SELECT COUNT(*) as count FROM jamaah j WHERE j.status_kehidupan = 'Hidup'${jamaahFilter};`,
      jamaahParams
    );
    total_jamaah = parseInt(jamaahRows[0].count, 10);

    // 2. Total Keluarga (scoped to Kepala Keluarga's monitored locations)
    const keluargaParams = [];
    const keluargaFilter = buildFilter(keluargaParams, "j");
    const { rows: keluargaRows } = await db.query(
      `SELECT COUNT(DISTINCT k.id) as count 
       FROM keluarga k 
       JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
       JOIN jamaah j ON ak.jamaah_id = j.id
       WHERE ak.jenis_anggota = 'Kepala Keluarga'${keluargaFilter};`,
      keluargaParams
    );
    total_keluarga = parseInt(keluargaRows[0].count, 10);

    // 3. Distribusi Kelompok
    const distParams = [];
    const distFilter = buildFilter(distParams, "j");
    const { rows: distRows } = await db.query(
      `SELECT j.kelompok, COUNT(*) as count 
       FROM jamaah j 
       WHERE j.status_kehidupan = 'Hidup'${distFilter} 
       GROUP BY j.kelompok;`,
      distParams
    );
    groups_dist = distRows.map(g => ({
      kelompok: g.kelompok,
      count: parseInt(g.count, 10)
    }));

    // 4. Kehadiran Sesi Terakhir OR Rekapitulasi Date Range
    const parseNum = (val) => val === null || val === undefined ? 0 : parseInt(val, 10);

    if (is_date_filtered) {
      const reportParams = [start_date, end_date];
      const reportFilter = buildFilter(reportParams, "j");

      const { rows: statsRows } = await db.query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
           SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
           SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
         FROM kehadiran k
         JOIN jamaah j ON k.jamaah_id = j.id
         WHERE k.tanggal >= $1 AND k.tanggal <= $2${reportFilter};`,
        reportParams
      );
      const stats = statsRows[0] || {};

      const countParams = [start_date, end_date];
      const countFilter = buildFilter(countParams, "j");
      const { rows: countRows } = await db.query(
        `SELECT COUNT(DISTINCT k.tanggal) as count 
         FROM kehadiran k 
         JOIN jamaah j ON k.jamaah_id = j.id
         WHERE k.tanggal >= $1 AND k.tanggal <= $2${countFilter};`,
        countParams
      );
      const sessionCount = parseInt(countRows[0].count, 10);

      const virtual_sesi = {
        id: "range_summary",
        nama_sesi: `Rekapitulasi Kehadiran (${sessionCount} Hari)`,
        tanggal: `Rentang: ${start_date} s/d ${end_date}`,
        jenis_pengajian: "Agregat",
        kelompok: null,
        desa: "Semua Terpantau"
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
      const maxParams = [];
      const maxFilter = buildFilter(maxParams, "j");
      const { rows: maxRows } = await db.query(
        `SELECT MAX(k.tanggal) as date 
         FROM kehadiran k 
         JOIN jamaah j ON k.jamaah_id = j.id
         WHERE 1=1${maxFilter};`,
        maxParams
      );
      const last_date = maxRows[0] ? maxRows[0].date : null;

      if (last_date) {
        const statsParams = [last_date];
        const statsFilter = buildFilter(statsParams, "j");
        const { rows: statsRows } = await db.query(
          `SELECT 
             COUNT(*) as total,
             SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
             SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
             SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
           FROM kehadiran k
           JOIN jamaah j ON k.jamaah_id = j.id
           WHERE k.tanggal = $1${statsFilter};`,
          statsParams
        );
        const stats = statsRows[0] || {};

        const last_session = {
          id: "last_daily",
          nama_sesi: `Pengajian Terakhir`,
          tanggal: last_date,
          jenis_pengajian: "Harian",
          kelompok: null,
          desa: "Semua Terpantau"
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
