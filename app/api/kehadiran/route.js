import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser, canModifyAttendance } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

// GET: Memuat daftar kehadiran jamaah untuk tanggal tertentu (termasuk standby row)
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
    // 1. Ambil daftar jamaah aktif sesuai wewenang
    let jamaahQuery = `
      SELECT id as jamaah_id, nama_lengkap, desa, kelompok, jenis_kelamin, kategori 
      FROM jamaah 
      WHERE status_kehidupan = 'Hidup'
    `;
    const jamaahParams = [];
    let paramIdx = 1;
    if (user.role === 'Admin') {
      jamaahQuery += ` AND desa = $${paramIdx++}`;
      jamaahParams.push(user.desa);
    } else if (user.role === 'Moderator') {
      jamaahQuery += ` AND desa = $${paramIdx++} AND kelompok = $${paramIdx++}`;
      jamaahParams.push(user.desa, user.kelompok);
    }
    jamaahQuery += ` ORDER BY desa ASC, kelompok ASC, j.nama_lengkap ASC;`;
    
    // Fix: alias 'j' might be missing in query above if we didn't alias, let's use 'nama_lengkap' directly:
    // "ORDER BY desa ASC, kelompok ASC, nama_lengkap ASC"
    jamaahQuery = jamaahQuery.replace('j.nama_lengkap ASC', 'nama_lengkap ASC');

    const { rows: jamaahs } = await db.query(jamaahQuery, jamaahParams);

    // 2. Ambil catatan kehadiran untuk tanggal tersebut
    const { rows: presences } = await db.query(`
      SELECT id as kehadiran_id, jamaah_id, status, waktu_presensi, recorded_by 
      FROM kehadiran 
      WHERE tanggal = $1;
    `, [date]);

    // Group catatan kehadiran berdasarkan jamaah_id
    const presenceMap = {};
    presences.forEach(p => {
      if (!presenceMap[p.jamaah_id]) {
        presenceMap[p.jamaah_id] = [];
      }
      presenceMap[p.jamaah_id].push(p);
    });

    // 3. Bangun daftar baris hasil (setiap jamaah = semua record terdaftar + 1 standby)
    const resultList = [];
    for (const j of jamaahs) {
      const jPresences = presenceMap[j.jamaah_id] || [];

      // A. Masukkan semua record kehadiran yang sudah ada
      for (const p of jPresences) {
        const mockPresence = {
          jamaah_id: j.jamaah_id,
          recorded_by: p.recorded_by
        };
        const canEdit = (await canModifyAttendance(mockPresence, user)) ? 1 : 0;
        resultList.push({
          ...j,
          kehadiran_id: p.kehadiran_id,
          status: p.status,
          waktu_presensi: p.waktu_presensi,
          recorded_by: p.recorded_by,
          can_edit: canEdit,
          row_key: p.kehadiran_id
        });
      }

      // B. Tambahkan 1 baris kosong standby (absen default, waktu kosong)
      const mockStandby = {
        jamaah_id: j.jamaah_id,
        recorded_by: user.email
      };
      const canEditStandby = (await canModifyAttendance(mockStandby, user)) ? 1 : 0;
      resultList.push({
        ...j,
        kehadiran_id: null,
        status: 'Tidak Hadir',
        waktu_presensi: null,
        recorded_by: null,
        can_edit: canEditStandby,
        row_key: `${j.jamaah_id}_standby`
      });
    }

    return NextResponse.json(resultList);
  } catch (error) {
    console.error("Gagal memuat data kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Menyimpan atau memperbarui status kehadiran jamaah (Mendukung Multi-Sesi)
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
            const { id, jamaah_id, status, waktu_presensi: itemWaktu } = item;
            if (!jamaah_id || !status) {
              throw new Error("jamaah_id dan status wajib diisi untuk setiap data kehadiran");
            }
            if (!['Hadir', 'Ijin', 'Tidak Hadir'].includes(status)) {
              throw new Error("Status kehadiran tidak valid");
            }

            if (id) {
              // Row exists in database
              const { rows: existingRows } = await db.query("SELECT * FROM kehadiran WHERE id = $1;", [id]);
              const existing = existingRows[0];

              if (existing) {
                if (!(await canModifyAttendance(existing, user))) {
                  const { rows: jamaahRows } = await db.query("SELECT nama_lengkap FROM jamaah WHERE id = $1;", [jamaah_id]);
                  const jamaah = jamaahRows[0];
                  const nameStr = jamaah ? jamaah.nama_lengkap : jamaah_id;
                  throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk mencatat kehadiran jamaah '${nameStr}'.`);
                }

                if (status === 'Tidak Hadir') {
                  // Delete existing record if reverted to absent
                  await db.query("DELETE FROM kehadiran WHERE id = $1;", [id]);
                } else {
                  let rowWaktu = itemWaktu || null;
                  if (status === 'Ijin') {
                    rowWaktu = null;
                  } else if (status === 'Hadir' && !rowWaktu) {
                    const now = new Date();
                    const pad = (n) => n.toString().padStart(2, '0');
                    rowWaktu = `${tanggal} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                  }
                  await db.query(`
                    UPDATE kehadiran 
                    SET status = $1, waktu_presensi = $2, recorded_by = $3
                    WHERE id = $4;
                  `, [status, rowWaktu, user.email, id]);
                }
              }
            } else {
              // New record (standby row filled)
              if (status !== 'Tidak Hadir') {
                const testPresence = {
                  jamaah_id: jamaah_id,
                  recorded_by: user.email
                };

                if (!(await canModifyAttendance(testPresence, user))) {
                  const { rows: jamaahRows } = await db.query("SELECT nama_lengkap FROM jamaah WHERE id = $1;", [jamaah_id]);
                  const jamaah = jamaahRows[0];
                  const nameStr = jamaah ? jamaah.nama_lengkap : jamaah_id;
                  throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk mencatat kehadiran jamaah '${nameStr}'.`);
                }

                let rowWaktu = itemWaktu || null;
                if (status === 'Ijin') {
                  rowWaktu = null;
                } else if (status === 'Hadir' && !rowWaktu) {
                  const now = new Date();
                  const pad = (n) => n.toString().padStart(2, '0');
                  rowWaktu = `${tanggal} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                }

                const newId = crypto.randomUUID();
                await db.query(`
                  INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
                  VALUES ($1, $2, $3, $4, $5, $6);
                `, [newId, jamaah_id, tanggal, rowWaktu, status, user.email]);
              }
            }
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
      const { id, jamaah_id, tanggal, status, waktu_presensi } = data;

      if (!jamaah_id || !tanggal || !status) {
        return NextResponse.json({ error: "jamaah_id, tanggal, dan status wajib diisi" }, { status: 400 });
      }

      if (!['Hadir', 'Ijin', 'Tidak Hadir'].includes(status)) {
        return NextResponse.json({ error: "Status kehadiran tidak valid" }, { status: 400 });
      }

      if (id) {
        const { rows: existingRows } = await db.query("SELECT * FROM kehadiran WHERE id = $1;", [id]);
        const existing = existingRows[0];
        if (existing) {
          if (!(await canModifyAttendance(existing, user))) {
            return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
          }
          if (status === 'Tidak Hadir') {
            await db.query("DELETE FROM kehadiran WHERE id = $1;", [id]);
          } else {
            let rowWaktu = waktu_presensi || null;
            if (status === 'Ijin') rowWaktu = null;
            await db.query(`
              UPDATE kehadiran SET status = $1, waktu_presensi = $2, recorded_by = $3 WHERE id = $4;
            `, [status, rowWaktu, user.email, id]);
          }
        }
      } else {
        if (status !== 'Tidak Hadir') {
          if (!(await canModifyAttendance({ jamaah_id, recorded_by: user.email }, user))) {
            return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
          }
          let rowWaktu = waktu_presensi || null;
          if (status === 'Ijin') rowWaktu = null;
          const newId = crypto.randomUUID();
          await db.query(`
            INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by)
            VALUES ($1, $2, $3, $4, $5, $6);
          `, [newId, jamaah_id, tanggal, rowWaktu, status, user.email]);
        }
      }

      return NextResponse.json({ success: true, message: "Kehadiran berhasil dicatat" });
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
