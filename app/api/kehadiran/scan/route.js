import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi. Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  if (!user.can_create_kehadiran && !user.can_update_kehadiran) {
    return NextResponse.json({ error: "Akses ditolak: Anda tidak memiliki wewenang mencatat kehadiran." }, { status: 403 });
  }

  try {
    const data = await request.json();
    const jamaahId = data.jamaah_id;

    if (!jamaahId) {
      return NextResponse.json({ error: "jamaah_id wajib dikirim" }, { status: 400 });
    }

    // 1. Dapatkan profil jamaah yang di-scan
    const { rows: jamaahRows } = await db.query("SELECT * FROM jamaah WHERE id = $1 AND status_kehidupan = 'Hidup';", [jamaahId]);
    const jamaah = jamaahRows[0];
    if (!jamaah) {
      return NextResponse.json({ error: "Data jamaah tidak ditemukan atau telah meninggal" }, { status: 404 });
    }

    // 2. Cek wewenang pemindai
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(jamaah.desa))) {
      return NextResponse.json({ error: `Akses ditolak: Jamaah berasal dari desa ${jamaah.desa} yang tidak terpantau oleh Anda.` }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(jamaah.kelompok))) {
      return NextResponse.json({ error: `Akses ditolak: Jamaah berasal dari kelompok ${jamaah.kelompok} yang tidak terpantau oleh Anda.` }, { status: 403 });
    }

    // 3. Catat Kehadiran untuk hari ini
    const today = new Date().toISOString().split('T')[0];
    
    // Format waktu saat ini: YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const localTimeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const presenceId = crypto.randomUUID();

    await db.query(`
      INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
      VALUES ($1, $2, $3, $4, 'Hadir', $5);
    `, [presenceId, jamaahId, today, localTimeStr, user.email]);

    await logActivity(user.email, 'SCAN_QR', 'KEHADIRAN', jamaahId, `Scan QR presensi berhasil: ${jamaah.nama_lengkap} (Desa: ${jamaah.desa}, Kelompok: ${jamaah.kelompok})`);

    return NextResponse.json({
      success: true,
      message: "Kehadiran berhasil dicatat via QR Code",
      jamaah: {
        nama_lengkap: jamaah.nama_lengkap,
        desa: jamaah.desa,
        kelompok: jamaah.kelompok,
        jenis_kelamin: jamaah.jenis_kelamin
      },
      recorded_by: user.email,
      waktu_presensi: localTimeStr
    });
  } catch (error) {
    console.error("Gagal mencatat scan kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
