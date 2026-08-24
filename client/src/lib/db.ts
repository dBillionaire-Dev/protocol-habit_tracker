import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dns from "node:dns";
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
    // Some networks run DNS64/NAT64 (common on IPv6-only campus/mobile
    // networks) and hand back a synthesized IPv6 address for Supabase's
    // pooler that times out or breaks mid-TLS-handshake, even though a
    // plain IPv4 lookup to the same host works fine. Forcing IPv4 here
    // sidesteps that; harmless where this isn't an issue, and Vercel's
    // Node runtime forces IPv4 egress anyway so production is unaffected.
    lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
