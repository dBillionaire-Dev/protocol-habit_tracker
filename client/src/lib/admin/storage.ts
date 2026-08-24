import { db } from "@/lib/db";
import {
  users,
  subscriptions,
  habits,
  habitDebts,
  dailyHabitStatus,
  buildDebtRepayments,
  referrals,
  referralRewards,
  adminAuditLog,
  systemEvents,
  type User,
  type Subscription,
  type PlanTier,
  type UserStatus,
  type AdminAuditLogEntry,
} from "shared/schema";
import type { AdminRole } from "./guard";
import { eq, and, desc, count, sum, sql, gte, ne, ilike, or, inArray } from "drizzle-orm";
import { DISPLAY_PRICING } from "@/lib/paystack/plans";

function startOfDay(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function monthlyValue(plan: Exclude<PlanTier, "free">, interval: "monthly" | "annual"): number {
  const pricing = DISPLAY_PRICING[plan];
  return interval === "monthly" ? pricing.monthly : Math.round(pricing.annual / 12);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface OverviewStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  newUsersMonth: number;
  freeUsers: number;
  proUsers: number;
  premiumPlusUsers: number;
  cancelledSubscriptions: number;
  referralSignups: number;
  avgHabitsPerUser: number;
  mrr: number;
  arr: number;
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const [[{ totalUsers }], [{ newToday }], [{ newWeek }], [{ newMonth }], [{ totalHabits }], [{ referralSignups }], [{ cancelledSubscriptions }]] =
    await Promise.all([
      db.select({ totalUsers: count() }).from(users),
      db.select({ newToday: count() }).from(users).where(gte(users.createdAt, startOfDay(0))),
      db.select({ newWeek: count() }).from(users).where(gte(users.createdAt, startOfDay(7))),
      db.select({ newMonth: count() }).from(users).where(gte(users.createdAt, startOfDay(30))),
      db.select({ totalHabits: count() }).from(habits),
      db.select({ referralSignups: count() }).from(users).where(sql`${users.referredByUserId} IS NOT NULL`),
      db.select({ cancelledSubscriptions: count() }).from(subscriptions).where(eq(subscriptions.status, "cancelled")),
    ]);

  const activePaid = await db
    .select({ plan: subscriptions.plan, billingInterval: subscriptions.billingInterval })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), ne(subscriptions.plan, "free")));

  let proUsers = 0;
  let premiumPlusUsers = 0;
  let mrr = 0;
  for (const row of activePaid) {
    if (row.plan === "pro") proUsers++;
    if (row.plan === "premium_plus") premiumPlusUsers++;
    if (row.plan !== "free" && row.billingInterval) {
      mrr += monthlyValue(row.plan as Exclude<PlanTier, "free">, row.billingInterval);
    }
  }

  return {
    totalUsers,
    newUsersToday: newToday,
    newUsersWeek: newWeek,
    newUsersMonth: newMonth,
    freeUsers: Math.max(0, totalUsers - proUsers - premiumPlusUsers),
    proUsers,
    premiumPlusUsers,
    cancelledSubscriptions,
    referralSignups,
    avgHabitsPerUser: totalUsers > 0 ? Math.round((totalHabits / totalUsers) * 10) / 10 : 0,
    mrr,
    arr: mrr * 12,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface AdminUserRow extends User {
  plan: PlanTier;
  subscriptionStatus: Subscription["status"] | null;
  habitCount: number;
}

export async function listUsers(params: {
  search?: string;
  status?: UserStatus;
  limit: number;
  offset: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const conditions = [];
  if (params.search) {
    const term = `%${params.search}%`;
    conditions.push(or(ilike(users.email, term), ilike(users.firstName, term), ilike(users.lastName, term)));
  }
  if (params.status) {
    conditions.push(eq(users.status, params.status));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        user: users,
        subPlan: subscriptions.plan,
        subStatus: subscriptions.status,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  const userIds = rows.map((r) => r.user.id);
  const habitCounts = userIds.length
    ? await db
        .select({ userId: habits.userId, habitCount: count() })
        .from(habits)
        .where(inArray(habits.userId, userIds))
        .groupBy(habits.userId)
    : [];
  const habitCountMap = new Map(habitCounts.map((h) => [h.userId, h.habitCount]));

  return {
    rows: rows.map((r) => ({
      ...r.user,
      plan: (r.subStatus === "active" ? r.subPlan : "free") ?? "free",
      subscriptionStatus: r.subStatus,
      habitCount: habitCountMap.get(r.user.id) ?? 0,
    })),
    total,
  };
}

export interface AdminUserDetail {
  user: User;
  subscription: Subscription | null;
  habitCount: number;
  longestStreak: number;
  referredBy: { id: string; email: string | null } | null;
  referralCount: number;
}

export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return null;

  const [subscription, habitRows, referredByRows, [{ referralCount }]] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, id)).then((r) => r[0] ?? null),
    db.select({ streak: habits.longestStreak }).from(habits).where(eq(habits.userId, id)),
    user.referredByUserId
      ? db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, user.referredByUserId))
      : Promise.resolve([]),
    db.select({ referralCount: count() }).from(referrals).where(eq(referrals.referrerId, id)),
  ]);

  return {
    user,
    subscription,
    habitCount: habitRows.length,
    longestStreak: habitRows.reduce((max, h) => Math.max(max, h.streak), 0),
    referredBy: referredByRows[0] ?? null,
    referralCount,
  };
}

