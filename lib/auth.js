import { cookies } from 'next/headers';
import db from './db';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const emailCookie = cookieStore.get('user_email');
  if (!emailCookie) return null;

  const email = emailCookie.value.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM user_profiles WHERE email = ?;").get(email);
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
export function canModifyAttendance(presence, user) {
  if (!user) return false;
  if (user.role === "Super Admin") return true;

  // Ambil data jamaah untuk memeriksa desa & kelompok
  const jamaah = db.prepare("SELECT * FROM jamaah WHERE id = ?;").get(presence.jamaah_id);
  if (!jamaah) return false;

  // Harus berasal dari desa yang sama
  if (user.desa !== jamaah.desa) return false;

  // Cek peran dari user pembuat/pengubah record kehadiran
  let recorderRole = 'Member';
  if (presence.recorded_by) {
    const recorder = db.prepare("SELECT role FROM user_profiles WHERE email = ?;").get(presence.recorded_by);
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
