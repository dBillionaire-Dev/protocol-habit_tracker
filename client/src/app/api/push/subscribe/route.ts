import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { z } from "zod";

const input = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// Called by use-push-notifications.ts right after the browser's
// PushManager.subscribe() succeeds. Guest mode is deliberately excluded
// — a push subscription is meaningless without a persistent account to
// notify (there's no "guest inbox" to deliver to later), same reasoning
// as trials being real-account-only.
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user || user.id === GUEST_USER_ID) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof input>;
  try {
    body = input.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "Invalid subscription." }, { status: 400 });
  }

  await storage.savePushSubscription({
    userId: user.id,
    endpoint: body.endpoint,
    p256dhKey: body.keys.p256dh,
    authKey: body.keys.auth,
  });

  return NextResponse.json({ ok: true });
}
