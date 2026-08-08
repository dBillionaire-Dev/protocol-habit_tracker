import { createClient } from "@supabase/supabase-js";

// Admin client — SERVER-SIDE ONLY. Uses the service role key, which
// bypasses RLS and can delete auth users outright. Never import this file
// from a "use client" component or expose SUPABASE_SERVICE_ROLE_KEY as a
// NEXT_PUBLIC_ var.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set " +
        "to perform admin actions (e.g. account deletion). Find the " +
        "service role key in Supabase Project Settings -> API — keep it " +
        "server-side only, never NEXT_PUBLIC_.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
