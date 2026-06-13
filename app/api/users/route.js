import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    let users_list = [];
    if (user.role === 'Super Admin') {
      const { rows } = await db.query("SELECT * FROM user_profiles ORDER BY email ASC;");
      users_list = rows;
    } else if (user.role === 'Admin') {
      const { rows } = await db.query("SELECT * FROM user_profiles WHERE desa = $1 ORDER BY email ASC;", [user.desa]);
      users_list = rows;
    } else { // Moderator
      const { rows } = await db.query("SELECT * FROM user_profiles WHERE desa = $1 AND kelompok = $2 ORDER BY email ASC;", [user.desa, user.kelompok]);
      users_list = rows;
    }

    return NextResponse.json(users_list);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    let email = data.email;
    let role = data.role || "Member";
    let kelompok = data.kelompok;
    let desa = data.desa || "Andara";

    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    email = email.trim().toLowerCase();

    if (user.role === 'Moderator') {
      role = "Member";
      kelompok = user.kelompok;
      desa = user.desa;
    } else if (user.role === 'Admin') {
      desa = user.desa;
      if (['Admin', 'Super Admin'].includes(role)) {
        return NextResponse.json({ error: "Admin tidak diperbolehkan membuat user Admin atau Super Admin" }, { status: 403 });
      }
    }

    const { rows: existingRows } = await db.query("SELECT COUNT(*) as count FROM user_profiles WHERE email = $1;", [email]);
    const existing = parseInt(existingRows[0].count, 10);
    if (existing > 0) {
      return NextResponse.json({ error: "User dengan email ini sudah terdaftar" }, { status: 400 });
    }

    const user_id = crypto.randomUUID();
    await db.query("INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES ($1, $2, $3, $4, $5);", [
      user_id,
      email,
      role,
      ['Moderator', 'Admin', 'Member'].includes(role) ? kelompok : null,
      desa
    ]);

    return NextResponse.json({ success: true, id: user_id, message: "User berhasil ditambahkan" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
