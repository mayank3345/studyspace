import { Pool } from 'pg';

/** Shared Neon pool. Imported after server.ts loads the root .env file. */
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
