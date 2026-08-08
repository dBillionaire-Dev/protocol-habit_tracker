import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (user.provider === "guest") {
    return NextResponse.json({ ...user, showOnboarding: "true" });
  }

  const dbUser = await storage.getUser(user.id);
  return NextResponse.json({
    ...user,
    showOnboarding: dbUser?.showOnboarding ?? "true",
  });
}

// Permanently deletes the current user's account: their habit data, their
// profile row, and the underlying Supabase Auth user itself. There's no
// undo. Guest mode has nothing to delete server-side (it's just a local
// browser flag), so this 400s for guests rather than pretending to do
// something.
export async function DELETE(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Guest sessions have nothing to delete — just close the tab." },
      { status: 400 },
    );
  }

  try {
    await storage.deleteUserAccount(user.id);

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Failed to delete Supabase auth user:", error);
      return NextResponse.json(
        { message: "Account data was deleted, but sign-in credentials could not be removed. Contact support." },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.json({ message: "Account deleted" });
  } catch (err) {
    console.error("Failed to delete account:", err);
    return NextResponse.json(
      { message: "Failed to delete account" },
      { status: 500 },
    );
  }
}
