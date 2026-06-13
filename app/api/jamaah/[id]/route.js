import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
    // Check if jamaah exists and verify scope
    const orig = db.prepare("SELECT * FROM jamaah WHERE id = ?;").get(id);
    if (!orig) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (orig.kelompok !== user.kelompok || orig.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah di luar kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && orig.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah di luar desa Anda" }, { status: 403 });
    }

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

    db.prepare(`
      UPDATE jamaah 
      SET nama_lengkap = ?, jenis_kelamin = ?, tempat_lahir = ?, status_kehidupan = ?, golongan_darah = ?, kelompok = ?, pendidikan_terakhir = ?, tanggal_lulus_pendidikan_terakhir = ?, desa = ?, kategori = ?
      WHERE id = ?;
    `).run(nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa, kategori, id);

    return NextResponse.json({ success: true, message: "Data jamaah berhasil diperbarui" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const orig = db.prepare("SELECT * FROM jamaah WHERE id = ?;").get(id);
    if (!orig) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (orig.kelompok !== user.kelompok || orig.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah di luar kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && orig.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah di luar desa Anda" }, { status: 403 });
    }

    db.prepare("DELETE FROM jamaah WHERE id = ?;").run(id);

    return NextResponse.json({ success: true, message: "Data jamaah berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
