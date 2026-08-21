import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { replyToTicket } from "@/lib/support-tickets";
import { logAdminAction } from "@/lib/admin/storage";

const inputSchema = z.object({ message: z.string().min(1).max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "A reply message is required" }, { status: 400 });
  }

  const ticket = await replyToTicket(Number(id), parsed.data.message, admin.email ?? "admin");
  await logAdminAction(admin, "support.reply", "support_ticket", id, "Replied and marked resolved");

  return NextResponse.json(ticket);
}
