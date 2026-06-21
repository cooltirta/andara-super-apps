import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

// GET: Ambil daftar barang sabilillah berdasarkan wilayah pantauan user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    let query = "SELECT * FROM barang_sabilillah";
    const params = [];
    const conditions = [];
    let paramIdx = 1;

    if (!user.monitor_all_desas) {
      conditions.push(`desa = ANY($${paramIdx++}::text[])`);
      params.push(user.desas_pantau || []);
    }
    if (!user.monitor_all_kelompoks) {
      conditions.push(`kelompok = ANY($${paramIdx++}::text[])`);
      params.push(user.kelompoks_pantau || []);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY nama_barang ASC;";

    const { rows: barang } = await db.query(query, params);

    // Ambil detail peminjaman aktif untuk menghitung stok tersedia
    const { rows: pinjamRows } = await db.query(
      "SELECT barang_id, SUM(jumlah_pinjam) as total_pinjam FROM peminjaman_sabilillah WHERE status = 'Dipinjam' GROUP BY barang_id;"
    );

    const pinjamMap = {};
    pinjamRows.forEach(p => {
      pinjamMap[p.barang_id] = parseInt(p.total_pinjam, 10);
    });

    const result = barang.map(b => {
      const pinjamCount = pinjamMap[b.id] || 0;
      return {
        ...b,
        stok_tersedia: Math.max(0, b.jumlah_total - pinjamCount)
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Gagal mengambil daftar barang:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Menambah barang baru
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak: Anggota biasa tidak dapat menambahkan barang" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const nama_barang = data.nama_barang ? data.nama_barang.trim() : '';
    const jumlah_total = parseInt(data.jumlah_total, 10);
    const tempat_simpan = data.tempat_simpan ? data.tempat_simpan.trim() : '';
    const foto_url = data.foto_url || null; // base64 string
    const keterangan = data.keterangan || null;
    const desa = data.desa || '';
    const kelompok = data.kelompok || '';

    if (!nama_barang || isNaN(jumlah_total) || jumlah_total < 0 || !tempat_simpan || !desa || !kelompok) {
      return NextResponse.json({ error: "Kolom nama barang, jumlah total (>=0), lokasi simpan, desa, dan kelompok wajib diisi" }, { status: 400 });
    }

    // Validasi wilayah terpantau user
    if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(desa))) {
      return NextResponse.json({ error: `Akses ditolak: Desa '${desa}' di luar wilayah terpantau Anda` }, { status: 403 });
    }
    if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(kelompok))) {
      return NextResponse.json({ error: `Akses ditolak: Kelompok '${kelompok}' di luar wilayah terpantau Anda` }, { status: 403 });
    }

    const id = crypto.randomUUID();
    await db.query(`
      INSERT INTO barang_sabilillah (id, nama_barang, jumlah_total, tempat_simpan, foto_url, keterangan, desa, kelompok)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `, [id, nama_barang, jumlah_total, tempat_simpan, foto_url, keterangan, desa, kelompok]);

    await logActivity(user.email, 'ADD', 'SB_BARANG', id, `Menambahkan barang sabilillah baru: ${nama_barang} (Total: ${jumlah_total} pcs)`);

    return NextResponse.json({ success: true, id, message: "Barang sabilillah berhasil ditambahkan" });
  } catch (error) {
    console.error("Gagal menambahkan barang sabilillah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
