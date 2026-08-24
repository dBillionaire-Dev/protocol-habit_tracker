import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/admin/guard";
import { getTicket } from "@/lib/support-tickets";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAnyAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticket = await getTicket(Number(id));
  if (!ticket) return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  return NextResponse.json(ticket);
}
