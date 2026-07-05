import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_update_keluarga) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { anggota_id } = await params;

  try {
    const { rows: memberRows } = await db.query(`
      SELECT ak.keluarga_id, ak.jamaah_id, j.nama_lengkap 
      FROM anggota_keluarga ak 
      JOIN jamaah j ON ak.jamaah_id = j.id 
      WHERE ak.id = $1;
    `, [anggota_id]);
    const member = memberRows[0];
    if (!member) {
      return NextResponse.json({ error: "Anggota keluarga tidak ditemukan" }, { status: 404 });
    }
    const keluargaId = member.keluarga_id;

    // Check Kepala Keluarga of target family
    const { rows: headRows } = await db.query(`
      SELECT j.* FROM anggota_keluarga ak
      JOIN jamaah j ON ak.jamaah_id = j.id
      WHERE ak.keluarga_id = $1 AND ak.jenis_anggota = 'Kepala Keluarga';
    `, [keluargaId]);
    const head = headRows[0];
    if (head) {
      if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(head.desa))) {
        return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga di luar desa terpantau Anda" }, { status: 403 });
      }
      if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(head.kelompok))) {
        return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga di luar kelompok terpantau Anda" }, { status: 403 });
      }
    }

    await db.query("DELETE FROM anggota_keluarga WHERE id = $1;", [anggota_id]);

    await logActivity(user.email, 'DELETE_MEMBER', 'KELUARGA', anggota_id, `Mengeluarkan anggota keluarga: ${member.nama_lengkap} dari unit keluarga`);

    return NextResponse.json({ success: true, message: "Anggota keluarga berhasil dikeluarkan" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
