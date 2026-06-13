import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.ASA_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: Environment variable ASA_DATABASE_URL or DATABASE_URL is not defined.");
}

const db = new Pool({
  connectionString: connectionString,
});

export default db;
