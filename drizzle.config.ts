import { defineConfig } from "drizzle-kit";

// drizzle-kit push/generate need DIRECT_DATABASE_URL (Supabase's Session
// pooler on port 5432, or the true direct connection) rather than
// DATABASE_URL (the Transaction pooler on port 6543, which is what
// lib/db.ts uses at runtime and is the right choice there for
// serverless/Vercel with many short-lived connections). The Transaction
// pooler runs in pgbouncer's transaction mode, which does NOT support
// prepared statements — drizzle-kit's schema introspection needs the
// extended query protocol, so pointing push/generate at port 6543
// doesn't error clearly, it just hangs on "Pulling schema from
// database..." and eventually dies with an unhelpful generic exit code.
//
// Falls back to DATABASE_URL if DIRECT_DATABASE_URL isn't set, so this
// doesn't break for anyone not on Supabase's pooler setup at all (a
// plain direct Postgres URL in DATABASE_URL works fine for push either
// way) — but on Supabase specifically, set DIRECT_DATABASE_URL to the
// Session pooler (same host, port 5432) or the direct connection string
// from Project Settings -> Database -> Connection string.
const pushUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!pushUrl) {
  throw new Error(
    "DIRECT_DATABASE_URL (preferred) or DATABASE_URL must be set, ensure the database is provisioned",
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: pushUrl,
  },
});
