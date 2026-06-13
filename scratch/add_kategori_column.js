const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');
const db = new Database(dbPath);

console.log("Starting column migration...");

try {
  // Check if kategori column already exists
  const info = db.prepare("PRAGMA table_info(jamaah);").all();
  const exists = info.some(col => col.name === 'kategori');

  if (!exists) {
    db.prepare(`
      ALTER TABLE jamaah 
      ADD COLUMN kategori TEXT NOT NULL DEFAULT 'Dewasa' 
      CHECK(kategori IN ('Balita', 'CBR/PAUD', 'Pra Remaja', 'Remaja', 'Pra Nikah', 'Dewasa', 'Lansia'));
    `).run();
    console.log("Added column 'kategori' with CHECK constraint to table 'jamaah'.");

    // Set j_3 (Roni Santoso) to 'CBR/PAUD' as a kid
    db.prepare("UPDATE jamaah SET kategori = 'CBR/PAUD' WHERE id = 'j_3';").run();
    console.log("Updated j_3 (Roni Santoso) category to 'CBR/PAUD'.");
  } else {
    console.log("Column 'kategori' already exists.");
  }

  console.log("Migration completed successfully!");
} catch (err) {
  console.error("Migration failed:", err);
} finally {
  db.close();
}
