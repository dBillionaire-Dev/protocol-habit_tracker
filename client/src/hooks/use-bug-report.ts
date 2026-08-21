"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface BugReportInput {
  subject: string;
  category: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
}

// POST /api/support/bug-report (spec section 11) — actually sends and
// persists the report server-side, replacing the old mailto:-link
// approach which relied on the visitor having a configured mail client
// and manually pressing send themselves.
export function useSubmitBugReport() {
  return useMutation({
    mutationFn: async (input: BugReportInput) => {
      const res = await apiFetch("/api/support/bug-report", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          // Page and browser info the server can't otherwise know —
          // collected here, not from any cookie/header/auth state, and
          // never includes query params or fragments (just the route).
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit report");
      return data as { id: number };
    },
  });
}
