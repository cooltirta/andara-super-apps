import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

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
    let user = db.prepare("SELECT * FROM user_profiles WHERE email = ?;").get(email);

    if (!user) {
      const user_id = crypto.randomUUID();
      let role = "Member";

      if (email === "cooltirta@gmail.com") {
        role = "Super Admin";
        desa = "Andara";
        kelompok = null;
      }

      db.prepare(
        "INSERT INTO user_profiles (id, email, role, kelompok, desa) VALUES (?, ?, ?, ?, ?);"
      ).run(user_id, email, role, kelompok, desa);

      user = db.prepare("SELECT * FROM user_profiles WHERE email = ?;").get(email);
    } else {
      // If user exists, check if we need to update kelompok/desa for simulation purposes (except Super Admin)
      if (email !== "cooltirta@gmail.com" && (kelompok !== undefined || desa !== user.desa)) {
        db.prepare(
          "UPDATE user_profiles SET kelompok = ?, desa = ? WHERE email = ?;"
        ).run(kelompok, desa, email);
        user = db.prepare("SELECT * FROM user_profiles WHERE email = ?;").get(email);
      }
    }

    const response = NextResponse.json(user);
    // Set cookie for 7 days
    response.cookies.set('user_email', user.email, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false, // Accessible by client-side JS state
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
