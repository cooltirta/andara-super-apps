import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

// Helper to map marital status
function mapStatusPernikahan(val) {
  if (!val) return 'Belum Menikah';
  const clean = val.toString().trim().toLowerCase();
  if (clean === 'menikah') return 'Menikah';
  if (clean === 'janda') return 'Janda';
  if (clean === 'duda') return 'Duda';
  if (clean === 'belum menikah' || clean === 'belum_menikah') return 'Belum Menikah';
  // Attempt substring match
  if (clean.includes('belum')) return 'Belum Menikah';
  if (clean.includes('nikah')) return 'Menikah';
  if (clean.includes('janda')) return 'Janda';
  if (clean.includes('duda')) return 'Duda';
  return 'Belum Menikah';
}

// Helper to map blood type
function mapGolonganDarah(val) {
  if (!val) return 'Tidak Diketahui';
  const clean = val.toString().trim().toUpperCase();
  if (['A', 'B', 'AB', 'O'].includes(clean)) return clean;
  if (clean.includes('TIDAK') || clean.includes('KOSONG')) return 'Tidak Diketahui';
  return 'Tidak Diketahui';
}

// Helper to map gender
function mapJenisKelamin(val) {
  if (!val) return 'Laki-laki';
  const clean = val.toString().trim().toLowerCase();
  if (clean === 'l' || clean.startsWith('laki')) return 'Laki-laki';
  if (clean === 'p' || clean.startsWith('perempuan') || clean.startsWith('wanita')) return 'Perempuan';
  return 'Laki-laki';
}

// Helper to map category
function mapKategori(val) {
  if (!val) return 'Dewasa';
  const clean = val.toString().trim().toLowerCase();
  const valid = ['balita', 'cbr/paud', 'pra remaja', 'remaja', 'pra nikah', 'dewasa', 'lansia'];
  
  if (clean.includes('balita')) return 'Balita';
  if (clean.includes('cbr') || clean.includes('paud')) return 'CBR/PAUD';
  if (clean.includes('pra remaja') || clean.includes('pra_remaja')) return 'Pra Remaja';
  if (clean.includes('remaja')) return 'Remaja';
  if (clean.includes('pra nikah') || clean.includes('pra_nikah') || clean.includes('pranikah')) return 'Pra Nikah';
  if (clean.includes('lansia') || clean.includes('tua')) return 'Lansia';
  if (clean.includes('dewasa')) return 'Dewasa';
  
  return 'Dewasa';
}

