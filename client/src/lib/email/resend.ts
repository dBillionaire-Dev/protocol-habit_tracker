import { Resend } from "resend";

// Thin server-only wrapper around Resend. Never imported from a client
// component — RESEND_API_KEY must never reach the browser bundle, which
// is why every caller of this lives in an API route (app/api/**), never
// in a "use client" file.
let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set — cannot send email.");
    }
    client = new Resend(apiKey);
  }
  return client;
}

// Falls back to Resend's own onboarding sender if the env var isn't set,
// so this doesn't hard-fail in a fresh environment before a custom
// domain is verified in Resend — swap RESEND_FROM_EMAIL to a
// protocol-nex.vercel.app address (or your own domain) once verified.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Protocol <onboarding@resend.dev>";

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }
}
