import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

// GET: Mendapatkan daftar seluruh master dapukan
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const { rows } = await db.query("SELECT * FROM dapukan_def ORDER BY tipe ASC, nama_dapukan ASC;");
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Gagal mengambil data master dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Membuat master dapukan baru
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Permission: matching can_create_lokasi
  if (!user.can_create_lokasi) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const nama_dapukan = data.nama_dapukan ? data.nama_dapukan.trim() : '';
    const tipe = data.tipe ? data.tipe.trim() : ''; // '4S' or 'Tim'

    if (!nama_dapukan || !tipe) {
      return NextResponse.json({ error: "Nama dapukan dan tipe (4S / Tim) wajib diisi" }, { status: 400 });
    }

    if (tipe !== '4S' && tipe !== 'Tim') {
      return NextResponse.json({ error: "Tipe dapukan tidak valid (harus 4S atau Tim)" }, { status: 400 });
    }

    // Check conflict
    const { rows: existingRows } = await db.query("SELECT COUNT(*) as count FROM dapukan_def WHERE LOWER(nama_dapukan) = LOWER($1);", [nama_dapukan]);
    if (parseInt(existingRows[0].count, 10) > 0) {
      return NextResponse.json({ error: `Dapukan dengan nama '${nama_dapukan}' sudah terdaftar` }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.query("INSERT INTO dapukan_def (id, nama_dapukan, tipe) VALUES ($1, $2, $3);", [id, nama_dapukan, tipe]);

    await logActivity(user.email, 'ADD', 'DAPUKAN_DEF', id, `Menambahkan master dapukan baru: ${nama_dapukan} (${tipe})`);

    return NextResponse.json({ success: true, id, nama_dapukan, tipe, message: "Dapukan berhasil ditambahkan" });
  } catch (error) {
    console.error("Gagal menambahkan master dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
