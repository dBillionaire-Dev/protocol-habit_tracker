import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { listAuditLog } from "@/lib/admin/storage";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 50;

  const { rows, total } = await listAuditLog(limit, (page - 1) * limit);
  return NextResponse.json({ rows, total, page, pageSize: limit });
}
