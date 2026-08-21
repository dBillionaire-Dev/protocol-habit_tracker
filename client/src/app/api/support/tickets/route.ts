import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveUser } from "@/lib/auth/require-user";
import { createTicket } from "@/lib/support-tickets";

const inputSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  category: z.string().min(1).max(50),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 });
  }

  const ticket = await createTicket({
    userId: user.id === "guest-demo-user" ? null : user.id,
    email: parsed.data.email || user.email,
    category: parsed.data.category,
    subject: parsed.data.subject,
    message: parsed.data.message,
  });

  return NextResponse.json(ticket, { status: 201 });
}
