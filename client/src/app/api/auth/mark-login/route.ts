import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storage } from "@/lib/storage";

// Stamps users.lastLoginAt for the current session -- the client-side
// counterpart to what app/auth/callback/route.ts does for Google.
// Needed because email/password sign-in happens entirely client-side via
// supabase.auth.signInWithPassword() (see hooks/use-auth.ts), with no
// server round-trip of our own in that flow otherwise.
//
// Deliberately does NOT go through resolveUser()/require-user.ts: at the
// exact moment this is called (right after a fresh sign-in), lastLoginAt
// is still whatever it was from the PREVIOUS session -- possibly stale
// or null -- so resolveUser()'s 7-day check would reject this request
// before it ever gets a chance to set a fresh timestamp. This talks to
// Supabase directly instead, same as the OAuth callback does.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await storage.markUserLoggedIn(user.id);
  return NextResponse.json({ ok: true });
}
