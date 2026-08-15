// Server-only Gemini client. Never import from a "use client" component —
// GEMINI_API_KEY must never reach the browser.

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// gemini-2.0-flash was retired March 31, 2026. Configurable via env var
// so this can be updated without a code change if models are deprecated
// again — Google has moved fast on this front.
const DEFAULT_MODEL = "gemini-3.5-flash";

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  // Guards against the literal placeholder value from .env.example
  // being left in place and silently "working" with a 401 on every call.
  if (!key || key === "your_gemini_api_key_here") return null;
  return key;
}

export function isAiConfigured(): boolean {
  return getApiKey() !== null;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI features are not configured. Set GEMINI_API_KEY to enable them.");
  }
}

/**
 * Calls Gemini asking for a JSON response matching the shape the caller
 * expects, using Gemini's structured-output mode (responseMimeType:
 * "application/json") rather than asking it to "please return JSON" in
 * the prompt and hoping — this is the documented, reliable way to get
 * parseable output.
 *
 * Throws AiNotConfiguredError if no key is set — callers must handle
 * this distinctly from a real failure and NOT fabricate a fallback
 * response, per the product spec's explicit instruction.
 */
export async function generateStructured<T>(prompt: string): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      }),
    });
  } catch (err) {
    throw new Error(`Failed to reach Gemini: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini returned an unexpected response shape");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
}

export type { ChatMessage } from "./gemini-types";
import type { ChatMessage } from "./gemini-types";

/**
 * Multi-turn plain-text chat, for the AI live chat support widget.
 * Unlike generateStructured, this doesn't force JSON output — it's a
 * normal conversational reply. Uses Gemini's systemInstruction field to
 * keep the persistent context (what PROTOCOL is, FAQ knowledge,
 * boundaries) separate from the actual back-and-forth turns.
 */
export async function generateChatReply(params: {
  systemInstruction: string;
  messages: ChatMessage[];
}): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let res: Response;
  try {
    res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 500,
        },
      }),
    });
  } catch (err) {
    throw new Error(`Failed to reach Gemini: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini returned an unexpected response shape");
  }
  return text;
}
