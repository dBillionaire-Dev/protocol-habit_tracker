import { NextRequest, NextResponse } from "next/server";
import { runTrialReminderSweep } from "@/lib/trial-reminders";

// Triggered by Vercel Cron (see vercel.json) — NOT meant to be called by
// the client app or any user-facing flow. Vercel automatically attaches
// `Authorization: Bearer ${CRON_SECRET}` to cron-invoked requests when
// the CRON_SECRET env var is set; this route rejects anything else so a
// stray or malicious request can't trigger a mass email send.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run the trial reminder sweep.");
    return NextResponse.json({ message: "Not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTrialReminderSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Trial reminder sweep failed:", error);
    return NextResponse.json({ message: "Sweep failed" }, { status: 500 });
  }
}
