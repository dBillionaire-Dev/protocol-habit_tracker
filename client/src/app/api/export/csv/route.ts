import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { buildHistoryEntries, toCSV } from "@/lib/history";
import type { AnalyticsRange, HistoryStatus } from "@/lib/analytics-types";

const VALID_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "6m", "1y", "all"];
const VALID_STATUSES: HistoryStatus[] = ["completed", "missed", "clean", "violation"];

// Exports the current user's own Protocol history as CSV. Every query is
// scoped to storage.getHabit(...).userId === user.id before anything is
// read — there is no path here that can return another user's data.
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a free account, then upgrade to export data.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "data_export")) {
    return NextResponse.json(
      { message: "Data export is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range") ?? "all";
  const range = (VALID_RANGES as string[]).includes(rangeParam) ? (rangeParam as AnalyticsRange) : "all";

  const habitIdParam = params.get("habitId");
  const habitId = habitIdParam ? Number(habitIdParam) : undefined;
  if (habitId !== undefined) {
    const habit = await storage.getHabit(habitId);
    if (!habit || habit.userId !== user.id) {
      return NextResponse.json({ message: "Habit not found" }, { status: 404 });
    }
  }

  const typeParam = params.get("type");
  const type = typeParam === "build" || typeParam === "avoidance" ? typeParam : undefined;
  const statusParam = params.get("status");
  const status = (VALID_STATUSES as string[]).includes(statusParam ?? "")
    ? (statusParam as HistoryStatus)
    : undefined;

  const entries = await buildHistoryEntries(user.id, { range, habitId, type, status });
  const csv = toCSV(entries);
  const filename = `protocol-history-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
