import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.db');
const db = new Database(dbPath);

// Enable SQLite pragmas for foreign keys and performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export default db;
