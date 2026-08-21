import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { suspendUser, getUserDetail, logAdminAction } from "@/lib/admin/storage";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ message: "You can't suspend your own account" }, { status: 400 });
  }

  const target = await getUserDetail(id);
  if (!target) return NextResponse.json({ message: "User not found" }, { status: 404 });

  await suspendUser(id);
  await logAdminAction(admin, "user.suspend", "user", id, `Suspended ${target.user.email ?? id}`);

  return NextResponse.json({ status: "suspended" });
}
