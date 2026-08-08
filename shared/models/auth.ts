import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

// Profile table. Rows here are keyed 1:1 with Supabase's `auth.users.id`
// (a uuid). Supabase Auth owns credentials/identities; this table only
// holds the app-specific profile fields we care about.
//
// Note: there is no formal cross-schema FK to auth.users here because
// Drizzle migrations don't manage the `auth` schema. Rows are created via
// upsert the first time a verified user hits the API (see
// server/middleware/require-user.ts), so referential integrity is
// enforced in application code rather than the database.
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // matches auth.users.id (uuid as text)
  email: varchar("email").unique(),
  provider: varchar("provider").default("email"), // "email", "google", "guest"
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  showOnboarding: varchar("show_onboarding").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
