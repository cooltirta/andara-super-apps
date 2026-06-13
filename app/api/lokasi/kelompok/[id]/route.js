import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

// PUT: Mengubah nama Kelompok (Khusus Super Admin)
export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role !== 'Super Admin') {
    return NextResponse.json({ error: "Akses ditolak: Hanya Super Admin yang dapat mengubah lokasi" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const data = await request.json();
    const nama_kelompok = data.nama_kelompok ? data.nama_kelompok.trim() : '';

    if (!nama_kelompok) {
      return NextResponse.json({ error: "Nama kelompok wajib diisi" }, { status: 400 });
    }

    // 1. Dapatkan nama kelompok lama beserta nama desa induknya
    const { rows: origRows } = await db.query(
      `SELECT k.nama_kelompok, d.nama_desa, k.desa_id 
       FROM kelompoks k 
       JOIN desas d ON k.desa_id = d.id 
       WHERE k.id = $1;`, 
      [id]
    );
    const orig = origRows[0];
    if (!orig) {
      return NextResponse.json({ error: "Kelompok tidak ditemukan" }, { status: 404 });
    }

    if (orig.nama_kelompok === nama_kelompok) {
      return NextResponse.json({ success: true, message: "Nama kelompok sama, tidak ada perubahan" });
    }

    // Cek jika kelompok dengan nama baru sudah ada di desa tersebut
    const { rows: existingRows } = await db.query(
      "SELECT COUNT(*) as count FROM kelompoks WHERE nama_kelompok = $1 AND desa_id = $2 AND id != $3;",
      [nama_kelompok, orig.desa_id, id]
    );
    if (parseInt(existingRows[0].count, 10) > 0) {
      return NextResponse.json({ error: "Kelompok dengan nama ini sudah terdaftar di desa tersebut" }, { status: 400 });
    }

    // 2. Jalankan pembaruan berantai (cascade update) dalam transaksi
    await db.query("BEGIN;");
    try {
      // Update tabel master kelompok
      await db.query("UPDATE kelompoks SET nama_kelompok = $1 WHERE id = $2;", [nama_kelompok, id]);
      
      // Cascade update di jamaah
      await db.query(
        "UPDATE jamaah SET kelompok = $1 WHERE kelompok = $2 AND desa = $3;", 
        [nama_kelompok, orig.nama_kelompok, orig.nama_desa]
      );
      
      // Cascade update di user profiles
      await db.query(
        "UPDATE user_profiles SET kelompok = $1 WHERE kelompok = $2 AND desa = $3;", 
        [nama_kelompok, orig.nama_kelompok, orig.nama_desa]
      );

      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    await logActivity(
      user.email, 
      'EDIT', 
      'LOKASI', 
      id, 
      `Mengubah nama kelompok: ${orig.nama_kelompok} -> ${nama_kelompok} di Desa ${orig.nama_desa} (Pembaruan diterapkan cascade ke jamaah & user)`
    );

    return NextResponse.json({ success: true, message: "Nama kelompok berhasil diperbarui" });
  } catch (error) {
    console.error("Gagal memperbarui kelompok:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Menghapus Kelompok (Khusus Super Admin)
export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role !== 'Super Admin') {
    return NextResponse.json({ error: "Akses ditolak: Hanya Super Admin yang dapat menghapus lokasi" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // 1. Dapatkan nama kelompok beserta nama desa induknya
    const { rows: origRows } = await db.query(
      `SELECT k.nama_kelompok, d.nama_desa 
       FROM kelompoks k 
       JOIN desas d ON k.desa_id = d.id 
       WHERE k.id = $1;`, 
      [id]
    );
    const orig = origRows[0];
    if (!orig) {
      return NextResponse.json({ error: "Kelompok tidak ditemukan" }, { status: 404 });
    }

    // 2. Cegah penghapusan jika masih ada jamaah di kelompok/desa ini
    const { rows: jRows } = await db.query(
      "SELECT COUNT(*) as count FROM jamaah WHERE kelompok = $1 AND desa = $2;", 
      [orig.nama_kelompok, orig.nama_desa]
    );
    if (parseInt(jRows[0].count, 10) > 0) {
      return NextResponse.json({ 
        error: `Gagal menghapus: Masih terdapat ${jRows[0].count} orang jamaah yang terdaftar di Kelompok ${orig.nama_kelompok} (Desa ${orig.nama_desa}). Pindahkan atau ubah data kelompok mereka terlebih dahulu.`
      }, { status: 400 });
    }

    // 3. Cegah penghapusan jika masih ada user profile di kelompok/desa ini
    const { rows: uRows } = await db.query(
      "SELECT COUNT(*) as count FROM user_profiles WHERE kelompok = $1 AND desa = $2;", 
      [orig.nama_kelompok, orig.nama_desa]
    );
    if (parseInt(uRows[0].count, 10) > 0) {
      return NextResponse.json({ 
        error: `Gagal menghapus: Masih terdapat ${uRows[0].count} akun pengguna (user access) yang terdaftar di Kelompok ${orig.nama_kelompok} (Desa ${orig.nama_desa}). Ubah penugasan kelompok mereka terlebih dahulu.`
      }, { status: 400 });
    }

    // 4. Lakukan penghapusan
    await db.query("DELETE FROM kelompoks WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'LOKASI', id, `Menghapus kelompok: ${orig.nama_kelompok} di Desa ${orig.nama_desa}`);

    return NextResponse.json({ success: true, message: "Kelompok berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus kelompok:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
