"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminUserRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  plan: string;
  status: string;
  habitCount: number;
  createdAt: string;
}

async function fetchUsers(search: string, status: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  if (status !== "all") params.set("status", status);
  const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load users");
  return res.json() as Promise<{ rows: AdminUserRow[]; total: number; pageSize: number }>;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, status, page],
    queryFn: () => fetchUsers(search, status, page),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold tracking-tight">Users</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Habits</th>
              <th className="text-left px-4 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
            {data?.rows.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2">
                  <Link href={`/admin/users/${u.id}`} className="hover:underline">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "\u2014"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{u.email ?? "\u2014"}</td>
                <td className="px-4 py-2 capitalize">{u.plan.replace("_", " ")}</td>
                <td className="px-4 py-2">
                  <Badge variant={u.status === "suspended" ? "destructive" : "secondary"}>{u.status}</Badge>
                </td>
                <td className="px-4 py-2 font-mono">{u.habitCount}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            className="px-3 py-1 border border-border rounded disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            className="px-3 py-1 border border-border rounded disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
