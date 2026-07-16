import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

// GET: Mendapatkan penugasan dapukan berdasarkan level dan wilayah
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level'); // 'Kelompok', 'Desa', 'Daerah'
    const desa_id = searchParams.get('desa_id');
    const kelompok_id = searchParams.get('kelompok_id');

    if (!level) {
      return NextResponse.json({ error: "Parameter level wajib diisi" }, { status: 400 });
    }

    let query = `
      SELECT da.*, j.nama_lengkap as nama_jamaah, j.kelompok as kelompok_jamaah, j.desa as desa_jamaah,
             dd.nama_dapukan, dd.tipe as tipe_dapukan
      FROM dapukan_assignment da
      JOIN jamaah j ON da.jamaah_id = j.id
      JOIN dapukan_def dd ON da.dapukan_def_id = dd.id
      WHERE da.level = $1
    `;
    const params = [level];
    let paramIdx = 2;

    if (level === 'Desa' && desa_id) {
      query += ` AND da.desa_id = $${paramIdx++}`;
      params.push(desa_id);
    } else if (level === 'Kelompok' && kelompok_id) {
      query += ` AND da.kelompok_id = $${paramIdx++}`;
      params.push(kelompok_id);
    }

    query += ` ORDER BY dd.tipe ASC, dd.nama_dapukan ASC, j.nama_lengkap ASC;`;

    const { rows } = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Gagal mengambil data penugasan dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Menugaskan jamaah ke dapukan
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Permission check
  if (!user.can_update_lokasi) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { jamaah_id, dapukan_def_id, level, desa_id, kelompok_id } = data;

    if (!jamaah_id || !dapukan_def_id || !level) {
      return NextResponse.json({ error: "Jamaah, Dapukan, dan Level wajib diisi" }, { status: 400 });
    }

    if (!['Kelompok', 'Desa', 'Daerah'].includes(level)) {
      return NextResponse.json({ error: "Level tidak valid" }, { status: 400 });
    }

    // Check if assignment already exists
    let checkQuery = `
      SELECT id FROM dapukan_assignment 
      WHERE jamaah_id = $1 AND dapukan_def_id = $2 AND level = $3
    `;
    const checkParams = [jamaah_id, dapukan_def_id, level];
    let checkParamIdx = 4;

    if (level === 'Desa') {
      checkQuery += ` AND desa_id = $${checkParamIdx++}`;
      checkParams.push(desa_id || null);
    } else if (level === 'Kelompok') {
      checkQuery += ` AND kelompok_id = $${checkParamIdx++}`;
      checkParams.push(kelompok_id || null);
    }

    const { rows: existing } = await db.query(checkQuery, checkParams);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Jamaah ini sudah memiliki dapukan tersebut di wilayah terpilih" }, { status: 400 });
    }

    // Fetch details for logging
    const { rows: jRows } = await db.query("SELECT nama_lengkap FROM jamaah WHERE id = $1;", [jamaah_id]);
    const { rows: dRows } = await db.query("SELECT nama_dapukan FROM dapukan_def WHERE id = $1;", [dapukan_def_id]);
    
    if (jRows.length === 0 || dRows.length === 0) {
      return NextResponse.json({ error: "Jamaah atau Dapukan tidak ditemukan" }, { status: 404 });
    }

    const jamaahName = jRows[0].nama_lengkap;
    const dapukanName = dRows[0].nama_dapukan;

    const assignmentId = crypto.randomUUID();
    await db.query(`
      INSERT INTO dapukan_assignment (id, jamaah_id, dapukan_def_id, level, desa_id, kelompok_id)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [assignmentId, jamaah_id, dapukan_def_id, level, desa_id || null, kelompok_id || null]);

    await logActivity(
      user.email, 'ADD', 'DAPUKAN_ASSIGNMENT', assignmentId, 
      `Menugaskan ${jamaahName} sebagai ${dapukanName} tingkat ${level}`
    );

    return NextResponse.json({ success: true, id: assignmentId, message: "Penugasan berhasil disimpan" });
  } catch (error) {
    console.error("Gagal menyimpan penugasan dapukan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
