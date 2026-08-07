import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { showOnboarding } = await request.json();

    if (user.id === GUEST_USER_ID) {
      // Guest is stateless — just echo back what was sent.
      return NextResponse.json({ showOnboarding });
    }

    await storage.updateUserPreferences(user.id, { showOnboarding });
    return NextResponse.json({ showOnboarding });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { message: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
