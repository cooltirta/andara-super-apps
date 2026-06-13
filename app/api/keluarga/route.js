import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    let keluarga_list = [];
    if (user.role === 'Super Admin') {
      keluarga_list = db.prepare("SELECT * FROM keluarga ORDER BY nama_keluarga ASC;").all();
    } else if (user.role === 'Admin') {
      keluarga_list = db.prepare(`
        SELECT DISTINCT k.* 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.desa = ?
        ORDER BY k.nama_keluarga ASC;
      `).all(user.desa);
    } else { // Moderator
      keluarga_list = db.prepare(`
        SELECT DISTINCT k.* 
        FROM keluarga k 
        JOIN anggota_keluarga ak ON k.id = ak.keluarga_id 
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE j.kelompok = ? AND j.desa = ?
        ORDER BY k.nama_keluarga ASC;
      `).all(user.kelompok, user.desa);
    }

    for (const fam of keluarga_list) {
      fam.anggota = db.prepare(`
        SELECT ak.id as anggota_id, ak.jenis_anggota, j.id as jamaah_id, j.nama_lengkap, j.kelompok, j.status_kehidupan, j.desa
        FROM anggota_keluarga ak
        JOIN jamaah j ON ak.jamaah_id = j.id
        WHERE ak.keluarga_id = ?;
      `).all(fam.id);
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

    const jamaah = db.prepare("SELECT * FROM jamaah WHERE id = ?;").get(kepala_keluarga_id);
    if (!jamaah) {
      return NextResponse.json({ error: "Jamaah tidak ditemukan" }, { status: 404 });
    }

    if (user.role === 'Moderator' && (jamaah.kelompok !== user.kelompok || jamaah.desa !== user.desa)) {
      return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga harus berada di kelompok Anda" }, { status: 403 });
    } else if (user.role === 'Admin' && jamaah.desa !== user.desa) {
      return NextResponse.json({ error: "Akses ditolak: Kepala Keluarga harus berada di desa Anda" }, { status: 403 });
    }

    const existing = db.prepare("SELECT keluarga_id FROM anggota_keluarga WHERE jamaah_id = ?;").get(kepala_keluarga_id);
    if (existing) {
      return NextResponse.json({ error: "Jamaah ini sudah terdaftar sebagai anggota di keluarga lain" }, { status: 400 });
    }

    const keluarga_id = crypto.randomUUID();
    const nama_keluarga = `Keluarga ${jamaah.nama_lengkap}`;
    const anggota_id = crypto.randomUUID();

    const createTx = db.transaction(() => {
      db.prepare("INSERT INTO keluarga (id, nama_keluarga) VALUES (?, ?);").run(keluarga_id, nama_keluarga);
      db.prepare(`
        INSERT INTO anggota_keluarga (id, keluarga_id, jamaah_id, jenis_anggota) 
        VALUES (?, ?, ?, 'Kepala Keluarga');
      `).run(anggota_id, keluarga_id, kepala_keluarga_id);
    });

    createTx();

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
