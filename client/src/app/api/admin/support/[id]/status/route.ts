import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyAdmin } from "@/lib/admin/guard";
import { setTicketStatus } from "@/lib/support-tickets";
import { logAdminAction } from "@/lib/admin/storage";

const inputSchema = z.object({ status: z.enum(["open", "pending", "resolved"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAnyAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const ticket = await setTicketStatus(Number(id), parsed.data.status);
  await logAdminAction(admin, "support.set_status", "support_ticket", id, `Status -> ${parsed.data.status}`);

  return NextResponse.json(ticket);
}
