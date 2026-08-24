"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminEntry {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "super_admin" | "support_admin";
  source: "env" | "database";
}

async function fetchAdmins(): Promise<AdminEntry[]> {
  const res = await fetch("/api/admin/admins", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load admins");
  return res.json();
}

export default function AdminAdminsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admins"], queryFn: fetchAdmins });
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to grant access");
      }
      return res.json();
    },
    onSuccess: () => {
      setEmail("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/admins/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admins"] }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold tracking-tight">Admins</h1>
      <p className="text-sm text-muted-foreground">
        Super Admins are controlled by the <code>SUPER_USER_EMAILS</code> env var and can&apos;t be revoked here
        -- they only appear below once they&apos;ve signed in at least once. Support Admins are granted below and
        can see Overview, Users (read-only), and Support.
      </p>

      <div className="flex gap-2 max-w-md">
        <Input
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={() => grantMutation.mutate()} disabled={!email.trim() || grantMutation.isPending}>
          Grant Support Admin
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No admins yet.
                </td>
              </tr>
            )}
            {data?.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-2">{[a.firstName, a.lastName].filter(Boolean).join(" ") || "\u2014"}</td>
                <td className="px-4 py-2 text-muted-foreground">{a.email ?? "\u2014"}</td>
                <td className="px-4 py-2">
                  <Badge variant={a.role === "super_admin" ? "default" : "secondary"}>
                    {a.role === "super_admin" ? "Super Admin" : "Support Admin"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {a.source === "database" && (
                    <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(a.id)}>
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
