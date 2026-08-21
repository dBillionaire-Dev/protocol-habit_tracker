import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { sendEmail } from "@/lib/email/resend";
import { z } from "zod";

const BUG_CATEGORIES = ["Bug", "Crash", "Data issue", "Billing", "UI/Design", "Other"] as const;

const input = z.object({
  subject: z.string().min(1).max(200),
  category: z.enum(BUG_CATEGORIES),
  description: z.string().min(1).max(5000),
  stepsToReproduce: z.string().max(5000).optional(),
  expectedBehavior: z.string().max(2000).optional(),
  actualBehavior: z.string().max(2000).optional(),
  // Route only (e.g. "/dashboard"), never a full URL — see the
  // bugReports table comment in shared/schema.ts for why.
  page: z.string().max(200).optional(),
  userAgent: z.string().max(500).optional(),
});

// Spec section 11: previously "Report a Bug" just built a mailto: link
// and handed it to the browser — nothing was actually sent unless the
// user had a configured mail client AND manually pressed send
// themselves (the UI even said so: "nothing is sent from here
// directly"). This route does the real thing: persists the report (so
// it survives even if the email bounces, and so a future admin
// dashboard can list these without needing an inbox) and sends it via
// Resend, entirely server-side — RESEND_API_KEY never reaches the
// client, same as the trial-reminder emails.
//
// Deliberately allows guests and unauthenticated visitors to submit —
// resolveUser returning null/guest just means userId/userEmail are
// omitted from the report, not that submission is refused. Someone
// hitting a bug badly enough to report it shouldn't be blocked from
// doing so by not being logged in.
export async function POST(request: NextRequest) {
  let body: z.infer<typeof input>;
  try {
    body = input.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "Please fill in the required fields." }, { status: 400 });
  }

  const user = await resolveUser(request).catch(() => null);
  const isRealUser = !!user && user.id !== GUEST_USER_ID;

  const report = await storage.createBugReport({
    userId: isRealUser ? user!.id : null,
    userEmail: isRealUser ? (user!.email ?? null) : null,
    subject: body.subject,
    category: body.category,
    description: body.description,
    stepsToReproduce: body.stepsToReproduce ?? null,
    expectedBehavior: body.expectedBehavior ?? null,
    actualBehavior: body.actualBehavior ?? null,
    page: body.page ?? null,
    userAgent: body.userAgent ?? null,
    // Vercel automatically sets this to the deployed commit SHA — a
    // meaningful "what code was actually running" signal with zero new
    // configuration required. Falls back to null in local dev, where
    // Vercel's env vars aren't present.
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });

  const developerEmail = process.env.NEXT_PUBLIC_DEVELOPER_EMAIL;
  if (developerEmail) {
    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <h2>[Bug Report] ${escapeHtml(body.subject)}</h2>
        <p><strong>Category:</strong> ${escapeHtml(body.category)}</p>
        <p><strong>Reported by:</strong> ${isRealUser ? escapeHtml(user!.email ?? user!.id) : "Guest / not signed in"}</p>
        <p><strong>Page:</strong> ${escapeHtml(body.page ?? "unknown")}</p>
        <p><strong>Description:</strong><br/>${escapeHtml(body.description).replace(/\n/g, "<br/>")}</p>
        ${body.stepsToReproduce ? `<p><strong>Steps to reproduce:</strong><br/>${escapeHtml(body.stepsToReproduce).replace(/\n/g, "<br/>")}</p>` : ""}
        ${body.expectedBehavior ? `<p><strong>Expected:</strong><br/>${escapeHtml(body.expectedBehavior).replace(/\n/g, "<br/>")}</p>` : ""}
        ${body.actualBehavior ? `<p><strong>Actual:</strong><br/>${escapeHtml(body.actualBehavior).replace(/\n/g, "<br/>")}</p>` : ""}
        <p><strong>Browser/device:</strong> ${escapeHtml(body.userAgent ?? "unknown")}</p>
        <p><strong>Reported at:</strong> ${report.createdAt.toISOString()}</p>
        <p style="color:#888; font-size: 12px;">Report #${report.id}</p>
      </div>
    `;
    try {
      await sendEmail({ to: developerEmail, subject: `[Bug Report] ${body.subject}`, html });
    } catch (err) {
      // The report is already safely persisted above — an email
      // delivery hiccup shouldn't turn into a failed submission for the
      // person reporting the bug. Log it and still return success.
      console.error("Failed to send bug report email:", err);
    }
  }

  return NextResponse.json({ id: report.id });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
