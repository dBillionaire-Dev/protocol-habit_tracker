import { NextResponse } from "next/server";
import { requireAdmin, requireAnyAdmin } from "@/lib/admin/guard";
import { getUserDetail, logAdminAction } from "@/lib/admin/storage";
import { storage } from "@/lib/storage";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const admin = await requireAnyAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) return NextResponse.json({ message: "User not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ message: "You can't delete your own account from here" }, { status: 400 });
  }

  const target = await getUserDetail(id);
  if (!target) return NextResponse.json({ message: "User not found" }, { status: 404 });

  await storage.deleteUserAccount(id);
  await logAdminAction(admin, "user.delete", "user", id, `Deleted account for ${target.user.email ?? id}`);

  return new NextResponse(null, { status: 204 });
}
