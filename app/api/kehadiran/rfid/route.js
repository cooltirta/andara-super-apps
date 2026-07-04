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
    return { error: `Kartu RFID '${cleanRfid}' tidak terdaftar atau jamaah sudah meninggal`, status: 404 };
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

  // 4. Periksa data kehadiran jamaah untuk hari ini (untuk cooldown 10 menit)
  const { rows: todayPresences } = await db.query(
    "SELECT * FROM kehadiran WHERE jamaah_id = $1 AND tanggal = $2 ORDER BY waktu_presensi DESC;",
    [jamaah.id, dateStr]
  );

  const recorder = user ? user.email : 'RFID Hardware';

  // Cari entri 'Hadir' terakhir hari ini untuk cooldown check
  const lastHadirEntry = todayPresences.find(p => p.status === 'Hadir' && p.waktu_presensi);

  if (lastHadirEntry) {
    // Parse waktu presensi (format: YYYY-MM-DD HH:mm:ss)
    const lastTimeStr = lastHadirEntry.waktu_presensi.replace(' ', 'T');
    const lastTapTime = new Date(lastTimeStr);
    
    // Hitung selisih dalam milidetik
    const diffMs = Math.abs(dateObj.getTime() - lastTapTime.getTime());
    const diffMin = diffMs / 60000;

    if (diffMin < 10) {
      // Cooldown aktif (kurang dari 10 menit): Kembalikan sukses khusus tanpa menulis ulang ke DB
      return {
        success: true,
        alreadyLogged: true,
        message: `Sudah tap kehadiran baru-baru ini (${Math.round(diffMin)} menit yang lalu). Menunggu cooldown 10 menit selesai.`,
        jamaah: {
          nama_lengkap: jamaah.nama_lengkap,
          desa: jamaah.desa,
          kelompok: jamaah.kelompok
        },
        waktu_presensi: lastHadirEntry.waktu_presensi
      };
    }
  }

  // 5. Simpan kehadiran
  // Jika ada record hari ini yang berstatus 'Tidak Hadir' atau 'Ijin', update record tersebut menjadi 'Hadir'
  const standbyEntry = todayPresences.find(p => p.status === 'Tidak Hadir' || p.status === 'Ijin');

  if (standbyEntry) {
    await db.query(`
      UPDATE kehadiran 
      SET status = 'Hadir', waktu_presensi = $1, recorded_by = $2 
      WHERE id = $3;
    `, [timeStr, recorder, standbyEntry.id]);
  } else {
    // Jika tidak ada standby entry, atau entry hari ini sudah 'Hadir' (tapi sudah lewat 10 menit), buat entri baru
    const newPresenceId = crypto.randomUUID();
    await db.query(`
      INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [newPresenceId, jamaah.id, dateStr, timeStr, 'Hadir', recorder]);
  }

  // 6. Catat aktivitas
  await logActivity(
    recorder,
    'SCAN_RFID',
    'KEHADIRAN',
    jamaah.id,
    `Presensi RFID berhasil: ${jamaah.nama_lengkap} (${jamaah.kelompok}, ${jamaah.desa})`
  );

  return {
    success: true,
    alreadyLogged: false,
    message: "Kehadiran berhasil dicatat.",
    jamaah: {
      nama_lengkap: jamaah.nama_lengkap,
      desa: jamaah.desa,
      kelompok: jamaah.kelompok
    },
    waktu_presensi: timeStr
  };
}

// GET handler: mendukung link url query parameters (misal: /api/kehadiran/rfid?card_id=12345)
export async function GET(request) {
  const user = await getCurrentUser(); // opsional, bypass auth jika dari ESP32
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

// POST handler: mendukung JSON body (misal: { "card_id": "12345" }) maupun URLSearchParams
export async function POST(request) {
  const user = await getCurrentUser(); // opsional, bypass auth jika dari ESP32
  
  try {
    let cardId = null;

    // Deteksi tipe konten request
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      cardId = body.card_id || body.rfid;
    } else {
      // Fallback ke url query params
      const { searchParams } = new URL(request.url);
      cardId = searchParams.get('card_id') || searchParams.get('rfid');
      
      // Jika masih kosong, coba parse body form urlencoded
      if (!cardId) {
        try {
          const formData = await request.formData();
          cardId = formData.get('card_id') || formData.get('rfid');
        } catch (_) {}
      }
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
