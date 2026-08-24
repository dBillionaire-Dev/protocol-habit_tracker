import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { revokeSupportAdmin, logAdminAction } from "@/lib/admin/storage";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await revokeSupportAdmin(id);
  await logAdminAction(admin, "admin.revoke_support_admin", "user", id, "Revoked Support Admin");

  return new NextResponse(null, { status: 204 });
}
