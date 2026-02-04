import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/protocol",
});

export const db = drizzle(pool, {
  schema: {
    users: require("../types/auth").users,
    sessions: require("../types/auth").sessions,
    habits: require("../types/schema").habits,
    habitEvents: require("../types/schema").habitEvents,
    dailyHabitStatus: require("../types/schema").dailyHabitStatus,
    habitDebts: require("../types/schema").habitDebts,
  },
});
