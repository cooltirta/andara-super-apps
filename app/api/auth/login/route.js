import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

export async function POST(request) {
  try {
    const data = await request.json();
    let email = data.email;
    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    email = email.trim().toLowerCase();
    let desa = data.desa || "Andara";
    let kelompok = data.kelompok || null;

    // Check if user exists
    let { rows } = await db.query("SELECT * FROM user_profiles WHERE email = $1;", [email]);
    let user = rows[0];

    if (!user) {
      const user_id = crypto.randomUUID();
      let role = "Member";

      if (email === "cooltirta@gmail.com") {
        role = "Super Admin";
        desa = "Andara";
        kelompok = null;
      }

      await db.query(
        "INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES ($1, $2, $3, $4, $5);",
        [user_id, email, role, kelompok, desa]
      );

      const { rows: newRows } = await db.query("SELECT * FROM user_profiles WHERE email = $1;", [email]);
      user = newRows[0];
    }

    const response = NextResponse.json(user);
    // Set cookie for 7 days
    response.cookies.set('user_email', user.email, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false, // Accessible by client-side JS state
      sameSite: 'lax',
    });

    await logActivity(user.email, 'LOGIN', 'AUTH', user.id, `Pengguna masuk (Role: ${user.role}, Desa: ${user.desa})`);

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
