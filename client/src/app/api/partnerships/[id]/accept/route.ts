import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({ habitId: z.number().int() });

// Deliberately does NOT check the accepting user's own plan — anyone
// can accept an invite and link their habit; whether shared tracking is
// actually ACTIVE (both parties currently Pro/Premium Plus) is decided
// separately per-request in storage.getPartnershipsForUser's
// sharedTrackingActive flag, so a partner without Pro/Premium Plus
// yet isn't blocked from accepting — they just see it as "not active"
// until they (or the initiator) are both eligible, rather than being
// refused outright.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: z.infer<typeof input>;
  try {
    body = input.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "Choose one of your Build protocols to link." }, { status: 400 });
  }

  try {
    const partnership = await storage.acceptPartnership(Number(id), user.id, body.habitId);
    return NextResponse.json(partnership);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to accept invite." },
      { status: 400 },
    );
  }
}
