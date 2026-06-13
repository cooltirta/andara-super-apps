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
      users_list = db.prepare("SELECT * FROM user_profiles ORDER BY email ASC;").all();
    } else if (user.role === 'Admin') {
      users_list = db.prepare("SELECT * FROM user_profiles WHERE desa = ? ORDER BY email ASC;").all(user.desa);
    } else { // Moderator
      users_list = db.prepare("SELECT * FROM user_profiles WHERE desa = ? AND kelompok = ? ORDER BY email ASC;").all(user.desa, user.kelompok);
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

    const existing = db.prepare("SELECT COUNT(*) as count FROM user_profiles WHERE email = ?;").get(email).count;
    if (existing > 0) {
      return NextResponse.json({ error: "User dengan email ini sudah terdaftar" }, { status: 400 });
    }

    const user_id = crypto.randomUUID();
    db.prepare("INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES (?, ?, ?, ?, ?);").run(
      user_id,
      email,
      role,
      ['Moderator', 'Admin', 'Member'].includes(role) ? kelompok : null,
      desa
    );

    return NextResponse.json({ success: true, id: user_id, message: "User berhasil ditambahkan" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
