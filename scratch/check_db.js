const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.db');
const db = new Database(dbPath);

console.log("=== USER PROFILES ===");
const users = db.prepare("SELECT * FROM user_profiles").all();
console.table(users);

console.log("\n=== SESSIONS ===");
const sessions = db.prepare("SELECT * FROM sesi_presensi").all();
console.table(sessions);
