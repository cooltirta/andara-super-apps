const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, '../database.db'));
console.log(db.prepare("PRAGMA table_info(user_profiles);").all());
db.close();
