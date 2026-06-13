import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const data = await request.json();
    const jamaah_id = data.jamaah_id;
    const jenis_anggota = data.jenis_anggota;

    if (!jamaah_id || !jenis_anggota) {
      return NextResponse.json({ error: "Jamaah dan jenis anggota wajib dipilih" }, { status: 400 });
    }

    const j_target = db.prepare("SELECT * FROM jamaah WHERE id = ?;").get(jamaah_id);
    if (!j_target) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (j_target.kelompok !== user.kelompok || j_target.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah harus berada di kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && j_target.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah harus berada di desa Anda" }, { status: 403 });
    }

    const existing = db.prepare("SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = ?;").get(jamaah_id);
    if (existing) {
      return NextResponse.json({ error: "Jamaah ini sudah terdaftar di keluarga lain" }, { status: 400 });
    }

    if (jenis_anggota === 'Kepala Keluarga') {
      const count = db.prepare("SELECT COUNT(*) as count FROM anggota_keluarga WHERE keluarga_id = ? AND jenis_anggota = 'Kepala Keluarga';").get(id).count;
      if (count > 0) {
        return NextResponse.json({ error: "Keluarga ini sudah memiliki Kepala Keluarga" }, { status: 400 });
      }
    }

    const anggota_id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO anggota_keluarga (id, keluarga_id, jamaah_id, jenis_anggota) 
      VALUES (?, ?, ?, ?);
    `).run(anggota_id, id, jamaah_id, jenis_anggota);

    return NextResponse.json({ success: true, message: "Anggota keluarga berhasil ditambahkan" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
