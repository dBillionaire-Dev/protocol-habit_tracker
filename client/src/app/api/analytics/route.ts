import { NextRequest, NextResponse } from "next/server";
import { resolveUser, GUEST_USER_ID } from "@/lib/auth/require-user";
import { storage } from "@/lib/storage";
import { hasFeature } from "@/lib/entitlements";
import { getAnalyticsSummary, generateInsights, type AnalyticsRange } from "@/lib/analytics";

const VALID_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "6m", "1y", "all"];

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.id === GUEST_USER_ID) {
    return NextResponse.json(
      { message: "Create a free account to access analytics.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "advanced_analytics")) {
    return NextResponse.json(
      { message: "Analytics is available on Pro and Premium Plus.", code: "FEATURE_LOCKED" },
      { status: 403 },
    );
  }

  const rangeParam = request.nextUrl.searchParams.get("range") ?? "30d";
  const range = (VALID_RANGES as string[]).includes(rangeParam)
    ? (rangeParam as AnalyticsRange)
    : "30d";

  const summary = await getAnalyticsSummary(user.id, range);
  const insights = hasFeature(plan, "advanced_insights") ? generateInsights(summary) : [];

  return NextResponse.json({ summary, insights, range });
}
