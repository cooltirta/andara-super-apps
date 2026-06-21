import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import crypto from 'crypto';

// Helper to resolve current GMT+7 date and time
function getGmt7DateTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 7)); // Add 7 hours for GMT+7
  const pad = (n) => n.toString().padStart(2, '0');
  const dateStr = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
  const timeStr = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())} ${pad(nd.getHours())}:${pad(nd.getMinutes())}:${pad(nd.getSeconds())}`;
  return { dateStr, timeStr };
}

// GET: Mendapatkan daftar peminjaman aktif & riwayat peminjaman
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  try {
    let query = `
      SELECT p.*, b.nama_barang, b.tempat_simpan, b.desa, b.kelompok 
      FROM peminjaman_sabilillah p
      JOIN barang_sabilillah b ON p.barang_id = b.id
    `;
    const params = [];
    const conditions = [];
    let paramIdx = 1;

    if (!user.monitor_all_desas) {
      conditions.push(`b.desa = ANY($${paramIdx++}::text[])`);
      params.push(user.desas_pantau || []);
    }
    if (!user.monitor_all_kelompoks) {
      conditions.push(`b.kelompok = ANY($${paramIdx++}::text[])`);
      params.push(user.kelompoks_pantau || []);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY p.status DESC, p.tanggal_pinjam DESC;";

    const { rows: peminjaman } = await db.query(query, params);
    return NextResponse.json(peminjaman);
  } catch (error) {
    console.error("Gagal mengambil data peminjaman:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Membuat form/catatan peminjaman baru
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak: Anggota biasa tidak dapat merekam peminjaman" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const barang_id = data.barang_id;
    const peminjam_nama = data.peminjam_nama ? data.peminjam_nama.trim() : '';
    const jumlah_pinjam = parseInt(data.jumlah_pinjam, 10);
    const tujuan_pinjam = data.tujuan_pinjam ? data.tujuan_pinjam.trim() : '';
    const tanggal_kembali_rencana = data.tanggal_kembali_rencana || '';

    if (!barang_id || !peminjam_nama || isNaN(jumlah_pinjam) || jumlah_pinjam <= 0 || !tujuan_pinjam || !tanggal_kembali_rencana) {
      return NextResponse.json({ error: "Semua kolom (barang, peminjam, jumlah pinjam >0, tujuan, tanggal kembali) wajib diisi" }, { status: 400 });
    }

    await db.query("BEGIN;");
    try {
      // 1. Ambil data barang & cek kepemilikan wewenang
      const { rows: barangRows } = await db.query("SELECT * FROM barang_sabilillah WHERE id = $1 FOR UPDATE;", [barang_id]);
      const barang = barangRows[0];
      if (!barang) {
        throw new Error("Barang sabilillah tidak ditemukan");
      }

      // Validasi wilayah terpantau user
      if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(barang.desa))) {
        return NextResponse.json({ error: "Akses ditolak: Barang di luar desa terpantau Anda" }, { status: 403 });
      }
      if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(barang.kelompok))) {
        return NextResponse.json({ error: "Akses ditolak: Barang di luar kelompok terpantau Anda" }, { status: 403 });
      }

      // 2. Hitung jumlah barang yang sedang dipinjam saat ini
      const { rows: pinjamSumRows } = await db.query(
        "SELECT SUM(jumlah_pinjam) as total_pinjam FROM peminjaman_sabilillah WHERE barang_id = $1 AND status = 'Dipinjam';",
        [barang_id]
      );
      const totalPinjam = parseInt(pinjamSumRows[0].total_pinjam, 10) || 0;
      const stokTersedia = barang.jumlah_total - totalPinjam;

      if (jumlah_pinjam > stokTersedia) {
        throw new Error(`Stok tidak mencukupi. Stok tersedia saat ini: ${stokTersedia} unit.`);
      }

      // 3. Simpan transaksi peminjaman
      const id = crypto.randomUUID();
      const { timeStr } = getGmt7DateTime();

      await db.query(`
        INSERT INTO peminjaman_sabilillah (id, barang_id, peminjam_nama, jumlah_pinjam, tujuan_pinjam, tanggal_kembali_rencana, tanggal_pinjam, status, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Dipinjam', $8);
      `, [id, barang_id, peminjam_nama, jumlah_pinjam, tujuan_pinjam, tanggal_kembali_rencana, timeStr, user.email]);

      await db.query("COMMIT;");
      
      await logActivity(
        user.email, 
        'ADD', 
        'SB_PINJAM', 
        id, 
        `Peminjaman dicatat: ${peminjam_nama} meminjam ${jumlah_pinjam} pcs ${barang.nama_barang} (Tujuan: ${tujuan_pinjam})`
      );

      return NextResponse.json({ success: true, id, message: "Peminjaman barang berhasil dicatat" });
    } catch (err) {
      await db.query("ROLLBACK;");
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  } catch (error) {
    console.error("Gagal menambahkan peminjaman:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
