import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

// Helper to resolve current GMT+7 date and time
function getGmt7DateTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 7)); // Add 7 hours for GMT+7
  const pad = (n) => n.toString().padStart(2, '0');
  const timeStr = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())} ${pad(nd.getHours())}:${pad(nd.getMinutes())}:${pad(nd.getSeconds())}`;
  return { timeStr };
}

// PUT: Pengembalian barang (menyelesaikan peminjaman)
export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (user.role === 'Member') {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await db.query("BEGIN;");
    try {
      // 1. Ambil data peminjaman beserta detail barang untuk validasi wewenang
      const { rows: pinjamRows } = await db.query(`
        SELECT p.*, b.nama_barang, b.desa, b.kelompok 
        FROM peminjaman_sabilillah p
        JOIN barang_sabilillah b ON p.barang_id = b.id
        WHERE p.id = $1 FOR UPDATE;
      `, [id]);

      const pinjam = pinjamRows[0];
      if (!pinjam) {
        throw new Error("Data peminjaman tidak ditemukan");
      }

      if (pinjam.status === 'Dikembalikan') {
        throw new Error("Barang sudah dikembalikan sebelumnya");
      }

      // Validasi wilayah terpantau user
      if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(pinjam.desa))) {
        return NextResponse.json({ error: "Akses ditolak: Barang di luar desa terpantau Anda" }, { status: 403 });
      }
      if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(pinjam.kelompok))) {
        return NextResponse.json({ error: "Akses ditolak: Barang di luar kelompok terpantau Anda" }, { status: 403 });
      }

      const { timeStr } = getGmt7DateTime();

      // 2. Update status peminjaman menjadi 'Dikembalikan'
      await db.query(`
        UPDATE peminjaman_sabilillah 
        SET status = 'Dikembalikan', tanggal_kembali_aktual = $1
        WHERE id = $2;
      `, [timeStr, id]);

      await db.query("COMMIT;");

      await logActivity(
        user.email,
        'EDIT',
        'SB_PINJAM',
        id,
        `Pengembalian barang berhasil: ${pinjam.peminjam_nama} mengembalikan ${pinjam.jumlah_pinjam} pcs ${pinjam.nama_barang}`
      );

      return NextResponse.json({ success: true, message: "Pengembalian barang sabilillah berhasil dicatat" });
    } catch (err) {
      await db.query("ROLLBACK;");
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  } catch (error) {
    console.error("Gagal memproses pengembalian barang:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
