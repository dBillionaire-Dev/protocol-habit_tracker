import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set to your Supabase project's Postgres " +
      "connection string (Project Settings -> Database -> Connection string).",
  );
}

// Reused across hot reloads / lambda invocations to avoid exhausting
// Supabase's connection pool. Next.js route handlers run in the same
// Node process in most deployment targets (Vercel Node runtime), so a
// module-level singleton pool is the right pattern here.
const globalForDb = globalThis as unknown as { pgPool?: pg.Pool };

export const pool =
  globalForDb.pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
