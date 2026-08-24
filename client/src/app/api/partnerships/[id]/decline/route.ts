import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const partnership = await storage.declinePartnership(Number(id), user.id);
    return NextResponse.json(partnership);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to decline invite." },
      { status: 400 },
    );
  }
}
