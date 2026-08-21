import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { adminSetUserPlan, getUserDetail, logAdminAction } from "@/lib/admin/storage";

// Hardcoded here rather than imported from shared/schema so this route
// doesn't depend on the exact export name of the plan-tier enum there --
// if that ever changes, this route keeps working.
const inputSchema = z.object({
  plan: z.enum(["free", "pro", "premium_plus"]),
  billingInterval: z.enum(["monthly", "annual"]).nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const target = await getUserDetail(id);
  if (!target) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "plan and billingInterval are required" }, { status: 400 });
  }
  const { plan, billingInterval } = parsed.data;
  if (plan !== "free" && !billingInterval) {
    return NextResponse.json({ message: "billingInterval is required for a paid plan" }, { status: 400 });
  }

  await adminSetUserPlan(id, plan, plan === "free" ? null : billingInterval);
  await logAdminAction(
    admin,
    "user.change_plan",
    "user",
    id,
    `Set plan to ${plan}${billingInterval ? ` (${billingInterval})` : ""} for ${target.user.email ?? id} -- local override, not a real Paystack subscription`,
  );

  return NextResponse.json({ plan, billingInterval });
}
