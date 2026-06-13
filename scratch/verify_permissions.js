const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');
const db = new Database(dbPath);

// Ambil profil user untuk mock
const users = db.prepare("SELECT * FROM user_profiles").all();
const getU = (email) => users.find(u => u.email === email);

const fulanA = getU('fulan_a@andara.com'); // Mod - Andara 2
const fulanB = getU('fulan_b@andara.com'); // Mod - Andara 2
const fulanC = getU('fulan_c@andara.com'); // Admin - Andara 1
const fulanD = getU('fulan_d@andara.com'); // Admin - Andara 2

// Ambil salah satu jamaah di Kelompok Andara 2 untuk bahan testing
// Jika belum ada jamaah di kelompok ini, kita asumsikan jamaah terdaftar
let testJamaah = db.prepare("SELECT * FROM jamaah WHERE kelompok = 'Andara 2' AND desa = 'Andara' LIMIT 1;").get();

if (!testJamaah) {
  // Buat jamaah dummy jika DB kosong untuk testing
  const crypto = require('crypto');
  const dummyId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO jamaah (id, nama_lengkap, jenis_kelamin, tempat_lahir, status_kehidupan, golongan_darah, kelompok, pendidikan_terakhir, desa)
    VALUES (?, 'Jamaah Uji', 'Laki-laki', 'Andara', 'Hidup', 'O', 'Andara 2', 'SD', 'Andara');
  `).run(dummyId);
  testJamaah = db.prepare("SELECT * FROM jamaah WHERE id = ?;").get(dummyId);
  console.log("Created dummy test jamaah in group Andara 2.");
}

// Logika canModifyAttendance dari lib/auth.js (direproduksi untuk pengujian di file ini)
function canModifyAttendance(presence, user) {
  if (!user) return false;
  if (user.role === "Super Admin") return true;

  // Harus berasal dari desa yang sama
  if (user.desa !== testJamaah.desa) return false;

  // Cek peran dari user pembuat/pengubah record kehadiran
  let recorderRole = 'Member';
  if (presence.recorded_by) {
    const recorder = users.find(u => u.email === presence.recorded_by);
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
      return user.kelompok === null || user.kelompok === testJamaah.kelompok;
    } else if (user.role === 'Moderator') {
      return user.kelompok === testJamaah.kelompok;
    }
  }
  return false;
}

// Mock presence rows
const presensiKelompok = {
  jamaah_id: testJamaah.id,
  recorded_by: fulanA.email // Fulan A (Mod)
};

const presensiDesa = {
  jamaah_id: testJamaah.id,
  recorded_by: fulanC.email // Fulan C (Admin)
};

console.log("=== VERIFIKASI AKSES KEHADIRAN LANGSUNG ===");

console.log("\n1. Skenario Presensi Kelompok (Diinput oleh Moderator Fulan A):");
console.log(`- Fulan A (Mod Andara 2) -> canModify: ${canModifyAttendance(presensiKelompok, fulanA)} (Ekspektasi: true)`);
console.log(`- Fulan B (Mod Andara 2) -> canModify: ${canModifyAttendance(presensiKelompok, fulanB)} (Ekspektasi: true)`);
console.log(`- Fulan C (Admin Andara 1) -> canModify: ${canModifyAttendance(presensiKelompok, fulanC)} (Ekspektasi: false)`);
console.log(`- Fulan D (Admin Andara 2) -> canModify: ${canModifyAttendance(presensiKelompok, fulanD)} (Ekspektasi: true)`);

console.log("\n2. Skenario Presensi Desa (Diinput oleh Admin Fulan C):");
console.log(`- Fulan A (Mod Andara 2) -> canModify: ${canModifyAttendance(presensiDesa, fulanA)} (Ekspektasi: false)`);
console.log(`- Fulan B (Mod Andara 2) -> canModify: ${canModifyAttendance(presensiDesa, fulanB)} (Ekspektasi: false)`);
console.log(`- Fulan C (Admin Andara 1) -> canModify: ${canModifyAttendance(presensiDesa, fulanC)} (Ekspektasi: true)`);
console.log(`- Fulan D (Admin Andara 2) -> canModify: ${canModifyAttendance(presensiDesa, fulanD)} (Ekspektasi: true)`);

// Check if assertions are correct
const assert = (actual, expected, msg) => {
  if (actual !== expected) {
    console.error(`[ERROR] Fail: ${msg}. Expected ${expected}, got ${actual}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
  }
};

console.log("\n=== RUNNING ASSERTIONS ===");
assert(canModifyAttendance(presensiKelompok, fulanA), true, "Fulan A can modify group attendance");
assert(canModifyAttendance(presensiKelompok, fulanB), true, "Fulan B can modify group attendance");
assert(canModifyAttendance(presensiKelompok, fulanC), false, "Fulan C CANNOT modify group attendance");
assert(canModifyAttendance(presensiKelompok, fulanD), true, "Fulan D can modify group attendance");

assert(canModifyAttendance(presensiDesa, fulanA), false, "Fulan A CANNOT modify desa attendance");
assert(canModifyAttendance(presensiDesa, fulanB), false, "Fulan B CANNOT modify desa attendance");
assert(canModifyAttendance(presensiDesa, fulanC), true, "Fulan C can modify desa attendance");
assert(canModifyAttendance(presensiDesa, fulanD), true, "Fulan D can modify desa attendance");

console.log("\nSemua asersi wewenang Fulan A, B, C, D berhasil diverifikasi!");
db.close();
