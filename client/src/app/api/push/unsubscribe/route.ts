import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({ endpoint: z.string().url() });

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = input.parse(await request.json());
    // Deliberately not ownership-checked against `user` — deleting by
    // endpoint alone is safe (an endpoint is an unguessable per-device
    // URL, not something one user could target for another), and this
    // keeps unsubscribe working even if session state is momentarily
    // inconsistent with which account originally subscribed this device.
    await storage.deletePushSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
}
