import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

// PUT: Mengubah nama Desa (Khusus Super Admin)
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
    const nama_desa = data.nama_desa ? data.nama_desa.trim() : '';

    if (!nama_desa) {
      return NextResponse.json({ error: "Nama desa wajib diisi" }, { status: 400 });
    }

    // 1. Dapatkan nama desa lama
    const { rows: origRows } = await db.query("SELECT nama_desa FROM desas WHERE id = $1;", [id]);
    const orig = origRows[0];
    if (!orig) {
      return NextResponse.json({ error: "Desa tidak ditemukan" }, { status: 404 });
    }

    if (orig.nama_desa === nama_desa) {
      return NextResponse.json({ success: true, message: "Nama desa sama, tidak ada perubahan" });
    }

    // 2. Jalankan pembaruan berantai (cascade update) dalam transaksi
    await db.query("BEGIN;");
    try {
      // Update tabel master desa
      await db.query("UPDATE desas SET nama_desa = $1 WHERE id = $2;", [nama_desa, id]);
      
      // Cascade update di jamaah
      await db.query("UPDATE jamaah SET desa = $1 WHERE desa = $2;", [nama_desa, orig.nama_desa]);
      
      // Cascade update di user profiles
      await db.query("UPDATE user_profiles SET desa = $1 WHERE desa = $2;", [nama_desa, orig.nama_desa]);

      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    await logActivity(user.email, 'EDIT', 'LOKASI', id, `Mengubah nama desa: ${orig.nama_desa} -> ${nama_desa} (Pembaruan diterapkan cascade ke jamaah & user)`);

    return NextResponse.json({ success: true, message: "Nama desa berhasil diperbarui" });
  } catch (error) {
    console.error("Gagal memperbarui desa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Menghapus Desa (Khusus Super Admin)
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
    // 1. Dapatkan nama desa
    const { rows: origRows } = await db.query("SELECT nama_desa FROM desas WHERE id = $1;", [id]);
    const orig = origRows[0];
    if (!orig) {
      return NextResponse.json({ error: "Desa tidak ditemukan" }, { status: 404 });
    }

    // 2. Cegah penghapusan jika masih ada jamaah di desa ini
    const { rows: jRows } = await db.query("SELECT COUNT(*) as count FROM jamaah WHERE desa = $1;", [orig.nama_desa]);
    if (parseInt(jRows[0].count, 10) > 0) {
      return NextResponse.json({ 
        error: `Gagal menghapus: Masih terdapat ${jRows[0].count} orang jamaah yang terdaftar di Desa ${orig.nama_desa}. Pindahkan atau ubah data desa mereka terlebih dahulu.`
      }, { status: 400 });
    }

    // 3. Cegah penghapusan jika masih ada user profile di desa ini
    const { rows: uRows } = await db.query("SELECT COUNT(*) as count FROM user_profiles WHERE desa = $1;", [orig.nama_desa]);
    if (parseInt(uRows[0].count, 10) > 0) {
      return NextResponse.json({ 
        error: `Gagal menghapus: Masih terdapat ${uRows[0].count} akun pengguna (user access) yang terdaftar di Desa ${orig.nama_desa}. Ubah penugasan desa mereka terlebih dahulu.`
      }, { status: 400 });
    }

    // 4. Lakukan penghapusan (kelompok di bawah desa akan terhapus otomatis via CASCADE REFERENCES)
    await db.query("DELETE FROM desas WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'LOKASI', id, `Menghapus desa: ${orig.nama_desa}`);

    return NextResponse.json({ success: true, message: "Desa berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus desa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
