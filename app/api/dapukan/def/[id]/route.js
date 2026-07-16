import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

// PUT: Mengubah master dapukan
export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Permission check
  if (!user.can_update_lokasi) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

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

    // Check conflict (excl. itself)
    const { rows: existingRows } = await db.query("SELECT COUNT(*) as count FROM dapukan_def WHERE LOWER(nama_dapukan) = LOWER($1) AND id <> $2;", [nama_dapukan, id]);
    if (parseInt(existingRows[0].count, 10) > 0) {
      return NextResponse.json({ error: `Dapukan dengan nama '${nama_dapukan}' sudah terdaftar` }, { status: 400 });
    }

    await db.query("UPDATE dapukan_def SET nama_dapukan = $1, tipe = $2 WHERE id = $3;", [nama_dapukan, tipe, id]);

    await logActivity(user.email, 'UPDATE', 'DAPUKAN_DEF', id, `Mengubah master dapukan ID ${id} menjadi: ${nama_dapukan} (${tipe})`);

    return NextResponse.json({ success: true, message: "Dapukan berhasil diperbarui" });
  } catch (error) {
    console.error("Gagal mengubah master dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Menghapus master dapukan
export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Permission check
  if (!user.can_delete_lokasi) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // 1. Fetch info for logs
    const { rows } = await db.query("SELECT nama_dapukan FROM dapukan_def WHERE id = $1;", [id]);
    const dDef = rows[0];
    if (!dDef) {
      return NextResponse.json({ error: "Dapukan tidak ditemukan" }, { status: 404 });
    }

    // 2. Delete
    await db.query("DELETE FROM dapukan_def WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'DAPUKAN_DEF', id, `Menghapus master dapukan: ${dDef.nama_dapukan}`);

    return NextResponse.json({ success: true, message: "Dapukan berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus master dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
