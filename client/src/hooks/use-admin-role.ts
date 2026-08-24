"use client";

import { useQuery } from "@tanstack/react-query";

export interface AdminMe {
  email: string | null;
  role: "super_admin" | "support_admin";
}

export function useAdminRole() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: async (): Promise<AdminMe> => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load admin role");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}
