import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
    const j_row = db.prepare(`
      SELECT j.* FROM anggota_keluarga ak 
      JOIN jamaah j ON ak.jamaah_id = j.id 
      WHERE ak.keluarga_id = ? LIMIT 1;
    `).get(id);

    if (j_row) {
      if (user.role === 'Moderator' && (j_row.kelompok !== user.kelompok || j_row.desa !== user.desa)) {
        return NextResponse.json({ error: "Akses ditolak: Unit keluarga di luar kelompok Anda" }, { status: 403 });
      } else if (user.role === 'Admin' && j_row.desa !== user.desa) {
        return NextResponse.json({ error: "Akses ditolak: Unit keluarga di luar desa Anda" }, { status: 403 });
      }
    }

    db.prepare("DELETE FROM keluarga WHERE id = ?;").run(id);

    return NextResponse.json({ success: true, message: "Keluarga berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
