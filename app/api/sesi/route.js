import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = emailCookie.value;

    // Fetch user profile to check scopes
    const { rows: userRows } = await db.query(
      "SELECT role, desa, kelompok, monitor_all_desas, desas_pantau, monitor_all_kelompoks, kelompoks_pantau FROM user_profiles WHERE email = $1;",
      [email]
    );
    const user = userRows[0];
    if (!user) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Fetch all sessions
    const { rows: sessions } = await db.query(
      "SELECT * FROM sesi ORDER BY tanggal DESC, waktu_mulai DESC;"
    );

    // Filter sessions based on authorization scope
    let filteredSessions = sessions;
    if (user.role !== 'Admin' && !user.monitor_all_desas) {
      const allowedDesas = new Set([user.desa, ...(user.desas_pantau || [])]);
      const allowedKelompoks = new Set([user.kelompok, ...(user.kelompoks_pantau || [])]);

      filteredSessions = sessions.filter(s => {
        const matchesDesa = s.desas.some(d => allowedDesas.has(d));
        const matchesKelompok = s.kelompoks.some(k => allowedKelompoks.has(k));
        return matchesDesa || matchesKelompok;
      });
    }

    return NextResponse.json(filteredSessions);
  } catch (error) {
    console.error("GET /api/sesi error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = emailCookie.value;

    // Check user permissions
    const { rows: userRows } = await db.query(
      "SELECT role, can_create_kehadiran FROM user_profiles WHERE email = $1;",
      [email]
    );
    const user = userRows[0];
    if (!user || (!user.can_create_kehadiran && user.role !== 'Admin')) {
      return NextResponse.json({ error: "Forbidden: No permission to create sessions" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      tanggal, 
      waktu_mulai, 
      waktu_selesai, 
      jenis_pengajian, 
      desas, 
      kelompoks, 
      genders, 
      marital_statuses, 
      kategoris 
    } = body;

    // Validate fields
    if (!tanggal || !waktu_mulai || !waktu_selesai || !jenis_pengajian || 
        !desas || !Array.isArray(desas) || desas.length === 0 ||
        !kelompoks || !Array.isArray(kelompoks) || kelompoks.length === 0 ||
        !genders || !Array.isArray(genders) || genders.length === 0 ||
        !marital_statuses || !Array.isArray(marital_statuses) || marital_statuses.length === 0 ||
        !kategoris || !Array.isArray(kategoris) || kategoris.length === 0) {
      return NextResponse.json({ error: "Semua field wajib diisi dan memiliki minimal 1 pilihan" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await db.query(`
      INSERT INTO sesi (
        id, tanggal, waktu_mulai, waktu_selesai, jenis_pengajian, 
        desas, kelompoks, genders, marital_statuses, kategoris, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `, [
      id, 
      tanggal, 
      waktu_mulai, 
      waktu_selesai, 
      jenis_pengajian, 
      desas, 
      kelompoks, 
      genders, 
      marital_statuses, 
      kategoris, 
      email
    ]);

    await logActivity(
      email, 
      'CREATE', 
      'sesi', 
      id, 
      `Membuat sesi pengajian baru: ${jenis_pengajian} pada ${tanggal} (${waktu_mulai} - ${waktu_selesai})`
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("POST /api/sesi error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
