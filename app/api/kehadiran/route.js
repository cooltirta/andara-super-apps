import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser, canModifyAttendance } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

// GET: Memuat daftar kehadiran jamaah untuk tanggal tertentu
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: "Parameter tanggal (date) wajib diisi" }, { status: 400 });
  }

  try {
    let jamaah_list = [];
    const baseQuery = `
      SELECT 
        j.id as jamaah_id, 
        j.nama_lengkap, 
        j.desa, 
        j.kelompok, 
        j.jenis_kelamin,
        j.kategori,
        k.id as kehadiran_id, 
        COALESCE(k.status, 'Tidak Hadir') as status, 
        k.waktu_presensi, 
        k.recorded_by
      FROM jamaah j
      LEFT JOIN kehadiran k ON j.id = k.jamaah_id AND k.tanggal = $1
      WHERE j.status_kehidupan = 'Hidup'
    `;

    if (user.role === 'Super Admin') {
      const { rows } = await db.query(`${baseQuery} ORDER BY j.desa ASC, j.kelompok ASC, j.nama_lengkap ASC;`, [date]);
      jamaah_list = rows;
    } else if (user.role === 'Admin') {
      const { rows } = await db.query(`${baseQuery} AND j.desa = $2 ORDER BY j.kelompok ASC, j.nama_lengkap ASC;`, [date, user.desa]);
      jamaah_list = rows;
    } else { // Moderator
      const { rows } = await db.query(`${baseQuery} AND j.desa = $2 AND j.kelompok = $3 ORDER BY j.nama_lengkap ASC;`, [date, user.desa, user.kelompok]);
      jamaah_list = rows;
    }

    // Hitung hak modifikasi (can_edit) untuk tiap baris secara dinamis
    for (const j of jamaah_list) {
      const mockPresence = {
        jamaah_id: j.jamaah_id,
        recorded_by: j.recorded_by
      };
      j.can_edit = (await canModifyAttendance(mockPresence, user)) ? 1 : 0;
    }

    return NextResponse.json(jamaah_list);
  } catch (error) {
    console.error("Gagal memuat data kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Menyimpan atau memperbarui status kehadiran jamaah (Direct & Scan QR)
export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const data = await request.json();

    // Check if bulk update
    if (data.kehadiran && Array.isArray(data.kehadiran)) {
      const { tanggal, waktu_presensi, kehadiran } = data;
      if (!tanggal) {
        return NextResponse.json({ error: "tanggal wajib diisi" }, { status: 400 });
      }

      try {
        await db.query("BEGIN;");
        try {
          for (const item of kehadiran) {
            const { jamaah_id, status } = item;
            if (!jamaah_id || !status) {
              throw new Error("jamaah_id dan status wajib diisi untuk setiap data kehadiran");
            }
            if (!['Hadir', 'Ijin', 'Tidak Hadir'].includes(status)) {
              throw new Error("Status kehadiran tidak valid");
            }

            const { rows: existingRows } = await db.query("SELECT * FROM kehadiran WHERE jamaah_id = $1 AND tanggal = $2;", [jamaah_id, tanggal]);
            const existing = existingRows[0];

            // Skip if status is unchanged
            if (existing && existing.status === status) {
              continue;
            }
            // Skip if no existing record and status is 'Tidak Hadir' (default)
            if (!existing && status === 'Tidak Hadir') {
              continue;
            }

            const testPresence = existing || {
              jamaah_id: jamaah_id,
              recorded_by: user.email
            };

            if (!(await canModifyAttendance(testPresence, user))) {
              const { rows: jamaahRows } = await db.query("SELECT nama_lengkap FROM jamaah WHERE id = $1;", [jamaah_id]);
              const jamaah = jamaahRows[0];
              const nameStr = jamaah ? jamaah.nama_lengkap : jamaah_id;
              throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk mencatat kehadiran jamaah '${nameStr}'.`);
            }

            const presenceId = existing ? existing.id : crypto.randomUUID();

            let rowWaktu = waktu_presensi;
            // Only set waktu_presensi for positive attendance (Hadir / Ijin)
            if (status === 'Tidak Hadir') {
              rowWaktu = null;
            } else if (!rowWaktu) {
              const todayStr = new Date().toISOString().split('T')[0];
              if (tanggal === todayStr) {
                const now = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                rowWaktu = `${tanggal} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
              }
            }

            await db.query(`
              INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT(jamaah_id, tanggal) DO UPDATE SET
                status = excluded.status,
                waktu_presensi = excluded.waktu_presensi,
                recorded_by = excluded.recorded_by;
            `, [presenceId, jamaah_id, tanggal, rowWaktu, status, user.email]);
          }
          await db.query("COMMIT;");
        } catch (txError) {
          await db.query("ROLLBACK;");
          throw txError;
        }

        await logActivity(user.email, 'SAVE_ATTENDANCE', 'KEHADIRAN', tanggal, `Menyimpan rekap kehadiran tanggal ${tanggal} (Jumlah data: ${kehadiran.length})`);

        return NextResponse.json({
          success: true,
          message: "Kehadiran berhasil disimpan"
        });
      } catch (txError) {
        return NextResponse.json({ error: txError.message }, { status: 400 });
      }
    } else {
      // Single update (for backwards compatibility if any)
      const { jamaah_id, tanggal, status, waktu_presensi } = data;

      if (!jamaah_id || !tanggal || !status) {
        return NextResponse.json({ error: "jamaah_id, tanggal, dan status wajib diisi" }, { status: 400 });
      }

      if (!['Hadir', 'Ijin', 'Tidak Hadir'].includes(status)) {
        return NextResponse.json({ error: "Status kehadiran tidak valid" }, { status: 400 });
      }

      const { rows: existingRows } = await db.query("SELECT * FROM kehadiran WHERE jamaah_id = $1 AND tanggal = $2;", [jamaah_id, tanggal]);
      const existing = existingRows[0];

      const testPresence = existing || {
        jamaah_id: jamaah_id,
        recorded_by: user.email
      };

      if (!(await canModifyAttendance(testPresence, user))) {
        return NextResponse.json({ error: "Akses ditolak: Anda tidak memiliki wewenang untuk mencatat kehadiran jamaah ini." }, { status: 403 });
      }

      const presenceId = existing ? existing.id : crypto.randomUUID();

      let rowWaktu = waktu_presensi;
      if (status === 'Tidak Hadir') {
        rowWaktu = null;
      }

      await db.query(`
        INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(jamaah_id, tanggal) DO UPDATE SET
          status = excluded.status,
          waktu_presensi = excluded.waktu_presensi,
          recorded_by = excluded.recorded_by;
      `, [presenceId, jamaah_id, tanggal, rowWaktu || null, status, user.email]);

      await logActivity(user.email, 'SAVE_ATTENDANCE', 'KEHADIRAN', tanggal, `Mencatat kehadiran jamaah ID ${jamaah_id} tanggal ${tanggal} (Status: ${status})`);

      return NextResponse.json({ 
        success: true, 
        message: "Kehadiran berhasil dicatat",
        kehadiran_id: presenceId
      });
    }
  } catch (error) {
    console.error("Gagal mencatat kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Menghapus data kehadiran untuk tanggal tertentu sesuai cakupan wewenang
export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: "Parameter tanggal (date) wajib diisi" }, { status: 400 });
  }

  try {
    if (user.role === 'Super Admin') {
      await db.query("DELETE FROM kehadiran WHERE tanggal = $1;", [date]);
    } else if (user.role === 'Admin') {
      await db.query(`
        DELETE FROM kehadiran 
        WHERE tanggal = $1 AND jamaah_id IN (
          SELECT id FROM jamaah WHERE desa = $2
        );
      `, [date, user.desa]);
    } else { // Moderator
      await db.query(`
        DELETE FROM kehadiran 
        WHERE tanggal = $1 AND jamaah_id IN (
          SELECT id FROM jamaah WHERE desa = $2 AND kelompok = $3
        );
      `, [date, user.desa, user.kelompok]);
    }

    await logActivity(user.email, 'RESET_ATTENDANCE', 'KEHADIRAN', date, `Mereset/menghapus rekap kehadiran tanggal ${date}`);

    return NextResponse.json({ success: true, message: `Kehadiran pada tanggal ${date} berhasil dihapus` });
  } catch (error) {
    console.error("Gagal menghapus kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
