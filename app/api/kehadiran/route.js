import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser, canModifyAttendance } from '@/lib/auth';
import crypto from 'crypto';
import { logActivity } from '@/lib/activity';

// GET: Memuat daftar kehadiran jamaah untuk tanggal tertentu atau sesi pengajian tertentu
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_read_kehadiran) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sesiId = searchParams.get('sesi_id');
  const date = searchParams.get('date');

  if (!sesiId && !date) {
    return NextResponse.json({ error: "Parameter sesi_id atau date wajib diisi" }, { status: 400 });
  }

  try {
    let jamaahs = [];
    let querySession = null;

    if (sesiId) {
      // 1. Ambil detail sesi untuk mencocokkan filter
      const { rows: sessionRows } = await db.query("SELECT * FROM sesi WHERE id = $1;", [sesiId]);
      querySession = sessionRows[0];
      if (!querySession) {
        return NextResponse.json({ error: "Sesi pengajian tidak ditemukan" }, { status: 404 });
      }

      // 2. Ambil daftar jamaah aktif yang memenuhi filter dari sesi tersebut
      let jamaahQuery = `
        SELECT id as jamaah_id, nama_lengkap, desa, kelompok, jenis_kelamin, kategori, status_pernikahan 
        FROM jamaah 
        WHERE status_kehidupan = 'Hidup'
          AND desa = ANY($1::text[])
          AND kelompok = ANY($2::text[])
          AND jenis_kelamin = ANY($3::text[])
          AND status_pernikahan = ANY($4::text[])
          AND kategori = ANY($5::text[])
      `;
      const jamaahParams = [
        querySession.desas, 
        querySession.kelompoks, 
        querySession.genders, 
        querySession.marital_statuses, 
        querySession.kategoris
      ];
      let paramIdx = 6;

      // Filter tambahan berdasarkan cakupan pengawas
      if (!user.monitor_all_desas) {
        jamaahQuery += ` AND desa = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.desas_pantau || []);
      }
      if (!user.monitor_all_kelompoks) {
        jamaahQuery += ` AND kelompok = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.kelompoks_pantau || []);
      }
      jamaahQuery += ` ORDER BY desa ASC, kelompok ASC, nama_lengkap ASC;`;

      const { rows } = await db.query(jamaahQuery, jamaahParams);
      jamaahs = rows;
    } else {
      // Fallback: load all jamaah based on user scope (legacy date mode)
      let jamaahQuery = `
        SELECT id as jamaah_id, nama_lengkap, desa, kelompok, jenis_kelamin, kategori, status_pernikahan 
        FROM jamaah 
        WHERE status_kehidupan = 'Hidup'
      `;
      const jamaahParams = [];
      let paramIdx = 1;
      
      if (user.monitor_all_desas && user.monitor_all_kelompoks) {
        // No filter
      } else if (!user.monitor_all_desas && user.monitor_all_kelompoks) {
        jamaahQuery += ` AND desa = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.desas_pantau || []);
      } else if (user.monitor_all_desas && !user.monitor_all_kelompoks) {
        jamaahQuery += ` AND kelompok = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.kelompoks_pantau || []);
      } else {
        jamaahQuery += ` AND desa = ANY($${paramIdx++}::text[]) AND kelompok = ANY($${paramIdx++}::text[])`;
        jamaahParams.push(user.desas_pantau || [], user.kelompoks_pantau || []);
      }
      jamaahQuery += ` ORDER BY desa ASC, kelompok ASC, nama_lengkap ASC;`;

      const { rows } = await db.query(jamaahQuery, jamaahParams);
      jamaahs = rows;
    }

    // 3. Ambil catatan kehadiran (berdasarkan sesi_id atau date)
    let presenceQuery = "";
    let presenceParams = [];
    if (sesiId) {
      presenceQuery = `
        SELECT id as kehadiran_id, jamaah_id, status, waktu_presensi, recorded_by, sesi_id 
        FROM kehadiran 
        WHERE sesi_id = $1;
      `;
      presenceParams = [sesiId];
    } else {
      presenceQuery = `
        SELECT id as kehadiran_id, jamaah_id, status, waktu_presensi, recorded_by, sesi_id 
        FROM kehadiran 
        WHERE tanggal = $1;
      `;
      presenceParams = [date];
    }

    const { rows: presences } = await db.query(presenceQuery, presenceParams);

    // Group catatan kehadiran berdasarkan jamaah_id
    const presenceMap = {};
    presences.forEach(p => {
      if (!presenceMap[p.jamaah_id]) {
        presenceMap[p.jamaah_id] = [];
      }
      presenceMap[p.jamaah_id].push(p);
    });

    // Helper local check to avoid N+1 database queries
    function checkCanModifyAttendanceLocal(jamaah, user) {
      if (!user) return false;
      if (!user.can_create_kehadiran && !user.can_update_kehadiran && !user.can_delete_kehadiran) {
        return false;
      }
      if (!user.monitor_all_desas) {
        if (!user.desas_pantau || !user.desas_pantau.includes(jamaah.desa)) {
          return false;
        }
      }
      if (!user.monitor_all_kelompoks) {
        if (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(jamaah.kelompok)) {
          return false;
        }
      }
      return true;
    }

    // 4. Bangun daftar structured (1 item per jamaah)
    const resultList = [];
    for (const j of jamaahs) {
      const jPresences = presenceMap[j.jamaah_id] || [];
      const canEdit = checkCanModifyAttendanceLocal(j, user) ? 1 : 0;
      
      resultList.push({
        jamaah_id: j.jamaah_id,
        nama_lengkap: j.nama_lengkap,
        desa: j.desa,
        kelompok: j.kelompok,
        jenis_kelamin: j.jenis_kelamin,
        kategori: j.kategori,
        status_pernikahan: j.status_pernikahan,
        can_edit: canEdit,
        presences: jPresences.map(p => ({
          kehadiran_id: p.kehadiran_id,
          status: p.status,
          waktu_presensi: p.waktu_presensi,
          recorded_by: p.recorded_by,
          sesi_id: p.sesi_id
        }))
      });
    }

    return NextResponse.json(resultList);
  } catch (error) {
    console.error("Gagal memuat data kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Menyimpan atau memperbarui status kehadiran jamaah (Mendukung Sesi)
export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    const data = await request.json();

    // Check if bulk update
    if (data.kehadiran && Array.isArray(data.kehadiran)) {
      const { tanggal, waktu_presensi, kehadiran, sesi_id } = data;
      if (!tanggal) {
        return NextResponse.json({ error: "tanggal wajib diisi" }, { status: 400 });
      }

      try {
        // 1. Batch load existing presence rows to be updated
        const existingIds = kehadiran.filter(k => k.id).map(k => k.id);
        let existingMap = {};
        if (existingIds.length > 0) {
          const { rows: existingRows } = await db.query("SELECT * FROM kehadiran WHERE id = ANY($1);", [existingIds]);
          existingRows.forEach(r => {
            existingMap[r.id] = r;
          });
        }

        // 2. Gather all unique jamaah_ids involved
        const jamaahIds = [
          ...kehadiran.map(k => k.jamaah_id),
          ...Object.values(existingMap).map(e => e.jamaah_id)
        ];
        const uniqueJamaahIds = [...new Set(jamaahIds)];
        let jamaahMap = {};
        if (uniqueJamaahIds.length > 0) {
          const { rows: jamaahRows } = await db.query("SELECT id, nama_lengkap, desa, kelompok FROM jamaah WHERE id = ANY($1);", [uniqueJamaahIds]);
          jamaahRows.forEach(j => {
            jamaahMap[j.id] = j;
          });
        }

        // Local helper for dynamic permission checks
        function checkCanModifyLocal(jamaah, user) {
          if (!user) return false;
          if (!user.can_create_kehadiran && !user.can_update_kehadiran && !user.can_delete_kehadiran) {
            return false;
          }
          if (!user.monitor_all_desas) {
            if (!user.desas_pantau || !user.desas_pantau.includes(jamaah.desa)) {
              return false;
            }
          }
          if (!user.monitor_all_kelompoks) {
            if (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(jamaah.kelompok)) {
              return false;
            }
          }
          return true;
        }

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
              const existing = existingMap[id];

              if (existing) {
                const jamaah = jamaahMap[existing.jamaah_id];
                if (!jamaah || !checkCanModifyLocal(jamaah, user)) {
                  const nameStr = jamaah ? jamaah.nama_lengkap : (existing.jamaah_id || id);
                  throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk mencatat kehadiran jamaah '${nameStr}'.`);
                }

                if (status === 'Tidak Hadir') {
                  if (!user.can_delete_kehadiran) {
                    throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk menghapus presensi.`);
                  }
                  // Delete existing record if reverted to absent
                  await db.query("DELETE FROM kehadiran WHERE id = $1;", [id]);
                } else {
                  if (!user.can_update_kehadiran) {
                    throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk mengubah presensi.`);
                  }
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
                    SET status = $1, waktu_presensi = $2, recorded_by = $3, sesi_id = $4
                    WHERE id = $5;
                  `, [status, rowWaktu, user.email, sesi_id || existing.sesi_id || null, id]);
                }
              }
            } else {
              // New record (standby row filled)
              if (status !== 'Tidak Hadir') {
                if (!user.can_create_kehadiran) {
                  throw new Error(`Akses ditolak: Anda tidak memiliki wewenang untuk membuat presensi baru.`);
                }
                const jamaah = jamaahMap[jamaah_id];
                if (!jamaah || !checkCanModifyLocal(jamaah, user)) {
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
                  INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by, sesi_id)
                  VALUES ($1, $2, $3, $4, $5, $6, $7);
                `, [newId, jamaah_id, tanggal, rowWaktu, status, user.email, sesi_id || null]);
              }
            }
          }
          await db.query("COMMIT;");
        } catch (txError) {
          await db.query("ROLLBACK;");
          throw txError;
        }

        await logActivity(user.email, 'SAVE_ATTENDANCE', 'KEHADIRAN', tanggal, `Menyimpan rekap kehadiran tanggal ${tanggal} (Sesi: ${sesi_id || 'Legacy'}, Jumlah: ${kehadiran.length})`);

        return NextResponse.json({
          success: true,
          message: "Kehadiran berhasil disimpan"
        });
      } catch (txError) {
        return NextResponse.json({ error: txError.message }, { status: 400 });
      }
    } else {
      // Single update (for backwards compatibility if any)
      const { id, jamaah_id, tanggal, status, waktu_presensi, sesi_id } = data;

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
            if (!user.can_delete_kehadiran) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
            await db.query("DELETE FROM kehadiran WHERE id = $1;", [id]);
          } else {
            if (!user.can_update_kehadiran) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
            let rowWaktu = waktu_presensi || null;
            if (status === 'Ijin') rowWaktu = null;
            await db.query(`
              UPDATE kehadiran SET status = $1, waktu_presensi = $2, recorded_by = $3, sesi_id = $4 WHERE id = $5;
            `, [status, rowWaktu, user.email, sesi_id || existing.sesi_id || null, id]);
          }
        }
      } else {
        if (status !== 'Tidak Hadir') {
          if (!user.can_create_kehadiran) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
          if (!(await canModifyAttendance({ jamaah_id, recorded_by: user.email }, user))) {
            return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
          }
          let rowWaktu = waktu_presensi || null;
          if (status === 'Ijin') rowWaktu = null;
          const newId = crypto.randomUUID();
          await db.query(`
            INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by, sesi_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `, [newId, jamaah_id, tanggal, rowWaktu, status, user.email, sesi_id || null]);
        }
      }

      return NextResponse.json({ success: true, message: "Kehadiran berhasil dicatat" });
    }
  } catch (error) {
    console.error("Gagal mencatat kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Menghapus data kehadiran untuk tanggal tertentu atau sesi tertentu
export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (!user.can_delete_kehadiran) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sesiId = searchParams.get('sesi_id');
  const date = searchParams.get('date');

  if (!sesiId && !date) {
    return NextResponse.json({ error: "Parameter sesi_id atau date wajib diisi" }, { status: 400 });
  }

  try {
    let deleteQuery = "DELETE FROM kehadiran WHERE ";
    const deleteParams = [];
    let paramIdx = 1;

    if (sesiId) {
      deleteQuery += `sesi_id = $${paramIdx++}`;
      deleteParams.push(sesiId);
    } else {
      deleteQuery += `tanggal = $${paramIdx++}`;
      deleteParams.push(date);
    }

    if (user.monitor_all_desas && user.monitor_all_kelompoks) {
      // Delete all matching
    } else if (!user.monitor_all_desas && user.monitor_all_kelompoks) {
      deleteQuery += ` AND jamaah_id IN (SELECT id FROM jamaah WHERE desa = ANY($${paramIdx++}::text[]))`;
      deleteParams.push(user.desas_pantau || []);
    } else if (user.monitor_all_desas && !user.monitor_all_kelompoks) {
      deleteQuery += ` AND jamaah_id IN (SELECT id FROM jamaah WHERE kelompok = ANY($${paramIdx++}::text[]))`;
      deleteParams.push(user.kelompoks_pantau || []);
    } else {
      deleteQuery += ` AND jamaah_id IN (SELECT id FROM jamaah WHERE desa = ANY($${paramIdx++}::text[]) AND kelompok = ANY($${paramIdx++}::text[]))`;
      deleteParams.push(user.desas_pantau || [], user.kelompoks_pantau || []);
    }

    await db.query(deleteQuery, deleteParams);

    await logActivity(
      user.email, 
      'RESET_ATTENDANCE', 
      'KEHADIRAN', 
      sesiId || date, 
      `Mereset/menghapus rekap kehadiran untuk ${sesiId ? `Sesi ${sesiId}` : `Tanggal ${date}`}`
    );

    return NextResponse.json({ success: true, message: `Kehadiran berhasil dihapus` });
  } catch (error) {
    console.error("Gagal menghapus kehadiran:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
