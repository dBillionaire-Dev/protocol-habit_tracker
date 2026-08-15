// Shared type for chat messages — kept import-safe (no server-only
// dependency) so it can be imported from client hooks/components without
// risk, matching the pattern used for analytics-types.ts.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
