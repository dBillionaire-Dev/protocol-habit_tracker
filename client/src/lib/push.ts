import webpush from "web-push";
import { storage } from "./storage";

// VAPID keys identify OUR server to browsers' push services — generate
// your own with `npx web-push generate-vapid-keys` and set them as env
// vars. Never commit real keys; there is no safe default here on
// purpose (unlike lib/email/resend.ts's onboarding-sender fallback,
// there's no equivalent "works out of the box" option for Web Push).
let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contactEmail = process.env.VAPID_CONTACT_EMAIL || "mailto:support@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not set — cannot send push notifications.");
  }
  webpush.setVapidDetails(contactEmail, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  // See sw.js's 'push' handler — collapses repeat notifications of the
  // same kind into one instead of stacking, and is the client-side half
  // of the "do not send duplicate notifications" requirement (the
  // server-side half is each specific sender's own dedup check, e.g.
  // storage.getUsersDueForConfirmationWindowPush's date guard).
  tag?: string;
}

// Sends to every subscribed device for this user (see the
// pushSubscriptions table comment — one row per browser/device, not per
// user), pruning any subscription the push service reports as gone
// (410 Gone / 404) rather than retrying it forever.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureConfigured();
  const subs = await storage.getPushSubscriptionsForUser(userId);
  await Promise.all(subs.map((sub) => sendToSubscription(sub.endpoint, sub.p256dhKey, sub.authKey, payload)));
}

export async function sendPushToSubscription(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  payload: PushPayload,
): Promise<void> {
  ensureConfigured();
  await sendToSubscription(endpoint, p256dhKey, authKey, payload);
}

async function sendToSubscription(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  payload: PushPayload,
): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh: p256dhKey, auth: authKey } },
      JSON.stringify(payload),
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // The push service itself says this subscription is dead (browser
      // uninstalled, site data cleared, etc.) — clean it up so future
      // sweeps stop wasting a request on it.
      await storage.deletePushSubscription(endpoint).catch(() => {});
      return;
    }
    console.error(`Failed to send push to ${endpoint}:`, err);
  }
}
