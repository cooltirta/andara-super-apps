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

  const { id } = await params;

  try {
    const { rows: jRows } = await db.query(`
      SELECT j.* FROM anggota_keluarga ak 
      JOIN jamaah j ON ak.jamaah_id = j.id 
      WHERE ak.keluarga_id = $1;
    `, [id]);

    if (jRows.length > 0) {
      if (user.role === 'Moderator') {
        const hasMemberInGroup = jRows.some(j => j.kelompok === user.kelompok && j.desa === user.desa);
        if (!hasMemberInGroup) {
          return NextResponse.json({ error: "Akses ditolak: Unit keluarga di luar kelompok terpantau Anda" }, { status: 403 });
        }
      } else if (user.role === 'Admin') {
        const hasMemberInDesa = jRows.some(j => j.desa === user.desa);
        if (!hasMemberInDesa) {
          return NextResponse.json({ error: "Akses ditolak: Unit keluarga di luar desa terpantau Anda" }, { status: 403 });
        }
      }
    }

    await db.query("DELETE FROM keluarga WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'KELUARGA', id, `Menghapus unit keluarga ID: ${id}`);

    return NextResponse.json({ success: true, message: "Keluarga berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
