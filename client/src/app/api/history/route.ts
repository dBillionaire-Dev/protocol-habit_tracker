import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { buildHistoryEntries } from "@/lib/history";
import type { AnalyticsRange, HistoryStatus } from "@/lib/analytics-types";

const VALID_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "6m", "1y", "all"];
const BASIC_RANGES: AnalyticsRange[] = ["7d", "30d"]; // what "Basic history" (Free) allows
const VALID_STATUSES: HistoryStatus[] = ["completed", "missed", "clean", "violation"];

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a free account to view history.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  const hasFull = hasFeature(plan, "full_history");

  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range") ?? "30d";
  let range = (VALID_RANGES as string[]).includes(rangeParam)
    ? (rangeParam as AnalyticsRange)
    : "30d";

  // Free plan gets "Basic history" only — a short, unfiltered window.
  // Pro/Premium Plus get every range plus filtering.
  if (!hasFull) {
    if (!(BASIC_RANGES as string[]).includes(range)) {
      return NextResponse.json(
        { message: "That range is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
        { status: 403 },
      );
    }
  }

  const habitIdParam = params.get("habitId");
  const typeParam = params.get("type");
  const statusParam = params.get("status");

  if (!hasFull && (habitIdParam || typeParam || statusParam)) {
    return NextResponse.json(
      { message: "Filtering history is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const habitId = habitIdParam ? Number(habitIdParam) : undefined;
  if (habitId !== undefined) {
    const habit = await storage.getHabit(habitId);
    if (!habit || habit.userId !== user.id) {
      return NextResponse.json({ message: "Habit not found" }, { status: 404 });
    }
  }

  const type = typeParam === "build" || typeParam === "avoidance" ? typeParam : undefined;
  const status = (VALID_STATUSES as string[]).includes(statusParam ?? "")
    ? (statusParam as HistoryStatus)
    : undefined;

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? "50") || 50));

  const allEntries = await buildHistoryEntries(user.id, { range, habitId, type, status });
  const total = allEntries.length;
  const start = (page - 1) * pageSize;
  const entries = allEntries.slice(start, start + pageSize);

  return NextResponse.json({ entries, total, page, pageSize, hasFull });
}
