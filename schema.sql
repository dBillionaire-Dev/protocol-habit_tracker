-- Sessions (for express-session / connect-pg-simple)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar UNIQUE,
  "password_hash" varchar,
  "provider" varchar DEFAULT 'email',
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "show_onboarding" varchar DEFAULT 'true',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Habits
CREATE TABLE IF NOT EXISTS "habits" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "type" text NOT NULL CHECK (type IN ('avoidance', 'build')),
  "base_task_value" integer,
  "unit" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "current_streak" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "last_streak_date" date,
  "current_streak_start" date,
  "longest_streak_start" date,
  "longest_streak_end" date
);

-- Habit events
CREATE TABLE IF NOT EXISTS "habit_events" (
  "id" serial PRIMARY KEY,
  "habit_id" integer NOT NULL REFERENCES "habits"("id"),
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "value" integer DEFAULT 1 NOT NULL,
  "notes" text
);

-- Daily habit status
CREATE TABLE IF NOT EXISTS "daily_habit_status" (
  "id" serial PRIMARY KEY,
  "habit_id" integer NOT NULL REFERENCES "habits"("id"),
  "date" date NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "penalty_level" integer DEFAULT 0 NOT NULL,
  "auto_processed" boolean DEFAULT false NOT NULL,
  UNIQUE ("habit_id", "date")
);

-- Habit debts
CREATE TABLE IF NOT EXISTS "habit_debts" (
  "id" serial PRIMARY KEY,
  "habit_id" integer NOT NULL UNIQUE REFERENCES "habits"("id"),
  "debt_count" integer DEFAULT 0 NOT NULL,
  "last_clean_date" date
);
