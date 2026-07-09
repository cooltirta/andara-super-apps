import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

function getNgajikuClass(localSession) {
  const genders = localSession.genders || [];
  const marital = localSession.marital_statuses || [];
  const categories = localSession.kategoris || [];

  // 1. Ibu2 Klp: Only Perempuan, Only Menikah
  if (genders.length === 1 && genders[0] === 'Perempuan') {
    if (marital.includes('Menikah') && !marital.includes('Belum Menikah')) {
      return 'Ibu2 Klp';
    }
  }

  // 2. Asad Pr: Only Perempuan, contains Pra Nikah/Remaja
  if (genders.length === 1 && genders[0] === 'Perempuan') {
    if (categories.includes('Pra Nikah') || categories.includes('Remaja')) {
      return 'Asad Pr';
    }
  }

  // 3. Asad Lk: Only Laki-laki, contains Pra Nikah/Remaja
  if (genders.length === 1 && genders[0] === 'Laki-laki') {
    if (categories.includes('Pra Nikah') || categories.includes('Remaja')) {
      return 'Asad Lk';
    }
  }

  // 4. 5 Unsur: Only Menikah (both genders)
  if (marital.includes('Menikah') && !marital.includes('Belum Menikah')) {
    return '5 Unsur';
  }

  // Default
  return 'Ngaji Klp';
}

