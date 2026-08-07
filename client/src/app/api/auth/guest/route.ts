import { NextResponse } from "next/server";
import { GUEST_USER_ID } from "@/lib/auth/require-user";

// Guest mode is fully stateless: no cookie, no DB row. The client just
// remembers it's in guest mode and sends `X-Guest-Mode: true` on
// subsequent requests.
export async function POST() {
  return NextResponse.json({
    id: GUEST_USER_ID,
    email: "guest@demo.app",
    firstName: "Guest",
    lastName: "User",
    profileImageUrl: null,
    provider: "guest",
  });
}
