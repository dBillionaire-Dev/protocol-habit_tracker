import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Guest user ID for demo/testing
const GUEST_USER_ID = "guest-demo-user";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");

  // Check for guest session
  const guestSession = cookieStore.get("guestSession");
  if (guestSession?.value === "true") {
    return NextResponse.json({
      id: GUEST_USER_ID,
      email: "guest@demo.app",
      firstName: "Guest",
      lastName: "User",
      profileImageUrl: null,
      showOnboarding: cookieStore.get("guestShowOnboarding")?.value !== "false" ? "true" : "false"
    });
  }

  return NextResponse.json(
    { message: "Unauthorized" },
    { status: 401 }
  );
}
