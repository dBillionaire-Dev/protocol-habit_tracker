import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";

// No request body anymore — accepting no longer asks the partner to
// pick or create a habit themselves. storage.acceptPartnership
// auto-creates a fresh Build habit for them, cloned from the
// initiator's habit's CONFIG only (name/task/unit/schedule), never its
// accumulated streak or debt. See that method's comment for the full
// reasoning.
//
// Still deliberately does NOT check the accepting user's own plan —
// anyone can accept; whether shared tracking is actually ACTIVE (both
// parties currently Pro/Premium Plus) is decided separately per-request
// in storage.getPartnershipsForUser's sharedTrackingActive flag, so a
// partner without Pro/Premium Plus yet isn't blocked from accepting —
// they just see it as "not active" until both are eligible, rather than
// being refused outright.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const partnership = await storage.acceptPartnership(Number(id), user.id);
    return NextResponse.json(partnership);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to accept invite." },
      { status: 400 },
    );
  }
}
