import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_update_jamaah) {
    return NextResponse.json({ error: "Akses ditolak: Anda tidak memiliki wewenang mengubah data jamaah" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // 1. Ambil data jamaah saat ini untuk validasi scope wilayah
    const { rows: origRows } = await db.query("SELECT * FROM jamaah WHERE id = $1;", [id]);
    const orig = origRows[0];
    if (!orig) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    // Validasi scope wilayah user
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(orig.desa))) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah berada di luar desa terpantau Anda" }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(orig.kelompok))) {
      return NextResponse.json({ error: "Akses ditolak: Jamaah berada di luar kelompok terpantau Anda" }, { status: 403 });
    }

    const { rfid } = await request.json();
    const cleanRfid = rfid ? rfid.trim() : null;

    // 2. Cek keunikan RFID jika diisi
    if (cleanRfid) {
      const { rows: dupRows } = await db.query(
        "SELECT id, nama_lengkap, kelompok, desa FROM jamaah WHERE rfid = $1 AND id != $2;",
        [cleanRfid, id]
      );
      if (dupRows.length > 0) {
        const dup = dupRows[0];
        return NextResponse.json({
          error: `Kartu RFID ini sudah terikat dengan nama jamaah '${dup.nama_lengkap}' dari kelompok '${dup.kelompok}' (${dup.desa}).`
        }, { status: 400 });
      }
    }

    // 3. Update RFID di database
    await db.query("UPDATE jamaah SET rfid = $1 WHERE id = $2;", [cleanRfid, id]);

    // 4. Catat ke log aktivitas
    await logActivity(
      user.email,
      'EDIT',
      'JAMAAH',
      id,
      cleanRfid
        ? `Mengikat RFID (${cleanRfid}) ke jamaah: ${orig.nama_lengkap}`
        : `Melepas RFID dari jamaah: ${orig.nama_lengkap}`
    );

    return NextResponse.json({
      success: true,
      message: cleanRfid ? "Kartu RFID berhasil didaftarkan ke jamaah." : "Kartu RFID berhasil dilepas dari jamaah."
    });
  } catch (error) {
    console.error("Gagal memperbarui RFID jamaah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
