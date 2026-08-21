"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Ticket {
  id: number;
  email: string | null;
  category: string;
  subject: string;
  message: string;
  status: "open" | "pending" | "resolved";
  adminReply: string | null;
  repliedByEmail: string | null;
  repliedAt: string | null;
  createdAt: string;
}

async function fetchTicket(id: string): Promise<Ticket> {
  const res = await fetch(`/api/admin/support/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load ticket");
  return res.json();
}

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-ticket", id], queryFn: () => fetchTicket(id) });
  const [reply, setReply] = useState("");

  useEffect(() => {
    if (data?.adminReply) setReply(data.adminReply);
  }, [data?.adminReply]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-ticket", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-support"] });
  };

  const replyMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/support/${id}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      }),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/admin/support/${id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{data.subject}</h1>
        <Select value={data.status} onValueChange={(v) => statusMutation.mutate(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{data.category}</Badge>
        <span>{data.email ?? "No email provided"}</span>
        <span>&middot; {new Date(data.createdAt).toLocaleString()}</span>
      </div>

      <div className="border border-border rounded-md p-4 text-sm whitespace-pre-wrap">{data.message}</div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {data.adminReply ? "Reply (sent)" : "Reply"}
        </h2>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write a reply..."
          rows={5}
        />
        {data.repliedAt && (
          <p className="text-xs text-muted-foreground">
            Last replied by {data.repliedByEmail} on {new Date(data.repliedAt).toLocaleString()}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => replyMutation.mutate()}
          disabled={replyMutation.isPending || !reply.trim()}
        >
          Send reply
        </Button>
        <p className="text-xs text-muted-foreground">
          Sending a reply here marks the ticket resolved -- this doesn&apos;t email the user automatically; copy
          the reply into an email if this ticket has a real address.
        </p>
      </section>
    </div>
  );
}
