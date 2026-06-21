import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

// PUT: Memperbarui data barang
export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { rows } = await db.query("SELECT * FROM barang_sabilillah WHERE id = $1;", [id]);
    const orig = rows[0];
    if (!orig) {
      return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    }

    // Validasi wilayah terpantau user untuk barang yang ada
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(orig.desa))) {
      return NextResponse.json({ error: "Akses ditolak: Barang di luar desa terpantau Anda" }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(orig.kelompok))) {
      return NextResponse.json({ error: "Akses ditolak: Barang di luar kelompok terpantau Anda" }, { status: 403 });
    }

    const data = await request.json();
    const nama_barang = data.nama_barang ? data.nama_barang.trim() : orig.nama_barang;
    const jumlah_total = data.jumlah_total !== undefined ? parseInt(data.jumlah_total, 10) : orig.jumlah_total;
    const tempat_simpan = data.tempat_simpan ? data.tempat_simpan.trim() : orig.tempat_simpan;
    const foto_url = data.foto_url !== undefined ? data.foto_url : orig.foto_url;
    const keterangan = data.keterangan !== undefined ? data.keterangan : orig.keterangan;
    const desa = data.desa || orig.desa;
    const kelompok = data.kelompok || orig.kelompok;

    if (!nama_barang || isNaN(jumlah_total) || jumlah_total < 0 || !tempat_simpan || !desa || !kelompok) {
      return NextResponse.json({ error: "Kolom nama barang, jumlah total (>=0), lokasi simpan, desa, dan kelompok wajib diisi" }, { status: 400 });
    }

    // Validasi wilayah terpantau user untuk nilai lokasi yang baru
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(desa))) {
      return NextResponse.json({ error: `Akses ditolak: Desa baru '${desa}' di luar wilayah terpantau Anda` }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(kelompok))) {
      return NextResponse.json({ error: `Akses ditolak: Kelompok baru '${kelompok}' di luar wilayah terpantau Anda` }, { status: 403 });
    }

    await db.query(`
      UPDATE barang_sabilillah 
      SET nama_barang = $1, jumlah_total = $2, tempat_simpan = $3, foto_url = $4, keterangan = $5, desa = $6, kelompok = $7
      WHERE id = $8;
    `, [nama_barang, jumlah_total, tempat_simpan, foto_url, keterangan, desa, kelompok, id]);

    await logActivity(user.email, 'EDIT', 'SB_BARANG', id, `Mengubah data barang sabilillah: ${nama_barang} (Total: ${jumlah_total} pcs)`);

    return NextResponse.json({ success: true, message: "Data barang sabilillah berhasil diperbarui" });
  } catch (error) {
    console.error("Gagal memperbarui barang sabilillah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Menghapus barang sabilillah
export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { rows } = await db.query("SELECT * FROM barang_sabilillah WHERE id = $1;", [id]);
    const orig = rows[0];
    if (!orig) {
      return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    }

    // Validasi wilayah terpantau user
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(orig.desa))) {
      return NextResponse.json({ error: "Akses ditolak: Barang di luar desa terpantau Anda" }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(orig.kelompok))) {
      return NextResponse.json({ error: "Akses ditolak: Barang di luar kelompok terpantau Anda" }, { status: 403 });
    }

    // Pastikan tidak ada peminjaman aktif/belum dikembalikan
    const { rows: pinjamRows } = await db.query(
      "SELECT COUNT(*) as count FROM peminjaman_sabilillah WHERE barang_id = $1 AND status = 'Dipinjam';",
      [id]
    );
    if (parseInt(pinjamRows[0].count, 10) > 0) {
      return NextResponse.json({ error: "Gagal menghapus: Masih ada peminjaman aktif untuk barang ini. Selesaikan peminjaman terlebih dahulu." }, { status: 400 });
    }

    await db.query("DELETE FROM barang_sabilillah WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'SB_BARANG', id, `Menghapus barang sabilillah: ${orig.nama_barang}`);

    return NextResponse.json({ success: true, message: "Barang sabilillah berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus barang sabilillah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
