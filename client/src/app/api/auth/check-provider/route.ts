import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

// Lets the client check, before committing to a signup/login attempt,
// whether an email is already registered and with which provider. Used to
// stop someone from creating a second account with a different sign-in
// method for an email that's already in use — and to give a clearer error
// than Supabase's generic "invalid credentials" when that happens.
//
// Doesn't leak anything sensitive: just { exists, provider }, no way to
// enumerate passwords or other account details.
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ message: "email is required" }, { status: 400 });
  }

  const existing = await storage.getUserByEmail(email.toLowerCase().trim());
  return NextResponse.json({
    exists: !!existing,
    provider: existing?.provider ?? null,
  });
}
