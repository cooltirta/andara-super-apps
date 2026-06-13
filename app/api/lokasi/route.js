import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

// GET: Mendapatkan pohon (tree) Desa dan Kelompok
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const { rows: desas } = await db.query("SELECT * FROM desas ORDER BY nama_desa ASC;");
    const { rows: kelompoks } = await db.query("SELECT * FROM kelompoks ORDER BY nama_kelompok ASC;");

    const tree = desas.map(desa => ({
      ...desa,
      kelompoks: kelompoks.filter(k => k.desa_id === desa.id)
    }));

    return NextResponse.json(tree);
  } catch (error) {
    console.error("Gagal mengambil data lokasi:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Membuat Desa baru (Khusus Super Admin)
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Hanya Super Admin yang diperbolehkan melakukan CRUD Master Data Lokasi
  if (user.role !== 'Super Admin') {
    return NextResponse.json({ error: "Akses ditolak: Hanya Super Admin yang dapat membuat lokasi baru" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const nama_desa = data.nama_desa ? data.nama_desa.trim() : '';

    if (!nama_desa) {
      return NextResponse.json({ error: "Nama desa wajib diisi" }, { status: 400 });
    }

    // Cek jika desa dengan nama sama sudah terdaftar
    const { rows: existingRows } = await db.query("SELECT COUNT(*) as count FROM desas WHERE nama_desa = $1;", [nama_desa]);
    if (parseInt(existingRows[0].count, 10) > 0) {
      return NextResponse.json({ error: "Desa dengan nama ini sudah terdaftar" }, { status: 400 });
    }

    const desa_id = crypto.randomUUID();
    await db.query("INSERT INTO desas (id, nama_desa) VALUES ($1, $2);", [desa_id, nama_desa]);

    await logActivity(user.email, 'ADD', 'LOKASI', desa_id, `Menambahkan desa baru: ${nama_desa}`);

    return NextResponse.json({ success: true, id: desa_id, nama_desa, message: "Desa berhasil ditambahkan" });
  } catch (error) {
    console.error("Gagal menambahkan desa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
