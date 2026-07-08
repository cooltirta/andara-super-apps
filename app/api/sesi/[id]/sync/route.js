import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const syncEmail = process.env.SUPABASE_SYNC_EMAIL;
const syncPassword = process.env.SUPABASE_SYNC_PASSWORD;

async function getSupabaseToken() {
  const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: syncEmail, password: syncPassword })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Supabase Login Failed: ${JSON.stringify(loginData)}`);
  }
  return loginData.access_token;
}

export async function GET(request, { params }) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch local session to know kelompoks
    const { rows: sessionRows } = await db.query("SELECT * FROM sesi WHERE id = $1;", [id]);
    const localSession = sessionRows[0];
    if (!localSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    // 2. Login to Supabase
    const token = await getSupabaseToken();

    // 3. Fetch unique schedules (tanggal, kelas) from Supabase presensi for these kelompoks
    const kelompoksParam = localSession.kelompoks.map(k => `"${k}"`).join(',');
    const queryUrl = `${supabaseUrl}/rest/v1/presensi?select=tanggal,kelas,kelompok&kelompok=in.(${kelompoksParam})`;
    const presRes = await fetch(queryUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${token}`
      }
    });

    if (!presRes.ok) {
      const errText = await presRes.text();
      return NextResponse.json({ error: `Gagal menarik data dari Supabase: ${errText}` }, { status: 500 });
    }

    const presList = await presRes.json();

    // Generate unique schedule list
    const seen = new Set();
    const schedules = [];
    for (const p of presList) {
      if (!p.tanggal || !p.kelas) continue;
      const key = `${p.tanggal}|${p.kelas}`;
      if (!seen.has(key)) {
        seen.add(key);
        schedules.push({ tanggal: p.tanggal, kelas: p.kelas });
      }
    }

    // Sort schedules by date descending
    schedules.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("GET /api/sesi/[id]/sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminEmail = emailCookie.value;

    const { id } = await params;
    const body = await request.json();
    const { tanggal, kelas } = body;

    if (!tanggal || !kelas) {
      return NextResponse.json({ error: "Tanggal dan kelas wajib dipilih" }, { status: 400 });
    }

    // 1. Fetch local session
    const { rows: sessionRows } = await db.query("SELECT * FROM sesi WHERE id = $1;", [id]);
    const localSession = sessionRows[0];
    if (!localSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    // 2. Login to Supabase
    const token = await getSupabaseToken();

    // 3. Fetch live jamaah list to map liveId -> Name
    const kelompoksParam = localSession.kelompoks.map(k => `"${k}"`).join(',');
    const jamaahUrl = `${supabaseUrl}/rest/v1/jamaah?select=id,nama&kelompok=in.(${kelompoksParam})`;
    const jamRes = await fetch(jamaahUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${token}`
      }
    });

    if (!jamRes.ok) {
      const errText = await jamRes.text();
      return NextResponse.json({ error: `Gagal menarik data jamaah dari Supabase: ${errText}` }, { status: 500 });
    }

    const liveJamaah = await jamRes.json();
    const liveIdToNameMap = {};
    liveJamaah.forEach(j => {
      liveIdToNameMap[j.id] = j.nama ? j.nama.trim().toLowerCase() : "";
    });

    // 4. Fetch live presence records
    const presenceUrl = `${supabaseUrl}/rest/v1/presensi?kelompok=in.(${kelompoksParam})&kelas=eq.${encodeURIComponent(kelas)}&tanggal=eq.${tanggal}`;
    const presRes = await fetch(presenceUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${token}`
      }
    });

    if (!presRes.ok) {
      const errText = await presRes.text();
      return NextResponse.json({ error: `Gagal menarik data kehadiran dari Supabase: ${errText}` }, { status: 500 });
    }

    const livePresences = await presRes.json();
    const nameToStatusMap = {};
    livePresences.forEach(p => {
      const name = liveIdToNameMap[p.jamaahId];
      if (name) {
        nameToStatusMap[name] = p.status; // 'H', 'I', 'A'
      }
    });

    // 5. Fetch local jamaah in scope
    const localJamaahQuery = `
      SELECT id as jamaah_id, nama_lengkap, desa, kelompok 
      FROM jamaah 
      WHERE status_kehidupan = 'Hidup'
        AND desa = ANY($1::text[])
        AND kelompok = ANY($2::text[])
        AND jenis_kelamin = ANY($3::text[])
        AND status_pernikahan = ANY($4::text[])
        AND kategori = ANY($5::text[]);
    `;
    const { rows: localJamaahs } = await db.query(localJamaahQuery, [
      localSession.desas,
      localSession.kelompoks,
      localSession.genders,
      localSession.marital_statuses,
      localSession.kategoris
    ]);

    // 6. Fetch existing local attendance for this session
    const { rows: existingKehadiran } = await db.query(
      "SELECT id, jamaah_id FROM kehadiran WHERE sesi_id = $1;",
      [id]
    );
    const existingMap = {};
    existingKehadiran.forEach(k => {
      existingMap[k.jamaah_id] = k.id;
    });

    // 7. Perform PostgreSQL transaction to update
    await db.query("BEGIN;");
    try {
      // A. Update local session date
      await db.query("UPDATE sesi SET tanggal = $1 WHERE id = $2;", [tanggal, id]);

      // B. Update/Insert/Delete attendance records
      for (const lj of localJamaahs) {
        const nameKey = lj.nama_lengkap.trim().toLowerCase();
        const liveStatus = nameToStatusMap[nameKey]; // 'H', 'I', 'A' or undefined

        // Status mapping
        let localStatus = 'Tidak Hadir';
        if (liveStatus === 'H') {
          localStatus = 'Hadir';
        } else if (liveStatus === 'I') {
          localStatus = 'Ijin';
        }

        const existingId = existingMap[lj.jamaah_id];

        if (localStatus === 'Tidak Hadir') {
          // Absent - delete row if exists in local PostgreSQL db
          if (existingId) {
            await db.query("DELETE FROM kehadiran WHERE id = $1;", [existingId]);
          }
        } else {
          // Hadir or Ijin
          let timeVal = null;
          if (localStatus === 'Hadir') {
            timeVal = `${tanggal} 08:00:00`; // Default time representation
          }
          
          if (existingId) {
            // Update
            await db.query(
              "UPDATE kehadiran SET status = $1, waktu_presensi = $2, recorded_by = $3 WHERE id = $4;",
              [localStatus, timeVal, adminEmail, existingId]
            );
          } else {
            // Insert
            const newId = crypto.randomUUID();
            await db.query(
              "INSERT INTO kehadiran (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by, sesi_id) VALUES ($1, $2, $3, $4, $5, $6, $7);",
              [newId, lj.jamaah_id, tanggal, timeVal, localStatus, adminEmail, id]
            );
          }
        }
      }

      await db.query("COMMIT;");
    } catch (txErr) {
      await db.query("ROLLBACK;");
      throw txErr;
    }

    // Log the sync activity
    await logActivity(
      adminEmail, 
      'SYNC_ATTENDANCE', 
      'KEHADIRAN', 
      id, 
      `Sinkronisasi sesi dengan Ngajiku: ${kelas} (${tanggal}) - Sesi ID: ${id}`
    );

    return NextResponse.json({
      success: true,
      message: "Sinkronisasi dengan Ngajiku berhasil.",
      syncedCount: localJamaahs.length
    });
  } catch (error) {
    console.error("POST /api/sesi/[id]/sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
