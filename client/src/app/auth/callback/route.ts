import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storage } from "@/lib/storage";

// Supabase redirects here after Google OAuth with a `code` query param.
// Exchanging it sets the session cookie via our server client, so the
// rest of the app (Route Handlers, Server Components) just sees a logged
// in user — no tokens ever touch the browser's JS.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        // Supabase Auth is supposed to automatically link a new Google
        // identity to an existing account with the same (verified) email,
        // reusing the same user id. If that linking didn't happen — most
        // commonly because the existing email/password account's email
        // was never confirmed — we'd otherwise silently end up with two
        // separate accounts for the same person. Treat that as a
        // conflict instead of letting it through.
        const existing = await storage.getUserByEmail(user.email.toLowerCase());
        if (existing && existing.id !== user.id && existing.provider !== "google") {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/?error=email_used_with_password`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}
