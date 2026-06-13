import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { anggota_id } = await params;

  try {
    const { rows: jRows } = await db.query(`
      SELECT j.* FROM anggota_keluarga ak 
      JOIN jamaah j ON ak.jamaah_id = j.id 
      WHERE ak.id = $1;
    `, [anggota_id]);
    const j_row = jRows[0];

    if (!j_row) {
      return NextResponse.json({ error: "Anggota keluarga tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (j_row.kelompok !== user.kelompok || j_row.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Anggota keluarga di luar kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && j_row.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Anggota keluarga di luar desa Anda" }, { status: 403 });
    }

    await db.query("DELETE FROM anggota_keluarga WHERE id = $1;", [anggota_id]);

    await logActivity(user.email, 'DELETE_MEMBER', 'KELUARGA', anggota_id, `Mengeluarkan anggota keluarga: ${j_row.nama_lengkap} dari unit keluarga`);

    return NextResponse.json({ success: true, message: "Anggota keluarga berhasil dikeluarkan" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
