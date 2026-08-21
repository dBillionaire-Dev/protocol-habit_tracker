import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { getSystemHealth } from "@/lib/admin/storage";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const health = await getSystemHealth();
    return NextResponse.json(health);
  } catch (err) {
    return NextResponse.json(
      { dbOk: false, eventsBySource: [], recentEvents: [], error: err instanceof Error ? err.message : "Unknown error" },
      { status: 200 },
    );
  }
}
