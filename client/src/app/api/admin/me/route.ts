import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/admin/guard";

export async function GET(request: Request) {
  const ctx = await requireAnyAdmin(request);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ email: ctx.user.email, role: ctx.role });
}
