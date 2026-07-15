import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_update_user) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const data = await request.json();
    let role = data.role || "Member";
    let kelompok = data.kelompok || null;
    let desa = data.desa || "Andara";

    const { rows: targetRows } = await db.query("SELECT * FROM user_profiles WHERE id = $1;", [id]);
    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (target.email === user.email) {
      return NextResponse.json({ error: "Anda tidak diperbolehkan mengubah akses akun Anda sendiri" }, { status: 400 });
    }

    if (target.email === "cooltirta@gmail.com") {
      return NextResponse.json({ error: "Akses Super Admin Utama tidak dapat diubah" }, { status: 403 });
    }

    // Verify updating user's scope for both old (target) and new locations
    if (!user.monitor_all_desas) {
      if (!user.desas_pantau || !user.desas_pantau.includes(target.desa)) {
        return NextResponse.json({ error: `Akses ditolak: User target (Desa '${target.desa}') di luar wilayah terpantau Anda` }, { status: 403 });
      }
      if (!user.desas_pantau || !user.desas_pantau.includes(desa)) {
        return NextResponse.json({ error: `Akses ditolak: Desa baru '${desa}' di luar wilayah terpantau Anda` }, { status: 403 });
      }
    }
    if (!user.monitor_all_kelompoks) {
      if (target.kelompok && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(target.kelompok))) {
        return NextResponse.json({ error: `Akses ditolak: User target (Kelompok '${target.kelompok}') di luar wilayah terpantau Anda` }, { status: 403 });
      }
      if (kelompok && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(kelompok))) {
        return NextResponse.json({ error: `Akses ditolak: Kelompok baru '${kelompok}' di luar wilayah terpantau Anda` }, { status: 403 });
      }
    }

    const monitor_all_desas = !!data.monitor_all_desas;
    const desas_pantau = data.desas_pantau || [];
    const monitor_all_kelompoks = !!data.monitor_all_kelompoks;
    const kelompoks_pantau = data.kelompoks_pantau || [];

    const can_create_jamaah = !!data.can_create_jamaah;
    const can_read_jamaah = !!data.can_read_jamaah;
    const can_update_jamaah = !!data.can_update_jamaah;
    const can_delete_jamaah = !!data.can_delete_jamaah;

    const can_create_keluarga = !!data.can_create_keluarga;
    const can_read_keluarga = !!data.can_read_keluarga;
    const can_update_keluarga = !!data.can_update_keluarga;
    const can_delete_keluarga = !!data.can_delete_keluarga;

    const can_create_kehadiran = !!data.can_create_kehadiran;
    const can_read_kehadiran = !!data.can_read_kehadiran;
    const can_update_kehadiran = !!data.can_update_kehadiran;
    const can_delete_kehadiran = !!data.can_delete_kehadiran;

    const can_read_laporan = !!data.can_read_laporan;

    const can_create_user = !!data.can_create_user;
    const can_read_user = !!data.can_read_user;
    const can_update_user = !!data.can_update_user;
    const can_delete_user = !!data.can_delete_user;

    const can_create_lokasi = !!data.can_create_lokasi;
    const can_read_lokasi = !!data.can_read_lokasi;
    const can_update_lokasi = !!data.can_update_lokasi;
    const can_delete_lokasi = !!data.can_delete_lokasi;

    const can_read_logs = !!data.can_read_logs;

    const can_create_pnkb = !!data.can_create_pnkb;
    const can_read_pnkb = !!data.can_read_pnkb;
    const can_update_pnkb = !!data.can_update_pnkb;
    const can_delete_pnkb = !!data.can_delete_pnkb;

    const can_create_haji = !!data.can_create_haji;
    const can_read_haji = !!data.can_read_haji;
    const can_update_haji = !!data.can_update_haji;
    const can_delete_haji = !!data.can_delete_haji;

    const can_create_sabilillah = !!data.can_create_sabilillah;
    const can_read_sabilillah = !!data.can_read_sabilillah;
    const can_update_sabilillah = !!data.can_update_sabilillah;
    const can_delete_sabilillah = !!data.can_delete_sabilillah;

    const can_create_kalender = !!data.can_create_kalender;
    const can_read_kalender = !!data.can_read_kalender;
    const can_update_kalender = !!data.can_update_kalender;
    const can_delete_kalender = !!data.can_delete_kalender;

    await db.query(`
      UPDATE user_profiles SET
        role = $1, kelompok = $2, desa = $3,
        monitor_all_desas = $4, desas_pantau = $5,
        monitor_all_kelompoks = $6, kelompoks_pantau = $7,
        can_create_jamaah = $8, can_read_jamaah = $9, can_update_jamaah = $10, can_delete_jamaah = $11,
        can_create_keluarga = $12, can_read_keluarga = $13, can_update_keluarga = $14, can_delete_keluarga = $15,
        can_create_kehadiran = $16, can_read_kehadiran = $17, can_update_kehadiran = $18, can_delete_kehadiran = $19,
        can_read_laporan = $20,
        can_create_user = $21, can_read_user = $22, can_update_user = $23, can_delete_user = $24,
        can_create_lokasi = $25, can_read_lokasi = $26, can_update_lokasi = $27, can_delete_lokasi = $28,
        can_read_logs = $29,
        can_create_pnkb = $30, can_read_pnkb = $31, can_update_pnkb = $32, can_delete_pnkb = $33,
        can_create_haji = $34, can_read_haji = $35, can_update_haji = $36, can_delete_haji = $37,
        can_create_sabilillah = $38, can_read_sabilillah = $39, can_update_sabilillah = $40, can_delete_sabilillah = $41,
        can_create_kalender = $42, can_read_kalender = $43, can_update_kalender = $44, can_delete_kalender = $45
      WHERE id = $46;
    `, [
      role, kelompok, desa,
      monitor_all_desas, desas_pantau,
      monitor_all_kelompoks, kelompoks_pantau,
      can_create_jamaah, can_read_jamaah, can_update_jamaah, can_delete_jamaah,
      can_create_keluarga, can_read_keluarga, can_update_keluarga, can_delete_keluarga,
      can_create_kehadiran, can_read_kehadiran, can_update_kehadiran, can_delete_kehadiran,
      can_read_laporan,
      can_create_user, can_read_user, can_update_user, can_delete_user,
      can_create_lokasi, can_read_lokasi, can_update_lokasi, can_delete_lokasi,
      can_read_logs,
      can_create_pnkb, can_read_pnkb, can_update_pnkb, can_delete_pnkb,
      can_create_haji, can_read_haji, can_update_haji, can_delete_haji,
      can_create_sabilillah, can_read_sabilillah, can_update_sabilillah, can_delete_sabilillah,
      can_create_kalender, can_read_kalender, can_update_kalender, can_delete_kalender,
      id
    ]);

    await logActivity(user.email, 'EDIT', 'USER', id, `Mengubah akses user: ${target.email} menjadi Role=${role}, Desa=${desa}, Kelompok=${kelompok}`);

    return NextResponse.json({ success: true, message: "User access berhasil diperbarui" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_delete_user) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { rows: targetRows } = await db.query("SELECT * FROM user_profiles WHERE id = $1;", [id]);
    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (target.email === user.email) {
      return NextResponse.json({ error: "Anda tidak diperbolehkan menghapus akun Anda sendiri" }, { status: 400 });
    }

    if (target.email === "cooltirta@gmail.com") {
      return NextResponse.json({ error: "Akun Super Admin Utama tidak dapat dihapus" }, { status: 403 });
    }

    // Verify scope bounds
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(target.desa))) {
      return NextResponse.json({ error: `Akses ditolak: User target (Desa '${target.desa}') di luar wilayah terpantau Anda` }, { status: 403 });
    }
    if (target.kelompok && !user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(target.kelompok))) {
      return NextResponse.json({ error: `Akses ditolak: User target (Kelompok '${target.kelompok}') di luar wilayah terpantau Anda` }, { status: 403 });
    }

    await db.query("DELETE FROM user_profiles WHERE id = $1;", [id]);

    await logActivity(user.email, 'DELETE', 'USER', id, `Menghapus user: ${target.email} (Role: ${target.role}, Desa: ${target.desa})`);

    return NextResponse.json({ success: true, message: "User berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
