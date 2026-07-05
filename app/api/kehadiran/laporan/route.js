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
  
  const desasStr = searchParams.get('desas') || '';
  const kelompoksStr = searchParams.get('kelompoks') || '';
  const gendersStr = searchParams.get('genders') || '';
  const maritalStatusesStr = searchParams.get('marital_statuses') || '';
  const kategorisStr = searchParams.get('kategoris') || '';
  const sesiIdsStr = searchParams.get('sesi_ids') || '';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date dan end_date wajib diisi" }, { status: 400 });
  }

  const desasArray = desasStr ? desasStr.split(',') : [];
  const kelompoksArray = kelompoksStr ? kelompoksStr.split(',') : [];
  const gendersArray = gendersStr ? gendersStr.split(',') : [];
  const maritalStatusesArray = maritalStatusesStr ? maritalStatusesStr.split(',') : [];
  const kategorisArray = kategorisStr ? kategorisStr.split(',') : [];
  const sesiIdsArray = sesiIdsStr ? sesiIdsStr.split(',') : [];

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
    
    // Filter sesi berdasarkan checklist eksklusi dari frontend
    let filteredSessions = sessions;
    if (sesiIdsArray.length > 0) {
      filteredSessions = sessions.filter(s => sesiIdsArray.includes(s.id));
    }
    const totalSessions = filteredSessions.length;

    // 2. Ambil daftar jamaah aktif berdasarkan filter demografis
    let jamaahQuery = `
      SELECT id as jamaah_id, nama_lengkap, desa, kelompok, jenis_kelamin, kategori, status_pernikahan 
      FROM jamaah 
      WHERE status_kehidupan = 'Hidup'
    `;
    const jamaahParams = [];
    let paramIdx = 1;

    // Filter Desa
    if (desasArray.length > 0) {
      let allowedDesas = desasArray;
      if (!user.monitor_all_desas) {
        allowedDesas = desasArray.filter(d => (user.desas_pantau || []).includes(d));
        if (allowedDesas.length === 0) allowedDesas = ['__none__'];
      }
      jamaahQuery += ` AND desa = ANY($${paramIdx++}::text[])`;
      jamaahParams.push(allowedDesas);
    } else if (!user.monitor_all_desas) {
      jamaahQuery += ` AND desa = ANY($${paramIdx++}::text[])`;
      jamaahParams.push(user.desas_pantau || []);
    }

    // Filter Kelompok
    if (kelompoksArray.length > 0) {
      let allowedKelompoks = kelompoksArray;
      if (!user.monitor_all_kelompoks) {
        allowedKelompoks = kelompoksArray.filter(k => (user.kelompoks_pantau || []).includes(k));
        if (allowedKelompoks.length === 0) allowedKelompoks = ['__none__'];
      }
      jamaahQuery += ` AND kelompok = ANY($${paramIdx++}::text[])`;
      jamaahParams.push(allowedKelompoks);
    } else if (!user.monitor_all_kelompoks) {
      jamaahQuery += ` AND kelompok = ANY($${paramIdx++}::text[])`;
      jamaahParams.push(user.kelompoks_pantau || []);
    }

    // Filter Gender
    if (gendersArray.length > 0) {
      jamaahQuery += ` AND jenis_kelamin = ANY($${paramIdx++})`;
      jamaahParams.push(gendersArray);
    }

    // Filter Status Pernikahan
    if (maritalStatusesArray.length > 0) {
      const mappedStatuses = [];
      maritalStatusesArray.forEach(s => {
        if (s === 'Janda/Duda') {
          mappedStatuses.push('Janda', 'Duda');
        } else {
          mappedStatuses.push(s);
        }
      });
      jamaahQuery += ` AND status_pernikahan = ANY($${paramIdx++})`;
      jamaahParams.push(mappedStatuses);
    }

    // Filter Kategori
    if (kategorisArray.length > 0) {
      jamaahQuery += ` AND kategori = ANY($${paramIdx++})`;
      jamaahParams.push(kategorisArray);
    }

    jamaahQuery += ` ORDER BY desa ASC, kelompok ASC, nama_lengkap ASC;`;
    const { rows: jamaahs } = await db.query(jamaahQuery, jamaahParams);

    // 3. Ambil semua record kehadiran dalam rentang tanggal
    const { rows: presences } = await db.query(`
      SELECT id, jamaah_id, status, waktu_presensi, sesi_id, tanggal
      FROM kehadiran 
      WHERE tanggal >= $1 AND tanggal <= $2;
    `, [startDate, endDate]);

    // Buat map kehadiran [jamaah_id][sesi_id]
    const presenceMap = {};
    presences.forEach(p => {
      if (!presenceMap[p.jamaah_id]) {
        presenceMap[p.jamaah_id] = {};
      }
      if (p.sesi_id) {
        presenceMap[p.jamaah_id][p.sesi_id] = p.status;
      }
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

      // Iterasi semua sesi terpilih untuk mencocokkan filter wajib hadir jamaah ini
      filteredSessions.forEach(s => {
        const matchesDesa = s.desas.includes(j.desa);
        const matchesKelompok = s.kelompoks.includes(j.kelompok);
        const matchesGender = s.genders.includes(j.jenis_kelamin);
        const matchesMarital = s.marital_statuses.includes(j.status_pernikahan);
        const matchesKategori = s.kategoris.includes(j.kategori);

        if (matchesDesa && matchesKelompok && matchesGender && matchesMarital && matchesKategori) {
          total_wajib++;
          
          let status = presenceMap[j.jamaah_id]?.[s.id];
          if (!status) {
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
