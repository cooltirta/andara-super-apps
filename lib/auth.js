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

// Helper: Cek Otorisasi Modifikasi Sesi (Retained for backwards compatibility if needed)
export function canModifySession(sesi, user) {
  if (!user) return false;
  if (user.monitor_all_desas && user.monitor_all_kelompoks) return true;

  if (!user.monitor_all_desas && (!user.desas_pantau || !user.desas_pantau.includes(sesi.desa))) {
    return false;
  }
  if (!user.monitor_all_kelompoks && (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(sesi.kelompok))) {
    return false;
  }
  return true;
}

// Helper: Cek Otorisasi Modifikasi Kehadiran Langsung (Berdasarkan Jamaah & Pembuat Data)
export async function canModifyAttendance(presence, user) {
  if (!user) return false;

  // Must have at least one write presence permission
  if (!user.can_create_kehadiran && !user.can_update_kehadiran && !user.can_delete_kehadiran) {
    return false;
  }

  // Ambil data jamaah untuk memeriksa desa & kelompok
  const { rows: jamaahRows } = await db.query("SELECT * FROM jamaah WHERE id = $1;", [presence.jamaah_id]);
  const jamaah = jamaahRows[0];
  if (!jamaah) return false;

  // Verify village scope
  if (!user.monitor_all_desas) {
    if (!user.desas_pantau || !user.desas_pantau.includes(jamaah.desa)) {
      return false;
    }
  }

  // Verify group scope
  if (!user.monitor_all_kelompoks) {
    if (!user.kelompoks_pantau || !user.kelompoks_pantau.includes(jamaah.kelompok)) {
      return false;
    }
  }

  return true;
}

