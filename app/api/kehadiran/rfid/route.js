import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

// Helper to resolve current GMT+7 date and time
function getGmt7DateTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 7)); // Add 7 hours for GMT+7
  
  const pad = (n) => n.toString().padStart(2, '0');
  const dateStr = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
  const timeStr = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())} ${pad(nd.getHours())}:${pad(nd.getMinutes())}:${pad(nd.getSeconds())}`;
  return { dateStr, timeStr, dateObj: nd };
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

async function processRfidPresence(rfidValue, user) {
  if (!rfidValue) {
    return { error: "RFID card ID wajib dikirim", status: 400 };
  }

  const cleanRfid = rfidValue.trim();

  // 1. Ambil data jamaah berdasarkan RFID
  const { rows: jamaahRows } = await db.query(
    "SELECT * FROM jamaah WHERE rfid = $1 AND status_kehidupan = 'Hidup';",
    [cleanRfid]
  );
  
  const jamaah = jamaahRows[0];
  if (!jamaah) {
    return { error: `Kartu RFID '${cleanRfid}' tidak terdaftar`, status: 404 };
  }

  // 2. Jika dipanggil dari browser (ada user session), lakukan validasi scope wewenang
  if (user) {
    if (!user.can_create_kehadiran && !user.can_update_kehadiran) {
      return { error: "Akses ditolak: Anda tidak memiliki wewenang mencatat kehadiran", status: 403 };
    }
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(jamaah.desa))) {
      return { error: `Akses ditolak: Jamaah berasal dari desa ${jamaah.desa} yang tidak terpantau oleh Anda.`, status: 403 };
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(jamaah.kelompok))) {
      return { error: `Akses ditolak: Jamaah berasal dari kelompok ${jamaah.kelompok} yang tidak terpantau oleh Anda.`, status: 403 };
    }
  }

  // 3. Hitung tanggal dan waktu GMT+7
  const { dateStr, timeStr, dateObj } = getGmt7DateTime();
  const currentMin = dateObj.getHours() * 60 + dateObj.getMinutes();

  // 4. Cari Sesi Pengajian yang aktif saat ini untuk jamaah ini
  const { rows: sessions } = await db.query("SELECT * FROM sesi WHERE tanggal = $1;", [dateStr]);
  
  let activeSession = null;
  for (const s of sessions) {
    const startMin = timeToMinutes(s.waktu_mulai) - 30; // 30 minutes earlier
    const endMin = timeToMinutes(s.waktu_selesai);
    
    if (currentMin >= startMin && currentMin <= endMin) {
      // Check filters
      const matchesDesa = s.desas.includes(jamaah.desa);
      const matchesKelompok = s.kelompoks.includes(jamaah.kelompok);
      const matchesGender = s.genders.includes(jamaah.jenis_kelamin);
      const matchesMarital = s.marital_statuses.includes(jamaah.status_pernikahan);
      const matchesKategori = s.kategoris.includes(jamaah.kategori);

      if (matchesDesa && matchesKelompok && matchesGender && matchesMarital && matchesKategori) {
        activeSession = s;
        break; // Match found
      }
    }
  }

  const recorder = user ? user.email : 'RFID Hardware';

  // 5. Cooldown check
  // Ambil data kehadiran hari ini untuk jamaah
  let presenceQuery = "";
  let presenceParams = [];
  if (activeSession) {
    presenceQuery = "SELECT * FROM kehadiran WHERE jamaah_id = $1 AND sesi_id = $2 ORDER BY waktu_presensi DESC;";
    presenceParams = [jamaah.id, activeSession.id];
  } else {
    presenceQuery = "SELECT * FROM kehadiran WHERE jamaah_id = $1 AND tanggal = $2 AND sesi_id IS NULL ORDER BY waktu_presensi DESC;";
    presenceParams = [jamaah.id, dateStr];
  }

  const { rows: existingPresences } = await db.query(presenceQuery, presenceParams);
  const lastHadirEntry = existingPresences.find(p => p.status === 'Hadir' && p.waktu_presensi);

  if (lastHadirEntry) {
    const lastTimeStr = lastHadirEntry.waktu_presensi.replace(' ', 'T');
    const lastTapTime = new Date(lastTimeStr);
    
    const diffMs = Math.abs(dateObj.getTime() - lastTapTime.getTime());
    const diffMin = diffMs / 60000;

    if (diffMin < 30) {
      return {
        success: true,
        alreadyLogged: true,
        message: `Sudah tap kehadiran baru-baru ini (${Math.round(diffMin)} menit yang lalu). Menunggu cooldown 30 menit selesai.`,
        jamaah: {
          nama_lengkap: jamaah.nama_lengkap,
          desa: jamaah.desa,
          kelompok: jamaah.kelompok
        },
        waktu_presensi: lastHadirEntry.waktu_presensi
      };
    }
  }

  // 6. Simpan Kehadiran
  if (activeSession) {
    // Jika ada standby/absent record untuk sesi ini, update menjadi Hadir
    const standbyEntry = existingPresences.find(p => p.status === 'Tidak Hadir' || p.status === 'Ijin');
    if (standbyEntry) {
      await db.query(`
        UPDATE kehadiran 
        SET status = 'Hadir', waktu_presensi = $1, recorded_by = $2 
        WHERE id = $3;
      `, [timeStr, recorder, standbyEntry.id]);
    } else {
      const newPresenceId = crypto.randomUUID();
      await db.query(`
        INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by, sesi_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [newPresenceId, jamaah.id, dateStr, timeStr, 'Hadir', recorder, activeSession.id]);
    }
  } else {
    // Tapping outside of active session (sesi_id = null)
    const newPresenceId = crypto.randomUUID();
    await db.query(`
      INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by, sesi_id)
      VALUES ($1, $2, $3, $4, $5, $6, NULL);
    `, [newPresenceId, jamaah.id, dateStr, timeStr, 'Hadir', recorder]);
  }

  // 7. Catat log audit
  await logActivity(
    recorder,
    'SCAN_RFID',
    'KEHADIRAN',
    jamaah.id,
    `Presensi RFID berhasil: ${jamaah.nama_lengkap} (${jamaah.kelompok}, ${jamaah.desa}) ${activeSession ? `untuk Sesi ${activeSession.jenis_pengajian}` : 'di luar sesi aktif'}`
  );

  return {
    success: true,
    alreadyLogged: false,
    message: activeSession 
      ? `Kehadiran berhasil dicatat untuk Sesi ${activeSession.jenis_pengajian} ${jamaah.kelompok}.`
      : "Kartu terdeteksi: Tap berhasil dicatat di luar sesi aktif.",
    jamaah: {
      nama_lengkap: jamaah.nama_lengkap,
      desa: jamaah.desa,
      kelompok: jamaah.kelompok
    },
    waktu_presensi: timeStr
  };
}

// GET handler
export async function GET(request) {
  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('card_id') || searchParams.get('rfid');

  try {
    const result = await processRfidPresence(cardId, user);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Gagal memproses GET RFID presensi:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST handler
export async function POST(request) {
  const user = await getCurrentUser();
  
  try {
    let cardId = null;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      cardId = body.card_id || body.rfid;
    } else {
      const formData = await request.formData();
      cardId = formData.get('card_id') || formData.get('rfid');
    }

    const result = await processRfidPresence(cardId, user);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Gagal memproses POST RFID presensi:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
