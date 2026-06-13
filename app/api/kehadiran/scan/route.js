import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi. Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak: Anggota (Member) tidak memiliki wewenang mencatat kehadiran." }, { status: 403 });
  }

  try {
    const data = await request.json();
    const jamaahId = data.jamaah_id;

    if (!jamaahId) {
      return NextResponse.json({ error: "jamaah_id wajib dikirim" }, { status: 400 });
    }

    // 1. Dapatkan profil jamaah yang di-scan
    const jamaah = db.prepare("SELECT * FROM jamaah WHERE id = ? AND status_kehidupan = 'Hidup';").get(jamaahId);
    if (!jamaah) {
      return NextResponse.json({ error: "Data jamaah tidak ditemukan atau telah meninggal" }, { status: 404 });
    }

    // 2. Cek wewenang pemindai
    if (user.role === 'Admin') {
      if (user.desa !== jamaah.desa) {
        return NextResponse.json({ error: `Akses ditolak: Jamaah berasal dari desa ${jamaah.desa}, sedangkan wilayah wewenang Anda adalah desa ${user.desa}.` }, { status: 403 });
      }
    } else if (user.role === 'Moderator') {
      if (user.desa !== jamaah.desa || user.kelompok !== jamaah.kelompok) {
        return NextResponse.json({ error: `Akses ditolak: Jamaah berasal dari desa ${jamaah.desa} kelompok ${jamaah.kelompok}, sedangkan wewenang Anda adalah desa ${user.desa} kelompok ${user.kelompok}.` }, { status: 403 });
      }
    }

    // 3. Catat Kehadiran untuk hari ini
    const today = new Date().toISOString().split('T')[0];
    
    // Format waktu saat ini: YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const localTimeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Cek record eksisting
    const existing = db.prepare("SELECT * FROM kehadiran WHERE jamaah_id = ? AND tanggal = ?;").get(jamaahId, today);
    const presenceId = existing ? existing.id : crypto.randomUUID();

    db.prepare(`
      INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
      VALUES (?, ?, ?, ?, 'Hadir', ?)
      ON CONFLICT(jamaah_id, tanggal) DO UPDATE SET
        status = 'Hadir',
        waktu_presensi = excluded.waktu_presensi,
        recorded_by = excluded.recorded_by;
    `).run(presenceId, jamaahId, today, localTimeStr, user.email);

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
