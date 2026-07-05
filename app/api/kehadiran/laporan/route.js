import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_read_laporan) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  let filterDesa = searchParams.get('desa') || '';
  let filterKelompok = searchParams.get('kelompok') || '';
  const kategoriStr = searchParams.get('kategori') || '';
  const statusPernikahanStr = searchParams.get('status_pernikahan') || '';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date dan end_date wajib diisi" }, { status: 400 });
  }

  const kategoriArray = kategoriStr ? kategoriStr.split(',') : [];
  const statusPernikahanArray = statusPernikahanStr ? statusPernikahanStr.split(',') : [];

  try {
    await logActivity(
      user.email, 
      'VISIT', 
      'PAGE', 
      'PRESENSI_LAPORAN', 
      `Mengakses Laporan Kehadiran Sesi (${startDate} s/d ${endDate})`
    );

    // 1. Ambil semua sesi dalam rentang tanggal
    let sessionQuery = `
      SELECT * FROM sesi 
      WHERE tanggal >= $1 AND tanggal <= $2 
      ORDER BY tanggal DESC, waktu_mulai DESC;
    `;
    const { rows: sessions } = await db.query(sessionQuery, [startDate, endDate]);
    const totalSessions = sessions.length;

    // 2. Ambil daftar jamaah aktif
    let jamaahQuery = `
      SELECT id as jamaah_id, nama_lengkap, desa, kelompok, jenis_kelamin, kategori, status_pernikahan 
      FROM jamaah 
      WHERE status_kehidupan = 'Hidup'
    `;
    const jamaahParams = [];
    let paramIdx = 1;

    // Filter berdasarkan hak akses desa pengawas
    if (!user.monitor_all_desas) {
      if (filterDesa) {
        if (user.desas_pantau && user.desas_pantau.includes(filterDesa)) {
          jamaahQuery += ` AND desa = $${paramIdx++}`;
          jamaahParams.push(filterDesa);
        } else {
          jamaahQuery += " AND desa = ANY('{}'::text[])";
        }
      } else {
        jamaahQuery += ` AND desa = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.desas_pantau || []);
      }
    } else {
      if (filterDesa) {
        jamaahQuery += ` AND desa = $${paramIdx++}`;
        jamaahParams.push(filterDesa);
      }
    }

    // Filter berdasarkan hak akses kelompok pengawas
    if (!user.monitor_all_kelompoks) {
      if (filterKelompok) {
        if (user.kelompoks_pantau && user.kelompoks_pantau.includes(filterKelompok)) {
          jamaahQuery += ` AND kelompok = $${paramIdx++}`;
          jamaahParams.push(filterKelompok);
        } else {
          jamaahQuery += " AND kelompok = ANY('{}'::text[])";
        }
      } else {
        jamaahQuery += ` AND kelompok = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.kelompoks_pantau || []);
      }
    } else {
      if (filterKelompok) {
        jamaahQuery += ` AND kelompok = $${paramIdx++}`;
        jamaahParams.push(filterKelompok);
      }
    }

    // Filter tambahan dari request UI (kategori & status pernikahan)
    if (kategoriArray.length > 0) {
      jamaahQuery += ` AND kategori = ANY($${paramIdx++})`;
      jamaahParams.push(kategoriArray);
    }
    if (statusPernikahanArray.length > 0) {
      jamaahQuery += ` AND status_pernikahan = ANY($${paramIdx++})`;
      jamaahParams.push(statusPernikahanArray);
    }

    jamaahQuery += ` ORDER BY desa ASC, kelompok ASC, nama_lengkap ASC;`;
    const { rows: jamaahs } = await db.query(jamaahQuery, jamaahParams);

    // 3. Ambil semua record kehadiran dalam rentang tanggal
    const { rows: presences } = await db.query(`
      SELECT id, jamaah_id, status, waktu_presensi, sesi_id, tanggal
      FROM kehadiran 
      WHERE tanggal >= $1 AND tanggal <= $2;
    `, [startDate, endDate]);

    // Buat map kehadiran agar mempermudah lookup cepat [jamaah_id][sesi_id]
    const presenceMap = {};
    presences.forEach(p => {
      if (!presenceMap[p.jamaah_id]) {
        presenceMap[p.jamaah_id] = {};
      }
      if (p.sesi_id) {
        presenceMap[p.jamaah_id][p.sesi_id] = p.status;
      }
      // Simpan juga berdasarkan tanggal untuk fallback record manual lama
      if (!presenceMap[p.jamaah_id][p.tanggal]) {
        presenceMap[p.jamaah_id][p.tanggal] = p.status;
      }
    });

    // 4. Proses agregasi data per jamaah
    const overallStats = { total: 0, hadir: 0, ijin: 0, tidak_hadir: 0 };
    const distGender = {
      Hadir: { Laki: 0, Perempuan: 0 },
      Ijin: { Laki: 0, Perempuan: 0 },
      TidakHadir: { Laki: 0, Perempuan: 0 }
    };
    const distKategori = { Hadir: {}, Ijin: {}, TidakHadir: {} };
    const distStatusPernikahan = { Hadir: {}, Ijin: {}, TidakHadir: {} };

    const rekapJamaah = [];
    const groupStats = {};

    jamaahs.forEach(j => {
      let hadir = 0;
      let ijin = 0;
      let tidak_hadir = 0;
      let total_wajib = 0;

      // Iterasi semua sesi untuk mencocokkan filter wajib hadir jamaah ini
      sessions.forEach(s => {
        const matchesDesa = s.desas.includes(j.desa);
        const matchesKelompok = s.kelompoks.includes(j.kelompok);
        const matchesGender = s.genders.includes(j.jenis_kelamin);
        const matchesMarital = s.marital_statuses.includes(j.status_pernikahan);
        const matchesKategori = s.kategoris.includes(j.kategori);

        if (matchesDesa && matchesKelompok && matchesGender && matchesMarital && matchesKategori) {
          total_wajib++;
          
          // Cari status kehadiran di map
          let status = presenceMap[j.jamaah_id]?.[s.id];
          if (!status) {
            // Fallback ke tanggal untuk support data lama sebelum sesi_id ada
            status = presenceMap[j.jamaah_id]?.[s.tanggal];
          }

          if (status === 'Hadir') {
            hadir++;
          } else if (status === 'Ijin') {
            ijin++;
          } else {
            tidak_hadir++;
          }
        }
      });

      // Simpan rekap individu
      rekapJamaah.push({
        jamaah_id: j.jamaah_id,
        nama_lengkap: j.nama_lengkap,
        desa: j.desa,
        kelompok: j.kelompok,
        jenis_kelamin: j.jenis_kelamin,
        hadir,
        ijin,
        tidak_hadir,
        total_wajib
      });

      // Tambahkan ke statistik agregat kelompok
      if (!groupStats[j.kelompok]) {
        groupStats[j.kelompok] = { kelompok: j.kelompok, total: 0, hadir: 0, ijin: 0, tidak_hadir: 0 };
      }
      groupStats[j.kelompok].total += total_wajib;
      groupStats[j.kelompok].hadir += hadir;
      groupStats[j.kelompok].ijin += ijin;
      groupStats[j.kelompok].tidak_hadir += tidak_hadir;

      // Tambahkan ke status distribusi demografis global
      overallStats.total += total_wajib;
      overallStats.hadir += hadir;
      overallStats.ijin += ijin;
      overallStats.tidak_hadir += tidak_hadir;

      // Gender distribution helper
      const genderKey = j.jenis_kelamin === 'Laki-laki' ? 'Laki' : 'Perempuan';
      distGender.Hadir[genderKey] += hadir;
      distGender.Ijin[genderKey] += ijin;
      distGender.TidakHadir[genderKey] += tidak_hadir;

      // Category distribution helper
      const kat = j.kategori || 'Lainnya';
      distKategori.Hadir[kat] = (distKategori.Hadir[kat] || 0) + hadir;
      distKategori.Ijin[kat] = (distKategori.Ijin[kat] || 0) + ijin;
      distKategori.TidakHadir[kat] = (distKategori.TidakHadir[kat] || 0) + tidak_hadir;

      // Marital status distribution helper
      const mar = j.status_pernikahan || 'Belum Menikah';
      distStatusPernikahan.Hadir[mar] = (distStatusPernikahan.Hadir[mar] || 0) + hadir;
      distStatusPernikahan.Ijin[mar] = (distStatusPernikahan.Ijin[mar] || 0) + ijin;
      distStatusPernikahan.TidakHadir[mar] = (distStatusPernikahan.TidakHadir[mar] || 0) + tidak_hadir;
    });

    const distribusiKelompok = Object.values(groupStats).sort((a, b) => a.kelompok.localeCompare(b.kelompok));

    return NextResponse.json({
      totalSessions,
      stats: {
        hadir: overallStats.hadir,
        ijin: overallStats.ijin,
        tidak_hadir: overallStats.tidak_hadir,
        total: overallStats.total,
        distribusiGender: distGender,
        distribusiKategori: distKategori,
        distribusiStatusPernikahan: distStatusPernikahan
      },
      distribusiKelompok,
      rekapJamaah
    });
  } catch (error) {
    console.error("Gagal memuat laporan kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
