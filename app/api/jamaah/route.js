import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    let jamaah_list = [];
    const baseQuery = `
      SELECT j.*, ak.jenis_anggota, ak.keluarga_id, k.nama_keluarga
      FROM jamaah j
      LEFT JOIN anggota_keluarga ak ON j.id = ak.jamaah_id
      LEFT JOIN keluarga k ON ak.keluarga_id = k.id
    `;

    if (user.role === 'Super Admin') {
      jamaah_list = db.prepare(`${baseQuery} ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;`).all();
    } else if (user.role === 'Admin') {
      jamaah_list = db.prepare(`${baseQuery} WHERE j.desa = ? ORDER BY j.kelompok ASC, j.nama_lengkap ASC;`).all(user.desa);
    } else { // Moderator / Member
      jamaah_list = db.prepare(`${baseQuery} WHERE j.kelompok = ? AND j.desa = ? ORDER BY j.nama_lengkap ASC;`).all(user.kelompok, user.desa);
    }

    return NextResponse.json(jamaah_list);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    let nama_lengkap = data.nama_lengkap;
    let jenis_kelamin = data.jenis_kelamin;
    let tempat_lahir = data.tempat_lahir;
    let status_kehidupan = data.status_kehidupan || "Hidup";
    let golongan_darah = data.golongan_darah;
    let kelompok = data.kelompok;
    let pendidikan_terakhir = data.pendidikan_terakhir;
    let tanggal_lulus = data.tanggal_lulus_pendidikan_terakhir || null;
    let desa = data.desa || "Andara";
    let kategori = data.kategori || "Dewasa";

    if (user.role === 'Moderator') {
      kelompok = user.kelompok;
      desa = user.desa;
    } else if (user.role === 'Admin') {
      desa = user.desa;
    }

    if (!nama_lengkap || !jenis_kelamin || !tempat_lahir || !golongan_darah || !kelompok || !pendidikan_terakhir) {
      return NextResponse.json({ error: "Semua data wajib diisi kecuali tanggal lulus" }, { status: 400 });
    }

    if (!['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'].includes(kategori)) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }

    if (pendidikan_terakhir !== "Tidak Sekolah" && !tanggal_lulus) {
      return NextResponse.json({ error: "Tanggal lulus wajib diisi jika memiliki riwayat sekolah" }, { status: 400 });
    }

    if (pendidikan_terakhir === "Tidak Sekolah") {
      tanggal_lulus = null;
    }

    const jamaah_id = crypto.randomUUID();

    // Use a database transaction for inserting jamaah and syncing presence records
    const insertTx = db.transaction(() => {
      // 1. Insert Jamaah
      db.prepare(`
        INSERT INTO jamaah (id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus_pendidikan_terakhir, desa, kategori)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `).run(jamaah_id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa, kategori);

      // 2. Fetch matching active sessions (stubbed sessions)
      const matching_sessions = db.prepare(`
        SELECT id FROM sesi_presensi 
        WHERE desa = ? AND (jenis_pengajian = 'Pengajian Desa' OR (jenis_pengajian = 'Pengajian Kelompok' AND kelompok = ?));
      `).all(desa, kelompok);

      // 3. Insert 'Tidak Hadir' presence record for each matching session
      const insertPresence = db.prepare("INSERT INTO kehadiran (id, sesi_id, jamaah_id, status) VALUES (?, ?, ?, ?);");
      for (const session of matching_sessions) {
        insertPresence.run(crypto.randomUUID(), session.id, jamaah_id, "Tidak Hadir");
      }
    });

    insertTx();

    return NextResponse.json({
      success: true,
      id: jamaah_id,
      message: "Data jamaah berhasil ditambahkan & disinkronisasikan ke sesi presensi aktif."
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