export async function GET(request, { params }) {
  try {
    const emailCookie = request.cookies.get('user_email');
    if (!emailCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch local session
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
    const body = await request.json().catch(() => ({}));
    const requestKelas = body.kelas;
    
    // 1. Fetch local session details
    const { rows: sessionRows } = await db.query("SELECT * FROM sesi WHERE id = $1;", [id]);
    const localSession = sessionRows[0];
    if (!localSession) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    const tanggal = localSession.tanggal;
    const kelas = requestKelas || getNgajikuClass(localSession);
    const kelompok = localSession.kelompoks && localSession.kelompoks[0] ? localSession.kelompoks[0] : "";

    if (!kelompok) {
      return NextResponse.json({ error: "Kelompok pada sesi lokal kosong" }, { status: 400 });
    }

    // 2. Login to Supabase
    const token = await getSupabaseToken();

    // 3. Fetch live jamaah of this kelompok from Supabase to map liveId -> Name
    const liveJamaahUrl = `${supabaseUrl}/rest/v1/jamaah?select=id,nama&kelompok=eq.${encodeURIComponent(kelompok)}`;
    const liveJamRes = await fetch(liveJamaahUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${token}`
      }
    });

    if (!liveJamRes.ok) {
      const errText = await liveJamRes.text();
      return NextResponse.json({ error: `Gagal menarik data jamaah dari Supabase: ${errText}` }, { status: 500 });
    }

    const liveJamaahList = await liveJamRes.json();
    const liveIdToNameMap = {};
    const liveNameToIdMap = {};
    liveJamaahList.forEach(j => {
      const sanitizedName = j.nama ? j.nama.trim().toLowerCase() : "";
      liveIdToNameMap[j.id] = sanitizedName;
      if (sanitizedName) {
        liveNameToIdMap[sanitizedName] = j.id;
      }
    });

    // 4. Fetch live presence records from Supabase for this date/kelas/kelompok
    const presenceUrl = `${supabaseUrl}/rest/v1/presensi?kelompok=eq.${encodeURIComponent(kelompok)}&kelas=eq.${encodeURIComponent(kelas)}&tanggal=eq.${tanggal}`;
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
      "SELECT id, jamaah_id, status FROM kehadiran WHERE sesi_id = $1;",
      [id]
    );
    const existingMap = {};
    existingKehadiran.forEach(k => {
      existingMap[k.jamaah_id] = k;
    });

    // Check if there are local marked presence records (status: 'Hadir' or 'Ijin')
    const hasLocalMarkedAttendance = existingKehadiran.some(k => k.status === 'Hadir' || k.status === 'Ijin');

    if (hasLocalMarkedAttendance) {
      // CASE A: Push local presence to Supabase Ngajiku
      console.log(`Pushing Andara presence to Ngajiku for date ${tanggal}, kelas ${kelas}, kelompok ${kelompok}...`);
      
      const livePresencesByJamaahId = {};
      livePresences.forEach(p => {
        livePresencesByJamaahId[p.jamaahId] = p;
      });

      // Prepare local attendance status by name map
      const localNameToStatusMap = {};
      localJamaahs.forEach(lj => {
        const existingK = existingMap[lj.jamaah_id];
        let status = 'A'; // default 'Alpha'
        if (existingK) {
          if (existingK.status === 'Hadir') status = 'H';
          if (existingK.status === 'Ijin') status = 'I';
        }
        localNameToStatusMap[lj.nama_lengkap.trim().toLowerCase()] = status;
      });

      // Update, insert, or delete records in Supabase (only sync non-Alpha H/I)
      for (const sj of liveJamaahList) {
        const sanitizedName = sj.nama ? sj.nama.trim().toLowerCase() : "";
        const targetStatus = localNameToStatusMap[sanitizedName] || 'A';
        const existingLive = livePresencesByJamaahId[sj.id];

        if (targetStatus === 'H' || targetStatus === 'I') {
          if (existingLive) {
            // If status is different, update it
            if (existingLive.status !== targetStatus) {
              const updateUrl = `${supabaseUrl}/rest/v1/presensi?id=eq.${existingLive.id}`;
              await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: targetStatus })
              });
            }
          } else {
            // Insert new record
            const insertUrl = `${supabaseUrl}/rest/v1/presensi`;
            const newId = `pres-${crypto.randomBytes(5).toString('hex').slice(0, 9)}`;
            await fetch(insertUrl, {
              method: 'POST',
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
              },
              body: JSON.stringify({
                id: newId,
                jamaahId: sj.id,
                tanggal: tanggal,
                kelas: kelas,
                status: targetStatus,
                kelompok: kelompok
              })
            });
          }
        } else {
          // targetStatus is 'A' (Alpha). We don't want it to exist in Supabase!
          if (existingLive) {
            // Delete record
            const deleteUrl = `${supabaseUrl}/rest/v1/presensi?id=eq.${existingLive.id}`;
            await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${token}`
              }
            });
          }
        }
      }

      const localCount = Object.values(localNameToStatusMap).filter(status => status === 'H' || status === 'I').length;

      // Re-fetch to get the final synced counts in Supabase
      const finalRes = await fetch(presenceUrl, {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${token}`
        }
      });
      let supabaseCount = 0;
      if (finalRes.ok) {
        const finalPresences = await finalRes.json();
        supabaseCount = finalPresences.filter(p => p.status === 'H' || p.status === 'I').length;
      }

      const diffMsg = localCount === supabaseCount
        ? `Seluruh data (${localCount} orang) telah sinkron sempurna antara Andara & Ngajiku.`
        : `⚠️ Perhatian! Ada perbedaan data: Andara memiliki ${localCount} data hadir/izin, sedangkan Ngajiku mendeteksi ${supabaseCount} data. Silakan sinkronkan kembali jika diperlukan.`;

      await logActivity(
        adminEmail, 
        'SYNC_ATTENDANCE', 
        'KEHADIRAN', 
        id, 
        `Sinkronisasi otomatis (PUSH): Berhasil mengunggah data absensi kelompok ${kelompok} kelas ${kelas} ke Ngajiku. (Local: ${localCount}, Supabase: ${supabaseCount})`
      );

      return NextResponse.json({
        success: true,
        message: `Sinkronisasi selesai! ${diffMsg}`,
        localCount,
        supabaseCount
      });

    } else {
      // CASE B: Pull Ngajiku presence to local
      console.log(`Pulling Ngajiku presence to Andara for date ${tanggal}, kelas ${kelas}, kelompok ${kelompok}...`);

      const nameToStatusMap = {};
      livePresences.forEach(p => {
        const name = liveIdToNameMap[p.jamaahId];
        if (name) {
          nameToStatusMap[name] = p.status;
        }
      });

      // Update local PostgreSQL database
      await db.query("BEGIN;");
      try {
        for (const lj of localJamaahs) {
          const nameKey = lj.nama_lengkap.trim().toLowerCase();
          const liveStatus = nameToStatusMap[nameKey]; // 'H', 'I', 'A' or undefined

          let localStatus = 'Tidak Hadir';
          if (liveStatus === 'H') {
            localStatus = 'Hadir';
          } else if (liveStatus === 'I') {
            localStatus = 'Ijin';
          }

          const existingK = existingMap[lj.jamaah_id];

          if (localStatus === 'Tidak Hadir') {
            if (existingK) {
              await db.query("DELETE FROM kehadiran WHERE id = $1;", [existingK.id]);
            }
          } else {
            let timeVal = null;
            if (localStatus === 'Hadir') {
              timeVal = `${tanggal} 08:00:00`;
            }

            if (existingK) {
              await db.query(
                "UPDATE kehadiran SET status = $1, waktu_presensi = $2, recorded_by = $3 WHERE id = $4;",
                [localStatus, timeVal, adminEmail, existingK.id]
              );
            } else {
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

      // Count final local presence records
      const { rows: localCountRows } = await db.query(
        "SELECT COUNT(*) as count FROM kehadiran WHERE sesi_id = $1 AND (status = 'Hadir' OR status = 'Ijin');",
        [id]
      );
      const localCount = parseInt(localCountRows[0].count);
      const supabaseCount = livePresences.filter(p => p.status === 'H' || p.status === 'I').length;

      const diffMsg = localCount === supabaseCount
        ? `Seluruh data (${localCount} orang) telah sinkron sempurna antara Ngajiku & Andara.`
        : `⚠️ Perhatian! Ada perbedaan data: Ngajiku memiliki ${supabaseCount} data hadir/izin, sedangkan lokal Andara mendeteksi ${localCount} data.`;

      await logActivity(
        adminEmail, 
        'SYNC_ATTENDANCE', 
        'KEHADIRAN', 
        id, 
        `Sinkronisasi otomatis (PULL): Berhasil mengunduh data absensi kelompok ${kelompok} kelas ${kelas} dari Ngajiku. (Local: ${localCount}, Supabase: ${supabaseCount})`
      );

      return NextResponse.json({
        success: true,
        message: `Sinkronisasi selesai! ${diffMsg}`,
        localCount,
        supabaseCount
      });
    }

  } catch (error) {
    console.error("POST /api/sesi/[id]/sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
