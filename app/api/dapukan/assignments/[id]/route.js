import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

// DELETE: Menghapus penugasan dapukan
export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Permission check
  if (!user.can_update_lokasi) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // 1. Fetch details for logs
    const { rows } = await db.query(`
      SELECT j.nama_lengkap, dd.nama_dapukan, da.level
      FROM dapukan_assignment da
      JOIN jamaah j ON da.jamaah_id = j.id
      JOIN dapukan_def dd ON da.dapukan_def_id = dd.id
      WHERE da.id = $1;
    `, [id]);
    const assignment = rows[0];
    if (!assignment) {
      return NextResponse.json({ error: "Penugasan tidak ditemukan" }, { status: 404 });
    }

    // 2. Delete
    await db.query("DELETE FROM dapukan_assignment WHERE id = $1;", [id]);

    await logActivity(
      user.email, 'DELETE', 'DAPUKAN_ASSIGNMENT', id, 
      `Mencabut tugas ${assignment.nama_lengkap} sebagai ${assignment.nama_dapukan} tingkat ${assignment.level}`
    );

    return NextResponse.json({ success: true, message: "Penugasan berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus penugasan dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
