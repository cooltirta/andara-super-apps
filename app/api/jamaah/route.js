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
    await logActivity(user.email, 'VISIT', 'PAGE', 'DATABASE_JAMAAH', 'Mengakses halaman Database Jamaah');
    let jamaah_list = [];
    const baseQuery = `
      SELECT j.*, ak.jenis_anggota, ak.keluarga_id, k.nama_keluarga
      FROM jamaah j
      LEFT JOIN anggota_keluarga ak ON j.id = ak.jamaah_id
      LEFT JOIN keluarga k ON ak.keluarga_id = k.id
    `;

    if (user.role === 'Super Admin') {
      const { rows } = await db.query(`${baseQuery} ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;`);
      jamaah_list = rows;
    } else if (user.role === 'Admin') {
      const { rows } = await db.query(`${baseQuery} WHERE j.desa = $1 ORDER BY j.kelompok ASC, j.nama_lengkap ASC;`, [user.desa]);
      jamaah_list = rows;
    } else { // Moderator / Member
      const { rows } = await db.query(`${baseQuery} WHERE j.kelompok = $1 AND j.desa = $2 ORDER BY j.nama_lengkap ASC;`, [user.kelompok, user.desa]);
      jamaah_list = rows;
    }

    return NextResponse.json(jamaah_list);
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
    let nama_lengkap = data.nama_lengkap;
    let jenis_kelamin = data.jenis_kelamin;
    let tempat_lahir = data.tempat_lahir;
    let status_kehidupan = data.status_kehidupan || "Hidup";
    let golongan_darah = data.golongan_darah;
    let kelompok = data.kelompok;
    let pendidikan_terakhir = data.pendidikan_terakhir;
    let tanggal_lulus = data.tanggal_lulus_pendidikan_terakhir || null;
    let desa = data.desa || "Andara";
    let kategori = data.kategori || "Dewasa";

    if (user.role === 'Moderator') {
      kelompok = user.kelompok;
      desa = user.desa;
    } else if (user.role === 'Admin') {
      desa = user.desa;
    }

    if (!nama_lengkap || !jenis_kelamin || !tempat_lahir || !golongan_darah || !kelompok || !pendidikan_terakhir) {
      return NextResponse.json({ error: "Semua data wajib diisi kecuali tanggal lulus" }, { status: 400 });
    }

    if (!['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'].includes(kategori)) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }

    if (pendidikan_terakhir !== "Tidak Sekolah" && !tanggal_lulus) {
      return NextResponse.json({ error: "Tanggal lulus wajib diisi jika memiliki riwayat sekolah" }, { status: 400 });
    }

    if (pendidikan_terakhir === "Tidak Sekolah") {
      tanggal_lulus = null;
    }

    const jamaah_id = crypto.randomUUID();

    // Use PostgreSQL transaction for inserting jamaah and syncing presence records
    await db.query("BEGIN;");
    try {
      // 1. Insert Jamaah
      await db.query(`
        INSERT INTO jamaah (id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus_pendidikan_terakhir, desa, kategori)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [jamaah_id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa, kategori]);

      // 2. Fetch distinct dates from kehadiran to sync this new jamaah with past dates
      const { rows: datesRows } = await db.query("SELECT DISTINCT tanggal, recorded_by FROM kehadiran WHERE tanggal IS NOT NULL;");

      // 3. Insert 'Tidak Hadir' presence record for each unique past date
      for (const d of datesRows) {
        await db.query(
          "INSERT INTO kehadiran (id, jamaah_id, tanggal, status, recorded_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;",
          [crypto.randomUUID(), jamaah_id, d.tanggal, "Tidak Hadir", d.recorded_by]
        );
      }

      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    await logActivity(user.email, 'ADD', 'JAMAAH', jamaah_id, `Menambahkan jamaah: ${nama_lengkap} (${kelompok}, ${desa})`);

    return NextResponse.json({
      success: true,
      id: jamaah_id,
      message: "Data jamaah berhasil ditambahkan & disinkronisasikan ke sesi presensi aktif."
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
