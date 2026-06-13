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
      total_jamaah = db.prepare("SELECT COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup';").get().count;
    } else if (user.role === 'Admin') {
      total_jamaah = db.prepare("SELECT COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND desa = ?;").get(user.desa).count;
    } else { // Moderator / Member
      total_jamaah = db.prepare("SELECT COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND kelompok = ? AND desa = ?;").get(user.kelompok, user.desa).count;
    }

    // 2. Total Keluarga
    if (user.role === 'Super Admin') {
      total_keluarga = db.prepare("SELECT COUNT(*) as count FROM keluarga;").get().count;
    } else if (user.role === 'Admin') {
      total_keluarga = db.prepare(`
        SELECT COUNT(DISTINCT k.id) as count 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.desa = ?;
      `).get(user.desa).count;
    } else { // Moderator / Member
      total_keluarga = db.prepare(`
        SELECT COUNT(DISTINCT k.id) as count 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.kelompok = ? AND j.desa = ?;
      `).get(user.kelompok, user.desa).count;
    }

    // 3. Distribusi Kelompok
    if (user.role === 'Super Admin') {
      groups_dist = db.prepare("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' GROUP BY kelompok;").all();
    } else if (user.role === 'Admin') {
      groups_dist = db.prepare("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND desa = ? GROUP BY kelompok;").all(user.desa);
    } else { // Moderator / Member
      groups_dist = db.prepare("SELECT kelompok, COUNT(*) as count FROM jamaah WHERE status_kehidupan = 'Hidup' AND kelompok = ? AND desa = ? GROUP BY kelompok;").all(user.kelompok, user.desa);
    }

    // 4. Kehadiran Sesi Terakhir OR Rekapitulasi Date Range
    if (is_date_filtered) {
      let stats = null;
      let sessionCount = 0;

      if (user.role === 'Super Admin') {
        stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
            SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
          FROM kehadiran
          WHERE tanggal >= ? AND tanggal <= ?;
        `).get(start_date, end_date);
        
        sessionCount = db.prepare("SELECT COUNT(DISTINCT tanggal) as count FROM kehadiran WHERE tanggal >= ? AND tanggal <= ?;").get(start_date, end_date).count;
      } else if (user.role === 'Admin') {
        stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
            SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
          FROM kehadiran k
          JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= ? AND k.tanggal <= ? AND j.desa = ?;
        `).get(start_date, end_date, user.desa);

        sessionCount = db.prepare(`
          SELECT COUNT(DISTINCT k.tanggal) as count 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= ? AND k.tanggal <= ? AND j.desa = ?;
        `).get(start_date, end_date, user.desa).count;
      } else { // Moderator / Member
        stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
            SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
          FROM kehadiran k
          JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= ? AND k.tanggal <= ? AND j.kelompok = ? AND j.desa = ?;
        `).get(start_date, end_date, user.kelompok, user.desa);

        sessionCount = db.prepare(`
          SELECT COUNT(DISTINCT k.tanggal) as count 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE k.tanggal >= ? AND k.tanggal <= ? AND j.kelompok = ? AND j.desa = ?;
        `).get(start_date, end_date, user.kelompok, user.desa).count;
      }

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
          hadir: stats.hadir || 0,
          ijin: stats.ijin || 0,
          tidak_hadir: stats.tidak_hadir || 0
        }
      };
    } else {
      // Default: Sesi Terakhir (Hari Terakhir Presensi)
      let lastDateObj = null;
      if (user.role === 'Super Admin') {
        lastDateObj = db.prepare("SELECT MAX(tanggal) as date FROM kehadiran;").get();
      } else if (user.role === 'Admin') {
        lastDateObj = db.prepare(`
          SELECT MAX(k.tanggal) as date 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE j.desa = ?;
        `).get(user.desa);
      } else { // Moderator / Member
        lastDateObj = db.prepare(`
          SELECT MAX(k.tanggal) as date 
          FROM kehadiran k JOIN jamaah j ON k.jamaah_id = j.id
          WHERE j.kelompok = ? AND j.desa = ?;
        `).get(user.kelompok, user.desa);
      }

      const last_date = lastDateObj ? lastDateObj.date : null;

      if (last_date) {
        let stats = null;
        if (user.role === 'Super Admin') {
          stats = db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
              SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
            FROM kehadiran
            WHERE tanggal = ?;
          `).get(last_date);
        } else if (user.role === 'Admin') {
          stats = db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
              SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.tanggal = ? AND j.desa = ?;
          `).get(last_date, user.desa);
        } else { // Moderator / Member
          stats = db.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN status = 'Ijin' THEN 1 ELSE 0 END) as ijin,
              SUM(CASE WHEN status = 'Tidak Hadir' THEN 1 ELSE 0 END) as tidak_hadir
            FROM kehadiran k
            JOIN jamaah j ON k.jamaah_id = j.id
            WHERE k.tanggal = ? AND j.kelompok = ? AND j.desa = ?;
          `).get(last_date, user.kelompok, user.desa);
        }

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
            hadir: stats.hadir || 0,
            ijin: stats.ijin || 0,
            tidak_hadir: stats.tidak_hadir || 0
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