export async function suspendUser(id: string): Promise<void> {
  await db.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, id));
}

export async function restoreUser(id: string): Promise<void> {
  await db.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, id));
}

/**
 * Admin override of a user's plan. This only changes what this app thinks
 * the user's plan is -- it does NOT create, modify, or cancel anything in
 * Paystack. Use for comps/support fixes, never as a way to grant paid
 * access without a real subscription behind it (the next real Paystack
 * webhook for this user will overwrite whatever's set here).
 */
export async function adminSetUserPlan(
  id: string,
  plan: PlanTier,
  interval: "monthly" | "annual" | null,
): Promise<void> {
  await db
    .insert(subscriptions)
    .values({
      userId: id,
      plan,
      billingInterval: interval,
      status: plan === "free" ? "cancelled" : "active",
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan,
        billingInterval: interval,
        status: plan === "free" ? "cancelled" : "active",
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Subscriptions / revenue
// ---------------------------------------------------------------------------

export interface SubscriptionStats {
  mrr: number;
  arr: number;
  mrrByPlan: { pro: number; premium_plus: number };
  newSubscriptions30d: number;
  cancellations30d: number;
  failedPayments30d: number;
}

export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  const activePaid = await db
    .select({ plan: subscriptions.plan, billingInterval: subscriptions.billingInterval })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), ne(subscriptions.plan, "free")));

  const mrrByPlan = { pro: 0, premium_plus: 0 };
  for (const row of activePaid) {
    if (row.plan !== "free" && row.billingInterval) {
      mrrByPlan[row.plan as "pro" | "premium_plus"] += monthlyValue(
        row.plan as "pro" | "premium_plus",
        row.billingInterval,
      );
    }
  }
  const mrr = mrrByPlan.pro + mrrByPlan.premium_plus;

  const [[{ newSubscriptions30d }], [{ cancellations30d }], [{ failedPayments30d }]] = await Promise.all([
    db
      .select({ newSubscriptions30d: count() })
      .from(subscriptions)
      .where(and(ne(subscriptions.plan, "free"), gte(subscriptions.createdAt, startOfDay(30)))),
    db
      .select({ cancellations30d: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "cancelled"), gte(subscriptions.updatedAt, startOfDay(30)))),
    db
      .select({ failedPayments30d: count() })
      .from(systemEvents)
      .where(and(eq(systemEvents.source, "billing_webhook"), gte(systemEvents.createdAt, startOfDay(30)))),
  ]);

  return { mrr, arr: mrr * 12, mrrByPlan, newSubscriptions30d, cancellations30d, failedPayments30d };
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export interface ReferralStats {
  totalReferrals: number;
  converted: number;
  conversionRate: number;
  totalRewardsGranted: number;
  totalBonusDaysGranted: number;
  topReferrers: { userId: string; email: string | null; referralCount: number }[];
}

