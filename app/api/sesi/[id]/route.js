import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logActivity } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { rows } = await db.query("SELECT * FROM sesi WHERE id = $1 AND deleted_at IS NULL;", [id]);
    const session = rows[0];

    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("GET /api/sesi/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = emailCookie.value;

    const { id } = await params;

    // Check user permissions
    const { rows: userRows } = await db.query(
      "SELECT role, can_update_kehadiran FROM user_profiles WHERE email = $1;",
      [email]
    );
    const user = userRows[0];
    if (!user || (!user.can_update_kehadiran && user.role !== 'Admin')) {
      return NextResponse.json({ error: "Forbidden: No permission to update sessions" }, { status: 403 });
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
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    const { rowCount } = await db.query(`
      UPDATE sesi SET
        tanggal = $1,
        waktu_mulai = $2,
        waktu_selesai = $3,
        jenis_pengajian = $4,
        desas = $5,
        kelompoks = $6,
        genders = $7,
        marital_statuses = $8,
        kategoris = $9
      WHERE id = $10 AND deleted_at IS NULL;
    `, [
      tanggal, 
      waktu_mulai, 
      waktu_selesai, 
      jenis_pengajian, 
      desas, 
      kelompoks, 
      genders, 
      marital_statuses, 
      kategoris, 
      id
    ]);

    if (rowCount === 0) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    await logActivity(
      email, 
      'UPDATE', 
      'sesi', 
      id, 
      `Memperbarui sesi pengajian: ${jenis_pengajian} pada ${tanggal} (${waktu_mulai} - ${waktu_selesai})`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/sesi/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const email = emailCookie.value;

    const { id } = await params;

    // Check user permissions
    const { rows: userRows } = await db.query(
      "SELECT role, can_delete_kehadiran FROM user_profiles WHERE email = $1;",
      [email]
    );
    const user = userRows[0];
    if (!user || (!user.can_delete_kehadiran && user.role !== 'Admin')) {
      return NextResponse.json({ error: "Forbidden: No permission to delete sessions" }, { status: 403 });
    }

    // Get session info for logging
    const { rows: sessionRows } = await db.query("SELECT tanggal, jenis_pengajian FROM sesi WHERE id = $1 AND deleted_at IS NULL;", [id]);
    const session = sessionRows[0];
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    await db.query("UPDATE sesi SET deleted_at = NOW() WHERE id = $1;", [id]);

    await logActivity(
      email, 
      'DELETE', 
      'sesi', 
      id, 
      `Menghapus sesi pengajian: ${session.jenis_pengajian} pada ${session.tanggal}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sesi/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
