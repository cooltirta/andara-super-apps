import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    let query = `
      SELECT id, nama_lengkap, desa, kelompok, kategori, jenis_kelamin, status_pernikahan, foto_url
      FROM jamaah
      WHERE status_kehidupan = 'Hidup' AND nama_lengkap ILIKE $1
    `;
    const params = [`%${q.trim()}%`];

    // If not a Super Admin, restrict search to the user's registered desa
    if (user.role !== 'Super Admin' && !user.monitor_all_desas) {
      query += ` AND desa = $2`;
      params.push(user.desa);
    }

    query += ` LIMIT 10;`;

    const { rows } = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Gagal melakukan pencarian jamaah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
