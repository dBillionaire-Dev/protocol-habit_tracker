import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { NOTIFICATION_CATEGORIES } from "shared/schema";
import { z } from "zod";

const updateSchema = z.object(
  Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, z.boolean().optional()])),
);

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const prefs = await storage.getNotificationPreferences(user.id);
  return NextResponse.json(prefs);
}

export async function PATCH(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let updates: z.infer<typeof updateSchema>;
  try {
    updates = updateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid preferences." }, { status: 400 });
  }

  const updated = await storage.updateNotificationPreferences(user.id, updates);
  return NextResponse.json(updated);
}
