import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_read_jamaah) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    await logActivity(user.email, 'VISIT', 'PAGE', 'DATABASE_JAMAAH', 'Mengakses halaman Database Jamaah');
    
    const { searchParams } = new URL(request.url);
    const includePhoto = searchParams.get('include_photo') === 'true';
    const singleOnly = searchParams.get('single_only') === 'true';

    let selectClause = `
      j.id, j.nama_lengkap, j.jenis_kelamin, j.tempat_lahir, j.status_kehidupan, 
      j.golongan_darah, j.kelompok, j.pendidikan_terakhir, j.tanggal_lulus_pendidikan_terakhir, 
      j.desa, j.kategori, j.tanggal_lahir, j.status_pernikahan, j.rfid, 
      j.status_haji, j.tanggal_keberangkatan_haji, j.suku, j.preferensi_pasangan
    `;
    
    if (includePhoto) {
      selectClause += `, j.foto_url`;
    } else {
      selectClause += `, NULL as foto_url`;
    }

    let baseQuery = `
      SELECT ${selectClause}, ak.jenis_anggota, ak.keluarga_id, k.nama_keluarga
      FROM jamaah j
      LEFT JOIN anggota_keluarga ak ON j.id = ak.jamaah_id
      LEFT JOIN keluarga k ON ak.keluarga_id = k.id
    `;
    
    const params = [];
    let paramIdx = 1;
    const whereClauses = [];

    if (singleOnly) {
      whereClauses.push(`j.status_pernikahan IN ('Belum Menikah', 'Janda', 'Duda')`);
      whereClauses.push(`j.status_kehidupan = 'Hidup'`);
    }

    if (!user.monitor_all_desas) {
      whereClauses.push(`j.desa = ANY($${paramIdx++}::text[])`);
      params.push(user.desas_pantau || []);
    }
    if (!user.monitor_all_kelompoks) {
      whereClauses.push(`j.kelompok = ANY($${paramIdx++}::text[])`);
      params.push(user.kelompoks_pantau || []);
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    baseQuery += ` ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;`;

    const { rows } = await db.query(baseQuery, params);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_create_jamaah) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    let nama_lengkap = data.nama_lengkap;
    let jenis_kelamin = data.jenis_kelamin;
    let tempat_lahir = data.tempat_lahir || null;
    let status_kehidupan = data.status_kehidupan || "Hidup";
    let golongan_darah = data.golongan_darah || "Tidak Diketahui";
    let kelompok = data.kelompok;
    let pendidikan_terakhir = data.pendidikan_terakhir;
    let tanggal_lulus = data.tanggal_lulus_pendidikan_terakhir || null;
    let desa = data.desa || "Andara";
    let kategori = data.kategori || "Dewasa";
    let tanggal_lahir = data.tanggal_lahir || null;
    let status_pernikahan = data.status_pernikahan || "Belum Menikah";
    let rfid = data.rfid ? data.rfid.trim() : null;

    // Validate monitored locations
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(desa))) {
      return NextResponse.json({ error: `Akses ditolak: Desa '${desa}' tidak dalam wilayah terpantau Anda` }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(kelompok))) {
      return NextResponse.json({ error: `Akses ditolak: Kelompok '${kelompok}' tidak dalam wilayah terpantau Anda` }, { status: 403 });
    }

    if (!nama_lengkap || !jenis_kelamin || !golongan_darah || !kelompok || !pendidikan_terakhir) {
      return NextResponse.json({ error: "Nama lengkap, jenis kelamin, golongan darah, kelompok, dan pendidikan terakhir wajib diisi" }, { status: 400 });
    }

    if (!['Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'].includes(kategori)) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }

    if (rfid) {
      const { rows: existRfid } = await db.query("SELECT id, nama_lengkap FROM jamaah WHERE rfid = $1;", [rfid]);
      if (existRfid.length > 0) {
        return NextResponse.json({ error: `Kartu RFID sudah terdaftar pada jamaah '${existRfid[0].nama_lengkap}'.` }, { status: 400 });
      }
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
        INSERT INTO jamaah (id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus_pendidikan_terakhir, desa, kategori, tanggal_lahir, status_pernikahan, rfid)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
      `, [jamaah_id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, tanggal_lulus, desa, kategori, tanggal_lahir, status_pernikahan, rfid]);

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
