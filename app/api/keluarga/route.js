import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    let keluarga_list = [];
    if (user.role === 'Super Admin') {
      const { rows } = await db.query("SELECT * FROM keluarga ORDER BY nama_keluarga ASC;");
      keluarga_list = rows;
    } else if (user.role === 'Admin') {
      const { rows } = await db.query(`
        SELECT DISTINCT k.* 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.desa = $1
        ORDER BY k.nama_keluarga ASC;
      `, [user.desa]);
      keluarga_list = rows;
    } else { // Moderator
      const { rows } = await db.query(`
        SELECT DISTINCT k.* 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.kelompok = $1 AND j.desa = $2
        ORDER BY k.nama_keluarga ASC;
      `, [user.kelompok, user.desa]);
      keluarga_list = rows;
    }

    for (const fam of keluarga_list) {
      const { rows: memberRows } = await db.query(`
        SELECT ak.id as anggota_id, ak.jenis_anggota, j.id as jamaah_id, j.nama_lengkap, j.kelompok, j.status_kehidupan, j.desa
        FROM anggota_keluarga ak
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE ak.keluarga_id = $1;
      `, [fam.id]);
      fam.anggota = memberRows;
    }

    return NextResponse.json(keluarga_list);
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
    const kepala_keluarga_id = data.kepala_keluarga_id;

    if (!kepala_keluarga_id) {
      return NextResponse.json({ error: "Harus memilih jamaah sebagai Kepala Keluarga" }, { status: 400 });
    }

    const { rows: jamaahRows } = await db.query("SELECT * FROM jamaah WHERE id = $1;", [kepala_keluarga_id]);
    const jamaah = jamaahRows[0];
    if (!jamaah) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (jamaah.kelompok !== user.kelompok || jamaah.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga harus berada di kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && jamaah.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga harus berada di desa Anda" }, { status: 403 });
    }

    const { rows: existingRows } = await db.query("SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = $1;", [kepala_keluarga_id]);
    const existing = existingRows[0];
    if (existing) {
      return NextResponse.json({ error: "Jamaah ini sudah terdaftar sebagai anggota di keluarga lain" }, { status: 400 });
    }

    const keluarga_id = crypto.randomUUID();
    const nama_keluarga = `Keluarga ${jamaah.nama_lengkap}`;
    const anggota_id = crypto.randomUUID();

    await db.query("BEGIN;");
    try {
      await db.query("INSERT INTO keluarga (id, nama_keluarga) VALUES ($1, $2);", [keluarga_id, nama_keluarga]);
      await db.query(`
        INSERT INTO anggota_keluarga (id, keluarga_id, jamaah_id, jenis_anggota) 
        VALUES ($1, $2, $3, 'Kepala Keluarga');
      `, [anggota_id, keluarga_id, kepala_keluarga_id]);
      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    await logActivity(user.email, 'ADD', 'KELUARGA', keluarga_id, `Membuat keluarga baru: ${nama_keluarga} (Kepala Keluarga: ${jamaah.nama_lengkap})`);

    return NextResponse.json({
      success: true,
      id: keluarga_id,
      nama_keluarga,
      message: "Keluarga baru berhasil dibuat"
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
