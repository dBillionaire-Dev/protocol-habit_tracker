"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — used in Client Components (login screens,
// the useAuth hook) to kick off Google OAuth and read the current session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
