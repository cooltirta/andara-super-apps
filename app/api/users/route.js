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

  if (!user.can_read_user) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    await logActivity(user.email, 'VISIT', 'PAGE', 'USER_ACCESS', 'Mengakses halaman User Management');
    
    let query = "SELECT * FROM user_profiles";
    const params = [];
    let paramIdx = 1;

    if (user.monitor_all_desas && user.monitor_all_kelompoks) {
      query += " ORDER BY email ASC;";
    } else if (!user.monitor_all_desas && user.monitor_all_kelompoks) {
      query += ` WHERE desa = ANY($${paramIdx++}::text[]) ORDER BY email ASC;`;
      params.push(user.desas_pantau || []);
    } else if (user.monitor_all_desas && !user.monitor_all_kelompoks) {
      query += ` WHERE kelompok = ANY($${paramIdx++}::text[]) ORDER BY email ASC;`;
      params.push(user.kelompoks_pantau || []);
    } else {
      query += ` WHERE desa = ANY($${paramIdx++}::text[]) AND kelompok = ANY($${paramIdx++}::text[]) ORDER BY email ASC;`;
      params.push(user.desas_pantau || [], user.kelompoks_pantau || []);
    }

    const { rows } = await db.query(query, params);
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

  if (!user.can_create_user) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const data = await request.json();
    let email = data.email;
    let role = data.role || "Member";
    let kelompok = data.kelompok || null;
    let desa = data.desa || "Andara";

    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    email = email.trim().toLowerCase();

    // Verify creator's scope for the target user's main village & group
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(desa))) {
      return NextResponse.json({ error: `Akses ditolak: Desa '${desa}' di luar wilayah terpantau Anda` }, { status: 403 });
    }
    if (kelompok && !user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(kelompok))) {
      return NextResponse.json({ error: `Akses ditolak: Kelompok '${kelompok}' di luar wilayah terpantau Anda` }, { status: 403 });
    }

    const { rows: existingRows } = await db.query("SELECT COUNT(*) as count FROM user_profiles WHERE email = $1;", [email]);
    const existing = parseInt(existingRows[0].count, 10);
    if (existing > 0) {
      return NextResponse.json({ error: "User dengan email ini sudah terdaftar" }, { status: 400 });
    }

    const user_id = crypto.randomUUID();

    const monitor_all_desas = !!data.monitor_all_desas;
    const desas_pantau = data.desas_pantau || [];
    const monitor_all_kelompoks = !!data.monitor_all_kelompoks;
    const kelompoks_pantau = data.kelompoks_pantau || [];

    const can_create_jamaah = !!data.can_create_jamaah;
    const can_read_jamaah = !!data.can_read_jamaah;
    const can_update_jamaah = !!data.can_update_jamaah;
    const can_delete_jamaah = !!data.can_delete_jamaah;

    const can_create_keluarga = !!data.can_create_keluarga;
    const can_read_keluarga = !!data.can_read_keluarga;
    const can_update_keluarga = !!data.can_update_keluarga;
    const can_delete_keluarga = !!data.can_delete_keluarga;

    const can_create_kehadiran = !!data.can_create_kehadiran;
    const can_read_kehadiran = !!data.can_read_kehadiran;
    const can_update_kehadiran = !!data.can_update_kehadiran;
    const can_delete_kehadiran = !!data.can_delete_kehadiran;

    const can_read_laporan = !!data.can_read_laporan;

    const can_create_user = !!data.can_create_user;
    const can_read_user = !!data.can_read_user;
    const can_update_user = !!data.can_update_user;
    const can_delete_user = !!data.can_delete_user;

    const can_create_lokasi = !!data.can_create_lokasi;
    const can_read_lokasi = !!data.can_read_lokasi;
    const can_update_lokasi = !!data.can_update_lokasi;
    const can_delete_lokasi = !!data.can_delete_lokasi;

    const can_create_struktur = !!data.can_create_struktur;
    const can_read_struktur = !!data.can_read_struktur;
    const can_update_struktur = !!data.can_update_struktur;
    const can_delete_struktur = !!data.can_delete_struktur;

    const can_create_wilayah = !!data.can_create_wilayah;
    const can_read_wilayah = !!data.can_read_wilayah;
    const can_update_wilayah = !!data.can_update_wilayah;
    const can_delete_wilayah = !!data.can_delete_wilayah;

    const can_create_dapukan = !!data.can_create_dapukan;
    const can_read_dapukan = !!data.can_read_dapukan;
    const can_update_dapukan = !!data.can_update_dapukan;
    const can_delete_dapukan = !!data.can_delete_dapukan;

    const can_read_logs = !!data.can_read_logs;

    const can_create_pnkb = !!data.can_create_pnkb;
    const can_read_pnkb = !!data.can_read_pnkb;
    const can_update_pnkb = !!data.can_update_pnkb;
    const can_delete_pnkb = !!data.can_delete_pnkb;

    const can_create_haji = !!data.can_create_haji;
    const can_read_haji = !!data.can_read_haji;
    const can_update_haji = !!data.can_update_haji;
    const can_delete_haji = !!data.can_delete_haji;

    const can_create_sabilillah = !!data.can_create_sabilillah;
    const can_read_sabilillah = !!data.can_read_sabilillah;
    const can_update_sabilillah = !!data.can_update_sabilillah;
    const can_delete_sabilillah = !!data.can_delete_sabilillah;

    const can_create_kalender = !!data.can_create_kalender;
    const can_read_kalender = !!data.can_read_kalender;
    const can_update_kalender = !!data.can_update_kalender;
    const can_delete_kalender = !!data.can_delete_kalender;

    await db.query(`
      INSERT INTO user_profiles (
        id, email, role, kelompok, desa,
        monitor_all_desas, desas_pantau, monitor_all_kelompoks, kelompoks_pantau,
        can_create_jamaah, can_read_jamaah, can_update_jamaah, can_delete_jamaah,
        can_create_keluarga, can_read_keluarga, can_update_keluarga, can_delete_keluarga,
        can_create_kehadiran, can_read_kehadiran, can_update_kehadiran, can_delete_kehadiran,
        can_read_laporan,
        can_create_user, can_read_user, can_update_user, can_delete_user,
        can_create_lokasi, can_read_lokasi, can_update_lokasi, can_delete_lokasi,
        can_create_struktur, can_read_struktur, can_update_struktur, can_delete_struktur,
        can_create_wilayah, can_read_wilayah, can_update_wilayah, can_delete_wilayah,
        can_create_dapukan, can_read_dapukan, can_update_dapukan, can_delete_dapukan,
        can_read_logs,
        can_create_pnkb, can_read_pnkb, can_update_pnkb, can_delete_pnkb,
        can_create_haji, can_read_haji, can_update_haji, can_delete_haji,
        can_create_sabilillah, can_read_sabilillah, can_update_sabilillah, can_delete_sabilillah,
        can_create_kalender, can_read_kalender, can_update_kalender, can_delete_kalender
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33, $34,
        $35, $36, $37, $38,
        $39, $40, $41, $42,
        $43,
        $44, $45, $46, $47,
        $48, $49, $50, $51,
        $52, $53, $54, $55,
        $56, $57, $58, $59
      );
    `, [
      user_id, email, role, kelompok, desa,
      monitor_all_desas, desas_pantau, monitor_all_kelompoks, kelompoks_pantau,
      can_create_jamaah, can_read_jamaah, can_update_jamaah, can_delete_jamaah,
      can_create_keluarga, can_read_keluarga, can_update_keluarga, can_delete_keluarga,
      can_create_kehadiran, can_read_kehadiran, can_update_kehadiran, can_delete_kehadiran,
      can_read_laporan,
      can_create_user, can_read_user, can_update_user, can_delete_user,
      can_create_lokasi, can_read_lokasi, can_update_lokasi, can_delete_lokasi,
      can_create_struktur, can_read_struktur, can_update_struktur, can_delete_struktur,
      can_create_wilayah, can_read_wilayah, can_update_wilayah, can_delete_wilayah,
      can_create_dapukan, can_read_dapukan, can_update_dapukan, can_delete_dapukan,
      can_read_logs,
      can_create_pnkb, can_read_pnkb, can_update_pnkb, can_delete_pnkb,
      can_create_haji, can_read_haji, can_update_haji, can_delete_haji,
      can_create_sabilillah, can_read_sabilillah, can_update_sabilillah, can_delete_sabilillah,
      can_create_kalender, can_read_kalender, can_update_kalender, can_delete_kalender
    ]);

    await logActivity(user.email, 'ADD', 'USER', user_id, `Menambahkan user: ${email} (Role: ${role}, Desa: ${desa})`);

    return NextResponse.json({ success: true, id: user_id, message: "User berhasil ditambahkan" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

