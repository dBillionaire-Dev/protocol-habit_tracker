import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const GUEST_USER_ID = "guest-demo-user";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  
  // Set guest session cookie
  cookieStore.set("guestSession", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  cookieStore.set("guestShowOnboarding", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({
    id: GUEST_USER_ID,
    email: "guest@demo.app",
    firstName: "Guest",
    lastName: "User",
    profileImageUrl: null,
    showOnboarding: "true"
  });
}