// Helper to map education
function mapPendidikan(val) {
  if (!val) return 'Tidak Sekolah';
  const clean = val.toString().trim().toUpperCase();
  if (['SD', 'SMP', 'SMA', 'S1', 'S2', 'S3'].includes(clean)) return clean;
  if (clean.includes('TIDAK') || clean.includes('BELUM')) return 'Tidak Sekolah';
  return 'Tidak Sekolah';
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_create_jamaah) {
    return NextResponse.json({ error: "Akses ditolak: Anda tidak memiliki wewenang menambah data jamaah" }, { status: 403 });
  }

  try {
    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Data baris import kosong" }, { status: 400 });
    }

    // Load unique past attendance dates to sync with imported users
    const { rows: datesRows } = await db.query("SELECT DISTINCT tanggal, recorded_by FROM kehadiran WHERE tanggal IS NOT NULL;");

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    const errors = [];

    // Begin database transaction for importing
    await db.query("BEGIN;");

    try {
      // Loop over rows and insert
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        let nama_lengkap = row.nama_lengkap || row['Nama Lengkap'] || row.nama || row['Nama'] || '';
        nama_lengkap = nama_lengkap.toString().trim();
        
        if (!nama_lengkap) {
          totalSkipped++;
          errors.push(`Baris ${i + 1}: Nama lengkap kosong, baris dilewati.`);
          continue;
        }

        totalProcessed++;

        // Get default values or fallbacks
        const rawGender = row.jenis_kelamin || row['Jenis Kelamin'] || row.gender || row['Gender'] || '';
        const jenis_kelamin = mapJenisKelamin(rawGender);

        const rawMarital = row.status_pernikahan || row['Status Pernikahan'] || '';
        const status_pernikahan = mapStatusPernikahan(rawMarital);

        const tempat_lahir = row.tempat_lahir || row['Tempat Lahir'] || null;
        const tanggal_lahir = row.tanggal_lahir || row['Tanggal Lahir'] || null;

        const rawLife = row.status_kehidupan || row['Status Kehidupan'] || 'Hidup';
        const status_kehidupan = rawLife.toString().trim().toLowerCase().startsWith('meninggal') ? 'Meninggal' : 'Hidup';

        const rawBlood = row.golongan_darah || row['Golongan Darah'] || row['Gol. Darah'] || '';
        const golongan_darah = mapGolonganDarah(rawBlood);

        const rawKategori = row.kategori || row['Kategori'] || '';
        const kategori = mapKategori(rawKategori);

        const rawEducation = row.pendidikan_terakhir || row['Pendidikan Terakhir'] || '';
        const pendidikan_terakhir = mapPendidikan(rawEducation);

        const tanggal_lulus = row.tanggal_lulus_pendidikan_terakhir || row['Tanggal Lulus'] || null;

        const rawRfid = row.rfid || row['RFID'] || row.card_id || '';
        const rfid = rawRfid ? rawRfid.toString().trim() : null;

        // Resolve desa and kelompok
        let desa = row.desa || row['Desa'] || '';
        desa = desa.toString().trim();
        if (!desa) {
          desa = user.role === 'Super Admin' ? 'Andara' : user.desa;
        }

        let kelompok = row.kelompok || row['Kelompok'] || '';
        kelompok = kelompok.toString().trim();
        if (!kelompok) {
          kelompok = user.role === 'Moderator' ? user.kelompok : (user.role === 'Admin' ? 'Andara 1' : 'Andara 1');
        }

        // Validate monitored locations
        if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(desa))) {
          totalSkipped++;
          errors.push(`Baris ${i + 1} (${nama_lengkap}): Desa '${desa}' tidak dalam wilayah terpantau Anda.`);
          continue;
        }
        if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(kelompok))) {
          totalSkipped++;
          errors.push(`Baris ${i + 1} (${nama_lengkap}): Kelompok '${kelompok}' tidak dalam wilayah terpantau Anda.`);
          continue;
        }

        // Check if name is already duplicate in database
        const { rows: existRows } = await db.query(
          "SELECT id FROM jamaah WHERE LOWER(TRIM(nama_lengkap)) = LOWER($1) AND desa = $2 AND kelompok = $3;",
          [nama_lengkap, desa, kelompok]
        );
        if (existRows.length > 0) {
          totalSkipped++;
          errors.push(`Baris ${i + 1}: Jamaah "${nama_lengkap}" sudah terdaftar di kelompok ${kelompok}, desa ${desa}.`);
          continue;
        }

        // Check if RFID is already duplicate in database
        if (rfid) {
          const { rows: existRfidRows } = await db.query(
            "SELECT nama_lengkap, kelompok FROM jamaah WHERE rfid = $1;",
            [rfid]
          );
          if (existRfidRows.length > 0) {
            const ext = existRfidRows[0];
            totalSkipped++;
            errors.push(`Baris ${i + 1}: RFID "${rfid}" untuk "${nama_lengkap}" sudah digunakan oleh "${ext.nama_lengkap}" (${ext.kelompok}).`);
            continue;
          }
        }

        const jamaah_id = crypto.randomUUID();

        // 1. Insert Jamaah
        await db.query(`
          INSERT INTO jamaah (
            id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, 
            golongan_darah, kelompok, pendidikan_terakhir, 
            tanggal_lulus_pendidikan_terakhir, desa, kategori, tanggal_lahir, 
            status_pernikahan, rfid
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
        `, [
          jamaah_id, nama_lengkap, jenis_kelamin, tempat_lahir || null, status_kehidupan,
          golongan_darah, kelompok, pendidikan_terakhir, 
          pendidikan_terakhir === 'Tidak Sekolah' ? null : (tanggal_lulus || null),
          desa, kategori, tanggal_lahir || null, status_pernikahan, rfid
        ]);

        // 2. Sync presence records for past dates
        for (const d of datesRows) {
          await db.query(
            "INSERT INTO kehadiran (id, jamaah_id, tanggal, status, recorded_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING;",
            [crypto.randomUUID(), jamaah_id, d.tanggal, "Tidak Hadir", d.recorded_by]
          );
        }

        totalInserted++;
      }

      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    if (totalInserted > 0) {
      await logActivity(user.email, 'IMPORT', 'JAMAAH', 'BULK', `Mengimpor ${totalInserted} jamaah via Bulk CSV`);
    }

    return NextResponse.json({
      success: true,
      message: `Impor massal selesai. Berhasil: ${totalInserted}, Dilewati: ${totalSkipped}.`,
      processed: totalProcessed,
      inserted: totalInserted,
      skipped: totalSkipped,
      errors: errors
    });
  } catch (error) {
    console.error("Gagal melakukan impor CSV:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
