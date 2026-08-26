"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/admin/stat-card";

interface Ticket {
  id: number;
  email: string | null;
  category: string;
  subject: string;
  status: "open" | "pending" | "resolved";
  createdAt: string;
}

async function fetchTickets(status: string) {
  const params = status !== "all" ? `?status=${status}` : "";
  const res = await fetch(`/api/admin/support${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load tickets");
  return res.json() as Promise<{ tickets: Ticket[]; counts: Record<string, number> }>;
}

const statusVariant = { open: "default", pending: "secondary", resolved: "outline" } as const;

export default function AdminSupportPage() {
  const [status, setStatus] = useState("all");
  const { data, isLoading } = useQuery({ queryKey: ["admin-support", status], queryFn: () => fetchTickets(status) });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight">Support</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-sm">
        <StatCard label="Open" value={data?.counts.open ?? "\u2014"} />
        <StatCard label="Pending" value={data?.counts.pending ?? "\u2014"} />
        <StatCard label="Resolved" value={data?.counts.resolved ?? "\u2014"} />
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && data?.tickets.length === 0 && (
          <p className="text-sm text-muted-foreground">No tickets here.</p>
        )}
        {data?.tickets.map((t) => (
          <Link
            key={t.id}
            href={`/admin/support/${t.id}`}
            className="block border border-border rounded-md p-3 text-sm hover:bg-muted/50"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{t.subject}</span>
              <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>
                {t.category} &middot; {t.email ?? "no email"}
              </span>
              <span>{new Date(t.createdAt).toLocaleString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
