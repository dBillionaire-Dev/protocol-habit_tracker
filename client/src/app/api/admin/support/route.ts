import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { listTickets, getTicketCountsByStatus } from "@/lib/support-tickets";
import type { TicketStatus } from "shared/schema";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") as TicketStatus | null) ?? undefined;

  const [tickets, counts] = await Promise.all([listTickets(status), getTicketCountsByStatus()]);
  return NextResponse.json({ tickets, counts });
}
