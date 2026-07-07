import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_delete_keluarga) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { rows: headRows } = await db.query(`
      SELECT j.* FROM anggota_keluarga ak
      JOIN jamaah j ON ak.jamaah_id = j.id
      WHERE ak.keluarga_id = $1 AND ak.jenis_anggota = 'Kepala Keluarga';
    `, [id]);
    const head = headRows[0];
    if (head) {
      if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(head.desa))) {
        return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga di luar desa terpantau Anda" }, { status: 403 });
      }
      if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(head.kelompok))) {
        return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga di luar kelompok terpantau Anda" }, { status: 403 });
      }
    }

    await db.query("DELETE FROM keluarga WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'KELUARGA', id, `Menghapus unit keluarga ID: ${id}`);

    return NextResponse.json({ success: true, message: "Keluarga berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_update_keluarga) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const data = await request.json();
    const { nama_keluarga } = data;

    if (!nama_keluarga || !nama_keluarga.trim()) {
      return NextResponse.json({ error: "Nama keluarga wajib diisi" }, { status: 400 });
    }

    const { rows: headRows } = await db.query(`
      SELECT j.* FROM anggota_keluarga ak
      JOIN jamaah j ON ak.jamaah_id = j.id
      WHERE ak.keluarga_id = $1 AND ak.jenis_anggota = 'Kepala Keluarga';
    `, [id]);
    const head = headRows[0];
    if (head) {
      if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(head.desa))) {
        return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga di luar desa terpantau Anda" }, { status: 403 });
      }
      if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(head.kelompok))) {
        return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga di luar kelompok terpantau Anda" }, { status: 403 });
      }
    }

    await db.query("UPDATE keluarga SET nama_keluarga = $1 WHERE id = $2;", [nama_keluarga.trim(), id]);

    await logActivity(user.email, 'UPDATE', 'KELUARGA', id, `Mengubah nama unit keluarga menjadi: ${nama_keluarga.trim()}`);

    return NextResponse.json({ success: true, message: "Keluarga berhasil diperbarui" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
