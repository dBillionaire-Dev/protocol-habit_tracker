import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { sendPushToSubscription } from "@/lib/push";

// Triggered by Vercel Cron (see vercel.json) — spec section 15's "notify
// users when their confirmation window opens," for whoever has the app
// closed and can't get the foreground local notification (see
// LayoutShell's useConfirmationWindowForegroundNotify, which covers the
// app-open case instantly and doesn't need this cron at all).
//
// LIMITATION, stated plainly rather than glossed over: the confirmation
// window is 9:00 PM-midnight in whatever local time the rest of this
// app already assumes (no per-user timezone is stored anywhere — same
// constraint as the flexible-confirmation clientHour approach and the
// trial-reminder cron). This cron is scheduled once daily at a fixed UTC
// hour approximating 9PM WAT for that reason. Same auth pattern as
// api/cron/trial-reminders: Vercel attaches `Authorization: Bearer
// $CRON_SECRET` automatically when that env var is set.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run the confirmation-window push sweep.");
    return NextResponse.json({ message: "Not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const due = await storage.getUsersDueForConfirmationWindowPush();
    let sent = 0;
    for (const { userId, endpoint, p256dhKey, authKey } of due) {
      try {
        await sendPushToSubscription(endpoint, p256dhKey, authKey, {
          title: "Your confirmation window is open",
          body: "Confirm today's clean days before the window closes at midnight.",
          url: "/dashboard",
          tag: "confirmation-window-open",
        });
        sent += 1;
      } catch (err) {
        console.error(`Failed to send confirmation-window push for user ${userId}:`, err);
      }
      // Mark sent per-user regardless of individual send success, so one
      // failed push doesn't cause a retry storm on the next cron tick —
      // matches the same "don't let one bad target block everyone else,
      // and don't hammer it repeatedly" reasoning as the trial-reminder
      // sweep.
      await storage.markConfirmationWindowPushSent(userId);
    }
    return NextResponse.json({ ok: true, checked: due.length, sent });
  } catch (error) {
    console.error("Confirmation-window push sweep failed:", error);
    return NextResponse.json({ message: "Sweep failed" }, { status: 500 });
  }
}
