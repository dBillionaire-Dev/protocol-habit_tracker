import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { listAdmins, grantSupportAdmin, logAdminAction } from "@/lib/admin/storage";
import { db } from "@/lib/db";
import { users } from "shared/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listAdmins());
}

const inputSchema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  const [target] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (!target) {
    return NextResponse.json({ message: "No user with that email has signed in yet" }, { status: 404 });
  }
  if (target.isSuperUser) {
    return NextResponse.json({ message: "This user is already a Super Admin (via env config)" }, { status: 400 });
  }

  await grantSupportAdmin(target.id);
  await logAdminAction(admin, "admin.grant_support_admin", "user", target.id, `Granted Support Admin to ${target.email}`);

  return NextResponse.json({ id: target.id, email: target.email, role: "support_admin" });
}
