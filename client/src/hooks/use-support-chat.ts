"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ChatMessage } from "@/lib/gemini-types";

export function useSendChatMessage() {
  return useMutation({
    mutationFn: async (messages: ChatMessage[]) => {
      const res = await apiFetch("/api/support/chat", {
        method: "POST",
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || "Failed to send message") as Error & { code?: string };
        err.code = data.code;
        throw err;
      }
      return data as { reply: string };
    },
  });
}
