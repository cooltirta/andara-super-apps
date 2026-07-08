import { Pool } from 'pg';

const connectionString = process.env.ASA_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: Environment variable ASA_DATABASE_URL or DATABASE_URL is not defined.");
}

const db = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 5000, // 5 detik timeout jika gagal terhubung
  idleTimeoutMillis: 30000,      // 30 detik sebelum koneksi idle ditutup
  max: 10                         // Maksimal 10 koneksi per instance serverless
});

export default db;
