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
      "SELECT * FROM sesi WHERE deleted_at IS NULL ORDER BY tanggal DESC, waktu_mulai DESC;"
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

    // Fetch all active jamaah
    const { rows: allJamaah } = await db.query(
      "SELECT id, desa, kelompok, jenis_kelamin, status_pernikahan, kategori FROM jamaah WHERE status_kehidupan = 'Hidup';"
    );

    // Fetch all present attendance records
    const { rows: presentRows } = await db.query(
      "SELECT jamaah_id, sesi_id, tanggal, waktu_presensi FROM kehadiran WHERE status = 'Hadir';"
    );

    const timeToMinutes = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Map sessions to include attendance stats
    const sessionsWithStats = filteredSessions.map(s => {
      const expectedJamaah = allJamaah.filter(j => {
        const matchesDesa = s.desas.includes(j.desa);
        const matchesKelompok = s.kelompoks.includes(j.kelompok);
        const matchesGender = s.genders.includes(j.jenis_kelamin);
        const matchesMarital = s.marital_statuses.includes(j.status_pernikahan);
        const matchesKategori = s.kategoris.includes(j.kategori);
        return matchesDesa && matchesKelompok && matchesGender && matchesMarital && matchesKategori;
      });

      const expectedIds = new Set(expectedJamaah.map(j => j.id));

      const startMin = timeToMinutes(s.waktu_mulai) - 30;
      const endMin = timeToMinutes(s.waktu_selesai);

      const presentCount = presentRows.filter(p => {
        if (!expectedIds.has(p.jamaah_id)) return false;
        if (p.sesi_id === s.id) return true;
        if (!p.sesi_id && p.tanggal === s.tanggal) {
          if (!p.waktu_presensi) return false;
          const timePart = p.waktu_presensi.split(' ')[1];
          if (!timePart) return false;
          const [h, m] = timePart.split(':').map(Number);
          const checkInMin = h * 60 + m;
          return checkInMin >= startMin && checkInMin <= endMin;
        }
        return false;
      }).length;

      const expectedCount = expectedJamaah.length;
      const attendancePercentage = expectedCount > 0 
        ? Math.round((presentCount / expectedCount) * 100) 
        : 0;

      return {
        ...s,
        totalExpected: expectedCount,
        totalPresent: presentCount,
        attendancePercentage
      };
    });

    return NextResponse.json(sessionsWithStats);
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
