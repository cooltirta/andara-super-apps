import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

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
    const { rows: origRows } = await db.query("SELECT * FROM jamaah WHERE id = $1;", [id]);
    const orig = origRows[0];
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
    let tempat_lahir = data.tempat_lahir || null;
    let status_kehidupan = data.status_kehidupan || "Hidup";
    let golongan_darah = data.golongan_darah || "Tidak Diketahui";
    let kelompok = data.kelompok;
    let pendidikan_terakhir = data.pendidikan_terakhir;
    let tanggal_lulus = data.tanggal_lulus_pendidikan_terakhir || null;
    let desa = data.desa || "Andara";
    let kategori = data.kategori || "Dewasa";
    let tanggal_lahir = data.tanggal_lahir || null;
    let status_pernikahan = data.status_pernikahan || "Belum Menikah";

    if (user.role === 'Moderator') {
      kelompok = user.kelompok;
      desa = user.desa;
    } else if (user.role === 'Admin') {
      desa = user.desa;
    }

    if (!nama_lengkap || !jenis_kelamin || !golongan_darah || !kelompok || !pendidikan_terakhir) {
      return NextResponse.json({ error: "Nama lengkap, jenis kelamin, golongan darah, kelompok, dan pendidikan terakhir wajib diisi" }, { status: 400 });
    }

    if (!['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'].includes(kategori)) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }

    if (pendidikan_terakhir === "Tidak Sekolah") {
      tanggal_lulus = null;
    }

    await db.query("BEGIN;");
    try {
      // 1. Update the jamaah record
      await db.query(`
        UPDATE jamaah 
        SET nama_lengkap = $1, jenis_kelamin = $2, tempat_lahir = $3, status_kehidupan = $4, golongan_darah = $5, kelompok = $6, pendidikan_terakhir = $7, tanggal_lulus_pendidikan_terakhir = $8, desa = $9, kategori = $10, tanggal_lahir = $11, status_pernikahan = $12
        WHERE id = $13;
      `, [nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa, kategori, tanggal_lahir, status_pernikahan, id]);

      // 2. Business logic: transition wives to 'Janda' or husband to 'Duda' if status_kehidupan becomes 'Meninggal'
      if (status_kehidupan === 'Meninggal' && orig.status_kehidupan !== 'Meninggal') {
        // A. If deceased is a Kepala Keluarga (husband), find wives and update them to 'Janda'
        const { rows: kkRows } = await db.query(
          "SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = $1 AND jenis_anggota = 'Kepala Keluarga';",
          [id]
        );
        if (kkRows.length > 0) {
          const keluargaId = kkRows[0].keluarga_id;
          await db.query(`
            UPDATE jamaah 
            SET status_pernikahan = 'Janda' 
            WHERE id IN (
              SELECT jamaah_id 
              FROM anggota_keluarga 
              WHERE keluarga_id = $1 AND jenis_anggota = 'Istri'
            );
          `, [keluargaId]);
        }

        // B. If deceased is an Istri (wife), check if all other wives in this family unit are deceased.
        // If they are all deceased, set Kepala Keluarga to 'Duda'.
        const { rows: istriRows } = await db.query(
          "SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = $1 AND jenis_anggota = 'Istri';",
          [id]
        );
        if (istriRows.length > 0) {
          const keluargaId = istriRows[0].keluarga_id;
          const { rows: allWives } = await db.query(`
            SELECT j.id, j.status_kehidupan 
            FROM jamaah j 
            JOIN anggota_keluarga ak ON j.id = ak.jamaah_id 
            WHERE ak.keluarga_id = $1 AND ak.jenis_anggota = 'Istri';
          `, [keluargaId]);

          const allDeceased = allWives.every(w => {
            if (w.id === id) return true; // Current wife is deceased
            return w.status_kehidupan === 'Meninggal';
          });

          if (allDeceased && allWives.length > 0) {
            const { rows: targetKk } = await db.query(
              "SELECT jamaah_id FROM anggota_keluarga WHERE keluarga_id = $1 AND jenis_anggota = 'Kepala Keluarga';",
              [keluargaId]
            );
            if (targetKk.length > 0) {
              await db.query(
                "UPDATE jamaah SET status_pernikahan = 'Duda' WHERE id = $1;",
                [targetKk[0].jamaah_id]
              );
            }
          }
        }
      }

      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    await logActivity(user.email, 'EDIT', 'JAMAAH', id, `Mengubah data jamaah: ${nama_lengkap} (Sebelumnya: ${orig.nama_lengkap})`);

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
    const { rows: origRows } = await db.query("SELECT * FROM jamaah WHERE id = $1;", [id]);
    const orig = origRows[0];
    if (!orig) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (orig.kelompok !== user.kelompok || orig.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah di luar kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && orig.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah di luar desa Anda" }, { status: 403 });
    }

    await db.query("DELETE FROM jamaah WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'JAMAAH', id, `Menghapus jamaah: ${orig.nama_lengkap} (Desa: ${orig.desa}, Kelompok: ${orig.kelompok})`);

    return NextResponse.json({ success: true, message: "Data jamaah berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
