import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

// POST: Membuat Kelompok baru di bawah Desa tertentu (Khusus Super Admin)
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_create_lokasi) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const nama_kelompok = data.nama_kelompok ? data.nama_kelompok.trim() : '';
    const desa_id = data.desa_id ? data.desa_id.trim() : '';

    if (!nama_kelompok) {
      return NextResponse.json({ error: "Nama kelompok wajib diisi" }, { status: 400 });
    }
    if (!desa_id) {
      return NextResponse.json({ error: "ID desa wajib diisi" }, { status: 400 });
    }

    // Cek jika desa ada
    const { rows: desaRows } = await db.query("SELECT nama_desa FROM desas WHERE id = $1;", [desa_id]);
    if (desaRows.length === 0) {
      return NextResponse.json({ error: "Desa tidak ditemukan" }, { status: 404 });
    }
    const nama_desa = desaRows[0].nama_desa;

    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(nama_desa))) {
      return NextResponse.json({ error: `Akses ditolak: Desa '${nama_desa}' di luar wilayah terpantau Anda` }, { status: 403 });
    }

    // Cek jika kelompok dengan nama sama sudah ada di desa tersebut
    const { rows: existingRows } = await db.query(
      "SELECT COUNT(*) as count FROM kelompoks WHERE nama_kelompok = $1 AND desa_id = $2;",
      [nama_kelompok, desa_id]
    );
    if (parseInt(existingRows[0].count, 10) > 0) {
      return NextResponse.json({ error: "Kelompok dengan nama ini sudah terdaftar di desa tersebut" }, { status: 400 });
    }

    const kelompok_id = crypto.randomUUID();
    await db.query(
      "INSERT INTO kelompoks (id, nama_kelompok, desa_id) VALUES ($1, $2, $3);",
      [kelompok_id, nama_kelompok, desa_id]
    );

    await logActivity(user.email, 'ADD', 'LOKASI', kelompok_id, `Menambahkan kelompok baru: ${nama_kelompok} di Desa ${nama_desa}`);

    return NextResponse.json({ 
      success: true, 
      id: kelompok_id, 
      nama_kelompok, 
      desa_id, 
      message: "Kelompok berhasil ditambahkan" 
    });
  } catch (error) {
    console.error("Gagal menambahkan kelompok:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
