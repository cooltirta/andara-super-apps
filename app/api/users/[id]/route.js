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
    const data = await request.json();
    let role = data.role;
    let kelompok = data.kelompok;
    let desa = data.desa || "Andara";

    if (!role) {
      return NextResponse.json({ error: "Role wajib dipilih" }, { status: 400 });
    }

    const { rows: targetRows } = await db.query("SELECT * FROM user_profiles WHERE id = $1;", [id]);
    const target = targetRows[0];
    if (!target) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (target.email === user.email) {
      return NextResponse.json({ error: "Anda tidak diperbolehkan mengubah role akun Anda sendiri" }, { status: 400 });
    }

    if (target.email === "cooltirta@gmail.com") {
      return NextResponse.json({ error: "Role Super Admin Utama tidak dapat diubah" }, { status: 403 });
    }

    if (user.role === 'Moderator') {
      return NextResponse.json({ error: "Moderator tidak diperbolehkan memperbarui data user lain" }, { status: 403 });
    } else if (user.role === 'Admin') {
      if (target.desa !== user.desa || ['Admin', 'Super Admin'].includes(target.role)) {
        return NextResponse.json({ error: "Akses ditolak: User berada di luar wewenang Anda" }, { status: 403 });
      }
      if (['Admin', 'Super Admin'].includes(role)) {
        return NextResponse.json({ error: "Admin hanya dapat menetapkan role Member atau Moderator" }, { status: 403 });
      }
      desa = user.desa;
    }

    await db.query("UPDATE user_profiles SET role = $1, kelompok = $2, desa = $3 WHERE id = $4;", [
      role,
      ['Moderator', 'Admin', 'Member'].includes(role) ? kelompok : null,
      desa,
      id
    ]);

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

  if (!['Super Admin', 'Admin'].includes(user.role)) {
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

    if (user.role === 'Admin') {
      if (target.desa !== user.desa || ['Admin', 'Super Admin'].includes(target.role)) {
        return NextResponse.json({ error: "Akses ditolak: User berada di luar wewenang Anda" }, { status: 403 });
      }
    }

    await db.query("DELETE FROM user_profiles WHERE id = $1;", [id]);

    return NextResponse.json({ success: true, message: "User berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
