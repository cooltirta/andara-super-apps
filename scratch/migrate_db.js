const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');
const db = new Database(dbPath);

console.log("Starting database migration...");

try {
  // Recreate kehadiran table
  db.prepare("DROP TABLE IF EXISTS kehadiran;").run();
  console.log("Dropped old kehadiran table.");

  db.prepare(`
    CREATE TABLE kehadiran (
      id TEXT PRIMARY KEY,
      jamaah_id TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      waktu_presensi TEXT NULL,
      status TEXT NOT NULL CHECK(status IN ('Hadir', 'Ijin', 'Tidak Hadir')),
      recorded_by TEXT NULL,
      FOREIGN KEY (jamaah_id) REFERENCES jamaah(id) ON DELETE CASCADE,
      UNIQUE(jamaah_id, tanggal)
    );
  `).run();
  console.log("Created new kehadiran table with schema: (id, jamaah_id, tanggal, waktu_presensi, status, recorded_by).");

  // Recreate sesi_presensi table (optional but good to clean up)
  db.prepare("DROP TABLE IF EXISTS sesi_presensi;").run();
  console.log("Dropped old sesi_presensi table.");

  console.log("Migration completed successfully!");
} catch (err) {
  console.error("Migration failed:", err);
} finally {
  db.close();
}