export async function getReferralStats(): Promise<ReferralStats> {
  const [[{ totalReferrals }], [{ converted }], [{ totalRewardsGranted, totalBonusDaysGranted }], topReferrers] =
    await Promise.all([
      db.select({ totalReferrals: count() }).from(referrals),
      db
        .select({ converted: count() })
        .from(referrals)
        .where(sql`${referrals.status} IN ('qualified', 'paid')`),
      db
        .select({
          totalRewardsGranted: count(),
          totalBonusDaysGranted: sql<number>`COALESCE(SUM(${referralRewards.daysGranted}), 0)`.mapWith(Number),
        })
        .from(referralRewards),
      db
        .select({ userId: referrals.referrerId, email: users.email, referralCount: count() })
        .from(referrals)
        .innerJoin(users, eq(users.id, referrals.referrerId))
        .groupBy(referrals.referrerId, users.email)
        .orderBy(desc(count()))
        .limit(10),
    ]);

  return {
    totalReferrals,
    converted,
    conversionRate: totalReferrals > 0 ? Math.round((converted / totalReferrals) * 1000) / 10 : 0,
    totalRewardsGranted,
    totalBonusDaysGranted,
    topReferrers,
  };
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

export interface SystemHealth {
  dbOk: boolean;
  eventsBySource: { source: string; level: string; count: number }[];
  recentEvents: { id: number; source: string; level: string; message: string; createdAt: Date }[];
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [eventsBySource, recentEvents] = await Promise.all([
    db
      .select({ source: systemEvents.source, level: systemEvents.level, count: count() })
      .from(systemEvents)
      .where(gte(systemEvents.createdAt, startOfDay(1)))
      .groupBy(systemEvents.source, systemEvents.level),
    db.select().from(systemEvents).orderBy(desc(systemEvents.createdAt)).limit(25),
  ]);

  return { dbOk: true, eventsBySource, recentEvents };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function logAdminAction(
  admin: { id: string; email: string | null },
  action: string,
  targetType: string,
  targetId: string,
  details?: string,
): Promise<void> {
  await db.insert(adminAuditLog).values({
    adminUserId: admin.id,
    adminEmail: admin.email ?? "unknown",
    action,
    targetType,
    targetId,
    details,
  });
}

export async function listAuditLog(limit: number, offset: number): Promise<{ rows: AdminAuditLogEntry[]; total: number }> {
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(adminAuditLog),
  ]);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// Habit analytics
// ---------------------------------------------------------------------------
// Aggregate, product-level numbers only -- never surfaces an individual
// user's habit names, notes, or history here. See lib/admin/storage.ts's
// getUserDetail for the one place a specific user's habit *count* (not
// content) is shown, gated behind opening that user's own detail page.

export interface HabitAnalytics {
  avgHabitsPerUser: number;
  avgCompletionRate: number; // build habits only -- % of logged days completed
  avgStreak: number; // days, across all habits of both types
  buildPercent: number;
  avoidancePercent: number;
  usersWithActiveDebtPercent: number;
}

export async function getHabitAnalytics(): Promise<HabitAnalytics> {
  const [[{ totalUsers }], [{ totalHabits }], typeCounts, [{ avgStreak }], completionRows] = await Promise.all([
    db.select({ totalUsers: count() }).from(users),
    db.select({ totalHabits: count() }).from(habits),
    db.select({ type: habits.type, count: count() }).from(habits).groupBy(habits.type),
    db
      .select({ avgStreak: sql<number>`COALESCE(AVG(${habits.currentStreak}), 0)`.mapWith(Number) })
      .from(habits),
    db
      .select({ completed: dailyHabitStatus.completed, count: count() })
      .from(dailyHabitStatus)
      .groupBy(dailyHabitStatus.completed),
  ]);

  const buildCount = typeCounts.find((t) => t.type === "build")?.count ?? 0;
  const avoidanceCount = typeCounts.find((t) => t.type === "avoidance")?.count ?? 0;

  const completedDays = completionRows.find((r) => r.completed)?.count ?? 0;
  const totalLoggedDays = completionRows.reduce((total, r) => total + r.count, 0);

  // Active debt: avoidance habits with debtCount > 0, plus build habits
  // where missed days outstrip repayments. See buildDebtRepayments's
  // comment in shared/schema.ts for the totalMissed - totalRepaid formula
  // this mirrors exactly.
  const [avoidanceDebtRows, buildHabitRows, missedByHabit, repaidByHabit] = await Promise.all([
    db
      .select({ userId: habits.userId })
      .from(habitDebts)
      .innerJoin(habits, eq(habits.id, habitDebts.habitId))
      .where(sql`${habitDebts.debtCount} > 0`),
    db.select({ id: habits.id, userId: habits.userId }).from(habits).where(eq(habits.type, "build")),
    db
      .select({ habitId: dailyHabitStatus.habitId, missed: count() })
      .from(dailyHabitStatus)
      .where(eq(dailyHabitStatus.completed, false))
      .groupBy(dailyHabitStatus.habitId),
    db
      .select({
        habitId: buildDebtRepayments.habitId,
        repaid: sql<number>`COALESCE(SUM(${buildDebtRepayments.amount}), 0)`.mapWith(Number),
      })
      .from(buildDebtRepayments)
      .groupBy(buildDebtRepayments.habitId),
  ]);

  const missedMap = new Map(missedByHabit.map((r) => [r.habitId, r.missed]));
  const repaidMap = new Map(repaidByHabit.map((r) => [r.habitId, r.repaid]));

  const usersWithDebt = new Set<string>();
  for (const row of avoidanceDebtRows) usersWithDebt.add(row.userId);
  for (const h of buildHabitRows) {
    const missed = missedMap.get(h.id) ?? 0;
    const repaid = repaidMap.get(h.id) ?? 0;
    if (missed - repaid > 0) usersWithDebt.add(h.userId);
  }

  return {
    avgHabitsPerUser: totalUsers > 0 ? Math.round((totalHabits / totalUsers) * 10) / 10 : 0,
    avgCompletionRate: totalLoggedDays > 0 ? Math.round((completedDays / totalLoggedDays) * 1000) / 10 : 0,
    avgStreak: Math.round(avgStreak * 10) / 10,
    buildPercent: totalHabits > 0 ? Math.round((buildCount / totalHabits) * 1000) / 10 : 0,
    avoidancePercent: totalHabits > 0 ? Math.round((avoidanceCount / totalHabits) * 1000) / 10 : 0,
    usersWithActiveDebtPercent: totalUsers > 0 ? Math.round((usersWithDebt.size / totalUsers) * 1000) / 10 : 0,
  };
}

// ---------------------------------------------------------------------------
// Admin management (Super Admin only)
// ---------------------------------------------------------------------------

export interface AdminListEntry {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: AdminRole;
  // "env" admins (Super Admin via SUPER_USER_EMAILS) can't be revoked
  // from this UI -- only show up once they've actually signed in.
  source: "env" | "database";
}

export async function listAdmins(): Promise<AdminListEntry[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isSuperUser: users.isSuperUser,
      adminRole: users.adminRole,
    })
    .from(users)
    .where(sql`${users.isSuperUser} = true OR ${users.adminRole} IS NOT NULL`);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.isSuperUser ? "super_admin" : "support_admin",
    source: r.isSuperUser ? "env" : "database",
  }));
}

export async function grantSupportAdmin(userId: string): Promise<void> {
  await db.update(users).set({ adminRole: "support_admin", updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function revokeSupportAdmin(userId: string): Promise<void> {
  await db.update(users).set({ adminRole: null, updatedAt: new Date() }).where(eq(users.id, userId));
}
