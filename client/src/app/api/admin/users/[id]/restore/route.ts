import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { restoreUser, getUserDetail, logAdminAction } from "@/lib/admin/storage";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const target = await getUserDetail(id);
  if (!target) return NextResponse.json({ message: "User not found" }, { status: 404 });

  await restoreUser(id);
  await logAdminAction(admin, "user.restore", "user", id, `Restored ${target.user.email ?? id}`);

  return NextResponse.json({ status: "active" });
}
