import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const GUEST_USER_ID = "guest-demo-user";

export async function POST(request: NextRequest) {
  const userId = GUEST_USER_ID;
  
  try {
    const body = await request.json();
    const { showOnboarding } = body;

    // For guest users, store in cookies
    const cookieStore = await cookies();
    cookieStore.set("guestShowOnboarding", showOnboarding !== "false" ? "true" : "false", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ showOnboarding: showOnboarding });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { message: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
