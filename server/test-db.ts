// test-db.ts

import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("SUCCESS");
    console.log(result.rows[0]);
  } catch (err) {
    console.error("FAILED");
    console.error(err);
  } finally {
    await pool.end();
  }
})();
