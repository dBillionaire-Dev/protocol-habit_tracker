import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/storage";
import type { UserStatus } from "shared/schema";

export async function GET(request: Request) {
  const admin = await requireAnyAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const status = (searchParams.get("status") as UserStatus | null) ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 25;

  const { rows, total } = await listUsers({ search, status, limit, offset: (page - 1) * limit });
  return NextResponse.json({ rows, total, page, pageSize: limit });
}
