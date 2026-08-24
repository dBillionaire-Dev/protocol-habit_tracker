import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";

// GET /api/partnerships — every partnership this user is party to,
// either as the initiator or the invited partner (see
// storage.getPartnershipsForUser). Not available in guest mode — a
// partnership links two real, persistent accounts, and guest habits
// live only in the browser's own localStorage with nothing server-side
// to link against.
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const partnerships = await storage.getPartnershipsForUser(user.id);
  return NextResponse.json(partnerships);
}
