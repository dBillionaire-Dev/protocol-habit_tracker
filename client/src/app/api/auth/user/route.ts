import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";

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
