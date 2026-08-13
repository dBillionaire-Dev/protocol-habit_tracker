// Server-only Paystack helper. Never import this from a "use client"
// component — PAYSTACK_SECRET_KEY must never reach the browser.

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY must be set. Find it in your Paystack dashboard " +
        "under Settings -> API Keys & Webhooks.",
    );
  }
  return key;
}

async function paystackFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await res.json();
  if (!res.ok || body.status === false) {
    throw new Error(body.message || `Paystack request failed: ${path}`);
  }
  return body.data as T;
}

interface InitializeTransactionResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * Starts a subscription checkout. Paystack's model: you initialize a
 * transaction against a Plan (not a raw amount) and it handles creating
 * the customer + subscription automatically once the charge succeeds —
 * confirmed via webhook, not this call's response.
 */
export async function initializeSubscriptionTransaction(params: {
  email: string;
  planCode: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeTransactionResult> {
  return paystackFetch<InitializeTransactionResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      plan: params.planCode,
      currency: "NGN",
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string) {
  return paystackFetch<{
    status: string;
    customer: { customer_code: string; email: string };
    plan: string;
    metadata: Record<string, unknown>;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Disables (cancels) a subscription. Paystack requires both the
 * subscription code AND the customer's per-subscription "email token"
 * (returned when the subscription was created) — not the account's API
 * key alone — as a safeguard against arbitrary cancellation.
 */
export async function disableSubscription(params: {
  subscriptionCode: string;
  emailToken: string;
}): Promise<void> {
  await paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({
      code: params.subscriptionCode,
      token: params.emailToken,
    }),
  });
}

/**
 * Verifies the `x-paystack-signature` header on incoming webhooks.
 * Paystack signs the raw request body with your secret key (HMAC
 * SHA512) — this must be checked before trusting ANY webhook payload,
 * since the endpoint is publicly reachable.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const crypto = await import("crypto");
  const hash = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");

  return hash === signatureHeader;
}
