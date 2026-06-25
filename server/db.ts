// import { drizzle } from "drizzle-orm/node-postgres";
// import pg, { QueryResult } from "pg";
// import * as schema from "shared/schema";

// const { Pool } = pg;

// if (!process.env.DATABASE_URL) {
//   throw new Error(
//     "DATABASE_URL must be set. Did you forget to provision a database?",
//   );
// }

// console.log(
//   "DATABASE_URL:",
//   process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"),
// );

// // export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
//   max: 10, // Keep this bounded so Express doesn't lock Neon out
//   idleTimeoutMillis: 15000, // Drop idle clients quickly
//   connectionTimeoutMillis: 5000, // Crash fast rather than spinning indefinitely
// });

// (async () => {
//   try {
//     const result = await pool.query("SELECT NOW()");
//     console.log("✅ DB connected");
//     console.log("Server time:", result.rows[0].now);
//   } catch (err: unknown) {
//     console.error("❌ DB failed");
//     console.error(err);

//     if (err instanceof Error) {
//       console.error(err.message);
//     } else {
//       console.error(err);
//     }
//   }
// })();

// export const db = drizzle(pool, { schema });
//

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from your environment variables");
}

// 1. Establish a stateless HTTP fetch client
const sql = neon(process.env.DATABASE_URL);

// 2. Initialize Drizzle with the matching HTTP adapter
export const db = drizzle({ client: sql });
