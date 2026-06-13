import { cookies } from 'next/headers';
import db from './db';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const emailCookie = cookieStore.get('user_email');
  if (!emailCookie) return null;

  const email = emailCookie.value.trim().toLowerCase();
  const { rows } = await db.query("SELECT * FROM user_profiles WHERE email = $1;", [email]);
  const user = rows[0];
  return user ? user : null;
}

// Helper: Cek Otorisasi Modifikasi Sesi (Delete & Update)
export function canModifySession(sesi, user) {
  if (!user) return false;
  if (user.role === "Super Admin") return true;

  if (sesi.jenis_pengajian === "Pengajian Desa") {
    // Only Admin from the same village can delete/update
    return user.role === "Admin" && user.desa === sesi.desa;
  } else if (sesi.jenis_pengajian === "Pengajian Kelompok") {
    if (user.desa !== sesi.desa) return false;
    if (user.role === "Admin") {
      return user.kelompok === null || user.kelompok === sesi.kelompok;
    } else if (user.role === "Moderator") {
      return user.kelompok === sesi.kelompok;
    }
  }
  return false;
}

// Helper: Cek Otorisasi Modifikasi Kehadiran Langsung (Berdasarkan Jamaah & Pembuat Data)
export async function canModifyAttendance(presence, user) {
  if (!user) return false;
  if (user.role === "Super Admin") return true;

  // Ambil data jamaah untuk memeriksa desa & kelompok
  const { rows: jamaahRows } = await db.query("SELECT * FROM jamaah WHERE id = $1;", [presence.jamaah_id]);
  const jamaah = jamaahRows[0];
  if (!jamaah) return false;

  // Harus berasal dari desa yang sama
  if (user.desa !== jamaah.desa) return false;

  // Cek peran dari user pembuat/pengubah record kehadiran
  let recorderRole = 'Member';
  if (presence.recorded_by) {
    const { rows: recorderRows } = await db.query("SELECT role FROM user_profiles WHERE email = $1;", [presence.recorded_by]);
    const recorder = recorderRows[0];
    if (recorder) {
      recorderRole = recorder.role;
    }
  }

  if (recorderRole === 'Admin' || recorderRole === 'Super Admin') {
    // Presensi tingkat Desa: Hanya Admin desa yang sama yang bisa mengubah
    return user.role === 'Admin';
  } else {
    // Presensi tingkat Kelompok: Moderator dari kelompok yang sama, atau Admin dari kelompok/desa yang sama
    if (user.role === 'Admin') {
      return user.kelompok === null || user.kelompok === jamaah.kelompok;
    } else if (user.role === 'Moderator') {
      return user.kelompok === jamaah.kelompok;
    }
  }
  return false;
}
