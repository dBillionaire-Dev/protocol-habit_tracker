import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { getHabitAnalytics } from "@/lib/admin/storage";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const analytics = await getHabitAnalytics();
  return NextResponse.json(analytics);
}
