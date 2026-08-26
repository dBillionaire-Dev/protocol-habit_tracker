import { db } from "./db";
import {
  habits, habitEvents, dailyHabitStatus, habitDebts, buildDebtRepayments,
  type InsertHabit, type Habit, type HabitEvent, type DailyHabitStatus, type HabitDebt,
  type CreateHabitRequest, type HabitWithStatus, type BuildDebtSummary, type UpdateHabitRequest,
  users, type User, type UpsertUser,
  subscriptions, type Subscription, type UpsertSubscription,
  subscriptionTrials, type SubscriptionTrial, type TrialType, TRIAL_CONFIG,
  bugReports, type BugReport, type InsertBugReport,
  pushSubscriptions, type PushSubscriptionRow, type InsertPushSubscription,
  notificationPreferences, type NotificationPreferences, type NotificationCategory,
  habitPartnerships, type HabitPartnership, type InsertHabitPartnership, type PartnershipStatus,
} from "shared/schema";
import { eq, and, or, desc, asc, sql, gte, lt, count } from "drizzle-orm";
import { effectivePlan, hasFeature } from "./entitlements";
import { isScheduledDay, previousScheduledDate, countScheduledDaysBetween } from "shared/schema";
import type { PlanTier } from "shared/schema";

export class DebtRepaymentError extends Error {}

// The type of the `tx` param inside a db.transaction(async (tx) => ...)
// callback — distinct from `typeof db` (a PgTransaction isn't assignable
// to NodePgDatabase). Functions that need to run either standalone or
// inside an existing transaction take this type so callers can pass
// either `db` or a `tx`.
type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

// Everything the UI needs to render one partnership row, from either
// party's point of view — the API route resolves "me" vs. "the other
// person" using whichever of initiatorUserId/partnerUserId matches the
// requesting user. See the habitPartnerships table comment in
// shared/schema.ts for the overall design (each side links their own
// pre-existing Build habit; nothing is shared/cloned).
export interface PartnershipView {
  id: number;
  status: PartnershipStatus;
  initiatorUserId: string;
  initiatorEmail: string;
  initiatorHabitId: number;
  initiatorHabitName: string;
  partnerUserId: string;
  partnerEmail: string;
  partnerHabitId: number | null;
  partnerHabitName: string | null;
  invitedAt: Date;
  respondedAt: Date | null;
  endedAt: Date | null;
  bestSharedStreak: number;
  // Only meaningful once accepted (both habits linked) — see
  // storage.computeSharedStreak.
  currentSharedStreak: number;
  initiatorCompletedToday: boolean;
  partnerCompletedToday: boolean;
  // False if either party's CURRENT effective plan no longer includes
  // streak_partners (e.g. a subscription lapsed) — the partnership row
  // and both underlying habits are left completely untouched either
  // way; this only affects whether the UI treats it as live right now.
  // Resumes automatically the moment both parties are eligible again.
  sharedTrackingActive: boolean;
}

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(userId: string, prefs: { showOnboarding?: string }): Promise<void>;
  deleteUserAccount(userId: string): Promise<void>;

  // Billing
  getSubscription(userId: string): Promise<Subscription | undefined>;
  upsertSubscription(sub: UpsertSubscription): Promise<Subscription>;
  countActiveHabits(userId: string): Promise<number>;
  getEffectivePlan(userId: string, isSuperUser: boolean): Promise<PlanTier>;
  getHabitBriefs(userId: string): Promise<{ name: string; type: "build" | "avoidance"; currentStreak: number; longestStreak: number }[]>;
  getTrialHistory(userId: string): Promise<SubscriptionTrial[]>;
  getActiveTrial(userId: string): Promise<SubscriptionTrial | undefined>;
  startTrial(userId: string, trialType: TrialType, realPlan: PlanTier): Promise<SubscriptionTrial>;
  getActiveTrialsForReminders(): Promise<(SubscriptionTrial & { userEmail: string | null })[]>;
  markTrialReminderSent(trialId: number, key: "two_days" | "one_day" | "final"): Promise<void>;
  createBugReport(report: InsertBugReport): Promise<BugReport>;
  savePushSubscription(sub: InsertPushSubscription): Promise<PushSubscriptionRow>;
  deletePushSubscription(endpoint: string): Promise<void>;
  getPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRow[]>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(
    userId: string,
    updates: Partial<Record<NotificationCategory, boolean>>,
  ): Promise<NotificationPreferences>;
  getUsersDueForConfirmationWindowPush(): Promise<{ userId: string; endpoint: string; p256dhKey: string; authKey: string }[]>;
  markConfirmationWindowPushSent(userId: string): Promise<void>;
  createPartnership(initiatorUserId: string, initiatorHabitId: number, partnerEmail: string): Promise<HabitPartnership>;
  getPartnershipsForUser(userId: string): Promise<PartnershipView[]>;
  acceptPartnership(partnershipId: number, partnerUserId: string, partnerHabitId: number): Promise<HabitPartnership>;
  declinePartnership(partnershipId: number, userId: string): Promise<HabitPartnership>;
  cancelPartnership(partnershipId: number, userId: string): Promise<HabitPartnership>;
  endPartnership(partnershipId: number, userId: string): Promise<HabitPartnership>;

  // Habits
  getHabits(userId: string): Promise<HabitWithStatus[]>;
  getHabit(id: number): Promise<Habit | undefined>;
  createHabit(userId: string, habit: CreateHabitRequest): Promise<Habit>;
  updateHabit(id: number, userId: string, updates: UpdateHabitRequest): Promise<Habit>;
  deleteHabit(id: number, userId: string): Promise<void>;
  
  // Avoidance
  logHabitEvent(habitId: number, notes?: string): Promise<HabitEvent>;
  confirmCleanDay(habitId: number, date: string): Promise<{ debt: number }>;
  getTodayEventCount(habitId: number, date: string): Promise<number>;
  
  // Build
  getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined>;
  completeDailyTask(habitId: number, date: string, completedValue: number): Promise<DailyHabitStatus & { debtSummary: BuildDebtSummary }>;
  
  // Streaks
  updateStreak(habitId: number, date: string, isSuccess: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Auth Implementation
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Stamps lastLoginAt to now -- called ONLY from genuine sign-in events
  // (email/password success in the mark-login route, Google OAuth
  // callback), never from the routine per-request resolveUser() upsert.
  // See shared/models/auth.ts's lastLoginAt comment for why that
  // distinction matters: this is what lets require-user.ts enforce a
  // fixed 7-day-since-actual-login window rather than a rolling one.
  async markUserLoggedIn(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserPreferences(userId: string, prefs: { showOnboarding?: string }): Promise<void> {
    await db.update(users)
      .set({ 
        showOnboarding: prefs.showOnboarding,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  async deleteUserAccount(userId: string): Promise<void> {
    // No DB-level cascade is configured on these FKs, so dependent rows
    // have to go first, in dependency order, before the habits and the
    // profile row itself. All within one transaction so a failure partway
    // through doesn't leave the account half-deleted.
    await db.transaction(async (tx) => {
      const userHabits = await tx
        .select({ id: habits.id })
        .from(habits)
        .where(eq(habits.userId, userId));
      const habitIds = userHabits.map((h) => h.id);

      if (habitIds.length > 0) {
        for (const habitId of habitIds) {
          await tx.delete(habitEvents).where(eq(habitEvents.habitId, habitId));
          await tx.delete(dailyHabitStatus).where(eq(dailyHabitStatus.habitId, habitId));
          await tx.delete(habitDebts).where(eq(habitDebts.habitId, habitId));
          await tx.delete(buildDebtRepayments).where(eq(buildDebtRepayments.habitId, habitId));
        }
        await tx.delete(habits).where(eq(habits.userId, userId));
      }

      await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  // Billing Implementation
  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return sub;
  }

  async upsertSubscription(sub: UpsertSubscription): Promise<Subscription> {
    const [result] = await db
      .insert(subscriptions)
      .values(sub)
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { ...sub, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  // --- Subscription trials ---

  // All trials this user has EVER started (used or currently active) —
  // presence of a row for a given trialType means that trial has already
  // been used, regardless of whether it's still active. Used both to
  // render trial history/eligibility and to enforce one-time-use before
  // even attempting the insert (the unique constraint is the real
  // guarantee; this check just gives a friendlier error message).
  async getTrialHistory(userId: string): Promise<SubscriptionTrial[]> {
    return db.select().from(subscriptionTrials).where(eq(subscriptionTrials.userId, userId));
  }

  // The trial currently in effect for this user, if any (endsAt in the
  // future). A user can only ever have one trial active at a time in
  // practice — startTrial refuses to start a second one while an
  // existing trial (of any type) is still active — but this doesn't
  // assume that invariant; it just picks the one with the latest endsAt
  // among any that happen to still be active.
  async getActiveTrial(userId: string): Promise<SubscriptionTrial | undefined> {
    const rows = await db
      .select()
      .from(subscriptionTrials)
      .where(and(eq(subscriptionTrials.userId, userId), gte(subscriptionTrials.endsAt, new Date())));
    return rows.sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  }

  // Starts a trial for this user. Throws with a user-facing message on
  // any ineligibility (already used, another trial already active,
  // wrong starting plan) rather than silently no-op-ing, since the
  // route needs a real error to surface to the UI.
  async startTrial(userId: string, trialType: TrialType, realPlan: PlanTier): Promise<SubscriptionTrial> {
    const config = TRIAL_CONFIG[trialType];
    if (realPlan !== config.eligibleFromPlan) {
      throw new Error(
        `The ${trialType.replace(/_/g, " ")} trial requires being on the ${config.eligibleFromPlan} plan.`,
      );
    }

    const active = await this.getActiveTrial(userId);
    if (active) {
      throw new Error("You already have an active trial. Only one trial can run at a time.");
    }

    const history = await this.getTrialHistory(userId);
    if (history.some((t) => t.trialType === trialType)) {
      throw new Error("You've already used this trial. Each trial is available once per account.");
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + config.days * 24 * 60 * 60 * 1000);

    try {
      const [trial] = await db
        .insert(subscriptionTrials)
        .values({ userId, trialType, startedAt, endsAt })
        .returning();
      return trial;
    } catch (err) {
      // Belt-and-suspenders: if two requests race past the checks above,
      // the DB's unique(userId, trialType) constraint is the actual
      // backstop, surfaced here as the same friendly message.
      throw new Error("You've already used this trial. Each trial is available once per account.");
    }
  }

  // All trials currently active for ANY user (endsAt in the future),
  // joined with the user's email — used exclusively by the trial
  // reminder cron sweep (lib/trial-reminders.ts) to know who to email
  // and where. Nothing else should need every active trial across all
  // users at once.
  async getActiveTrialsForReminders(): Promise<(SubscriptionTrial & { userEmail: string | null })[]> {
    const rows = await db
      .select({ trial: subscriptionTrials, userEmail: users.email })
      .from(subscriptionTrials)
      .innerJoin(users, eq(subscriptionTrials.userId, users.id))
      .where(gte(subscriptionTrials.endsAt, new Date()));
    return rows.map((r) => ({ ...r.trial, userEmail: r.userEmail }));
  }

  // Marks one reminder checkpoint (see TrialReminderKey) as sent for a
  // trial, so the cron sweep never emails the same checkpoint twice.
  async markTrialReminderSent(trialId: number, key: "two_days" | "one_day" | "final"): Promise<void> {
    const now = new Date();
    if (key === "two_days") {
      await db.update(subscriptionTrials).set({ twoDayReminderSentAt: now }).where(eq(subscriptionTrials.id, trialId));
    } else if (key === "one_day") {
      await db.update(subscriptionTrials).set({ oneDayReminderSentAt: now }).where(eq(subscriptionTrials.id, trialId));
    } else {
      await db.update(subscriptionTrials).set({ finalReminderSentAt: now }).where(eq(subscriptionTrials.id, trialId));
    }
  }

  // Bug reports (spec section 11) — see the bugReports table comment in
  // shared/schema.ts for why userId/userEmail are stored as plain
  // snapshotted strings rather than a foreign key.
  async createBugReport(report: InsertBugReport): Promise<BugReport> {
    const [result] = await db.insert(bugReports).values(report).returning();
    return result;
  }

  // --- Push notifications ---

  async savePushSubscription(sub: InsertPushSubscription): Promise<PushSubscriptionRow> {
    const [result] = await db
      .insert(pushSubscriptions)
      .values(sub)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        // Re-subscribing the same browser can legitimately produce new
        // keys (e.g. after clearing site data) even though the endpoint
        // URL itself is unchanged — refresh them rather than silently
        // keeping stale ones that would fail to encrypt correctly.
        set: { p256dhKey: sub.p256dhKey, authKey: sub.authKey, userId: sub.userId },
      })
      .returning();
    return result;
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRow[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    if (existing) return existing;

    // Created lazily, on first read — every category defaults to true
    // (see the notificationPreferences table comment in shared/schema.ts).
    const [created] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    // Race: another request created the row between the select above and
    // this insert. Re-read rather than error.
    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return row;
  }

  async updateNotificationPreferences(
    userId: string,
    updates: Partial<Record<NotificationCategory, boolean>>,
  ): Promise<NotificationPreferences> {
    // Ensure a row exists first (lazy creation), then apply the partial
    // update — mirrors getNotificationPreferences' own lazy-create path
    // rather than assuming a settings row already exists for every user.
    await this.getNotificationPreferences(userId);
    const [updated] = await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return updated;
  }

  // Every (userId, subscription) pair eligible for tonight's "your
  // confirmation window is open" push: has at least one push
  // subscription, has the confirmationWindowOpen preference on, and
  // hasn't already been sent today (see lastConfirmationWindowPushDate).
  // Used exclusively by the confirmation-window-push cron sweep.
  async getUsersDueForConfirmationWindowPush(): Promise<{ userId: string; endpoint: string; p256dhKey: string; authKey: string }[]> {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select({
        userId: pushSubscriptions.userId,
        endpoint: pushSubscriptions.endpoint,
        p256dhKey: pushSubscriptions.p256dhKey,
        authKey: pushSubscriptions.authKey,
        confirmationWindowOpen: notificationPreferences.confirmationWindowOpen,
        lastPushDate: notificationPreferences.lastConfirmationWindowPushDate,
      })
      .from(pushSubscriptions)
      .innerJoin(notificationPreferences, eq(notificationPreferences.userId, pushSubscriptions.userId))
      .where(eq(notificationPreferences.confirmationWindowOpen, true));

    return rows
      .filter((r) => r.lastPushDate !== today)
      .map((r) => ({ userId: r.userId, endpoint: r.endpoint, p256dhKey: r.p256dhKey, authKey: r.authKey }));
  }

  async markConfirmationWindowPushSent(userId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    await db
      .update(notificationPreferences)
      .set({ lastConfirmationWindowPushDate: today, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId));
  }

  // --- Shared Streak Partners ---

  async createPartnership(
    initiatorUserId: string,
    initiatorHabitId: number,
    partnerEmail: string,
  ): Promise<HabitPartnership> {
    const habit = await this.getHabit(initiatorHabitId);
    if (!habit || habit.userId !== initiatorUserId) {
      throw new Error("You don't own that protocol.");
    }
    if (habit.type !== "build") {
      throw new Error("Only Build protocols can have a streak partner right now.");
    }

    const partner = await this.getUserByEmail(partnerEmail.toLowerCase());
    if (!partner) {
      throw new Error("No Protocol account found with that email.");
    }
    if (partner.id === initiatorUserId) {
      throw new Error("You can't invite yourself.");
    }

    // Application-level dedup (not a DB constraint — see the schema
    // comment on why a plain unique index can't express "unique only
    // among pending invites"): refuse a second pending invite for the
    // same habit+partner, but allow re-inviting after a decline,
    // cancellation, or ended partnership.
    const existingPending = await db
      .select()
      .from(habitPartnerships)
      .where(
        and(
          eq(habitPartnerships.initiatorHabitId, initiatorHabitId),
          eq(habitPartnerships.partnerUserId, partner.id),
          eq(habitPartnerships.status, "pending"),
        ),
      );
    if (existingPending.length > 0) {
      throw new Error("You already have a pending invite to this person for this protocol.");
    }

    const [created] = await db
      .insert(habitPartnerships)
      .values({
        initiatorUserId,
        initiatorHabitId,
        partnerUserId: partner.id,
        status: "pending",
      })
      .returning();
    return created;
  }

  async acceptPartnership(partnershipId: number, partnerUserId: string, partnerHabitId: number): Promise<HabitPartnership> {
    const [partnership] = await db.select().from(habitPartnerships).where(eq(habitPartnerships.id, partnershipId));
    if (!partnership || partnership.partnerUserId !== partnerUserId) {
      throw new Error("Invite not found.");
    }
    if (partnership.status !== "pending") {
      throw new Error("This invite is no longer pending.");
    }

    const habit = await this.getHabit(partnerHabitId);
    if (!habit || habit.userId !== partnerUserId) {
      throw new Error("You don't own that protocol.");
    }
    if (habit.type !== "build") {
      throw new Error("Only Build protocols can be linked as a streak partner.");
    }

    const [updated] = await db
      .update(habitPartnerships)
      .set({ status: "accepted", partnerHabitId, respondedAt: new Date() })
      .where(eq(habitPartnerships.id, partnershipId))
      .returning();
    return updated;
  }

  async declinePartnership(partnershipId: number, userId: string): Promise<HabitPartnership> {
    const [partnership] = await db.select().from(habitPartnerships).where(eq(habitPartnerships.id, partnershipId));
    if (!partnership || partnership.partnerUserId !== userId) {
      throw new Error("Invite not found.");
    }
    if (partnership.status !== "pending") {
      throw new Error("This invite is no longer pending.");
    }
    const [updated] = await db
      .update(habitPartnerships)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(habitPartnerships.id, partnershipId))
      .returning();
    return updated;
  }

  async cancelPartnership(partnershipId: number, userId: string): Promise<HabitPartnership> {
    const [partnership] = await db.select().from(habitPartnerships).where(eq(habitPartnerships.id, partnershipId));
    if (!partnership || partnership.initiatorUserId !== userId) {
      throw new Error("Invite not found.");
    }
    if (partnership.status !== "pending") {
      throw new Error("This invite is no longer pending.");
    }
    const [updated] = await db
      .update(habitPartnerships)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(habitPartnerships.id, partnershipId))
      .returning();
    return updated;
  }

  async endPartnership(partnershipId: number, userId: string): Promise<HabitPartnership> {
    const [partnership] = await db.select().from(habitPartnerships).where(eq(habitPartnerships.id, partnershipId));
    if (!partnership || (partnership.initiatorUserId !== userId && partnership.partnerUserId !== userId)) {
      throw new Error("Partnership not found.");
    }
    if (partnership.status !== "accepted") {
      throw new Error("This partnership isn't active.");
    }
    // Either party can end it unilaterally — no "both must agree"
    // requirement, matching the spec's "either user can end the
    // partnership at any time." Neither underlying habit is touched.
    const [updated] = await db
      .update(habitPartnerships)
      .set({ status: "ended", endedAt: new Date(), endedByUserId: userId })
      .where(eq(habitPartnerships.id, partnershipId))
      .returning();
    return updated;
  }

  // Walks backward day-by-day from today, counting a day toward the
  // shared streak only when BOTH linked habits show completed=true for
  // that date. SIMPLIFICATION, stated plainly: this assumes plain daily
  // cadence and does not account for either habit's own custom
  // scheduledDays rest days (see isScheduledDay in shared/schema.ts) —
  // teaching the shared-streak walk to honor two potentially-different
  // custom schedules at once is a real design question left for a
  // follow-up rather than guessed at here.
  private async computeSharedStreak(
    initiatorHabitId: number,
    partnerHabitId: number,
  ): Promise<{ current: number; initiatorCompletedToday: boolean; partnerCompletedToday: boolean }> {
    const [initiatorRows, partnerRows] = await Promise.all([
      db.select().from(dailyHabitStatus).where(eq(dailyHabitStatus.habitId, initiatorHabitId)),
      db.select().from(dailyHabitStatus).where(eq(dailyHabitStatus.habitId, partnerHabitId)),
    ]);
    const initiatorByDate = new Map(initiatorRows.map((r) => [r.date, r.completed]));
    const partnerByDate = new Map(partnerRows.map((r) => [r.date, r.completed]));

    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];
    const initiatorCompletedToday = initiatorByDate.get(todayKey) === true;
    const partnerCompletedToday = partnerByDate.get(todayKey) === true;

    let current = 0;
    const cursor = new Date(today);
    // Bounded at ~2 years of daily checks — a generous ceiling, not a
    // realistic case this would actually hit, purely to guarantee this
    // loop terminates even against corrupted/unexpected data.
    for (let i = 0; i < 730; i++) {
      const key = cursor.toISOString().split("T")[0];
      const bothCompleted = initiatorByDate.get(key) === true && partnerByDate.get(key) === true;
      if (!bothCompleted) {
        // Today not being done yet (day still in progress) shouldn't
        // break the streak counted through yesterday — skip only
        // today's gap once, exactly like the individual habit streak
        // convention elsewhere in this app.
        if (key === todayKey) {
          cursor.setUTCDate(cursor.getUTCDate() - 1);
          continue;
        }
        break;
      }
      current++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return { current, initiatorCompletedToday, partnerCompletedToday };
  }

  async getPartnershipsForUser(userId: string): Promise<PartnershipView[]> {
    const rows = await db
      .select()
      .from(habitPartnerships)
      .where(or(eq(habitPartnerships.initiatorUserId, userId), eq(habitPartnerships.partnerUserId, userId)));

    const views: PartnershipView[] = [];
    for (const row of rows) {
      const [initiatorUser, partnerUser, initiatorHabit, partnerHabit] = await Promise.all([
        this.getUser(row.initiatorUserId),
        this.getUser(row.partnerUserId),
        this.getHabit(row.initiatorHabitId),
        row.partnerHabitId ? this.getHabit(row.partnerHabitId) : Promise.resolve(undefined),
      ]);

      let currentSharedStreak = 0;
      let initiatorCompletedToday = false;
      let partnerCompletedToday = false;
      let sharedTrackingActive = false;

      if (row.status === "accepted" && row.partnerHabitId) {
        const [initiatorPlan, partnerPlan] = await Promise.all([
          this.getEffectivePlan(row.initiatorUserId, false),
          this.getEffectivePlan(row.partnerUserId, false),
        ]);
        sharedTrackingActive = hasFeature(initiatorPlan, "streak_partners") && hasFeature(partnerPlan, "streak_partners");

        if (sharedTrackingActive) {
          const streak = await this.computeSharedStreak(row.initiatorHabitId, row.partnerHabitId);
          currentSharedStreak = streak.current;
          initiatorCompletedToday = streak.initiatorCompletedToday;
          partnerCompletedToday = streak.partnerCompletedToday;

          if (currentSharedStreak > row.bestSharedStreak) {
            await db
              .update(habitPartnerships)
              .set({ bestSharedStreak: currentSharedStreak })
              .where(eq(habitPartnerships.id, row.id));
            row.bestSharedStreak = currentSharedStreak;
          }
        }
      }

      views.push({
        id: row.id,
        status: row.status as PartnershipStatus,
        initiatorUserId: row.initiatorUserId,
        initiatorEmail: initiatorUser?.email ?? "",
        initiatorHabitId: row.initiatorHabitId,
        initiatorHabitName: initiatorHabit?.name ?? "",
        partnerUserId: row.partnerUserId,
        partnerEmail: partnerUser?.email ?? "",
        partnerHabitId: row.partnerHabitId,
        partnerHabitName: partnerHabit?.name ?? null,
        invitedAt: row.invitedAt,
        respondedAt: row.respondedAt,
        endedAt: row.endedAt,
        bestSharedStreak: row.bestSharedStreak,
        currentSharedStreak,
        initiatorCompletedToday,
        partnerCompletedToday,
        sharedTrackingActive,
      });
    }

    return views.sort((a, b) => b.invitedAt.getTime() - a.invitedAt.getTime());
  }

  async countActiveHabits(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(habits)
      .where(eq(habits.userId, userId));
    return result?.count ?? 0;
  }

  // Case- and whitespace-insensitive: "Read" and "  read  " count as the
  // same habit name, matching how a person would actually judge a
  // duplicate. excludeHabitId lets the rename path check "does this
  // collide with any OTHER habit of mine" without the habit always
  // colliding with itself when the name isn't actually changing.
  async habitNameExists(userId: string, name: string, excludeHabitId?: number): Promise<boolean> {
    const conditions = [
      eq(habits.userId, userId),
      sql`lower(trim(${habits.name})) = lower(trim(${name}))`,
    ];
    if (excludeHabitId !== undefined) {
      conditions.push(sql`${habits.id} != ${excludeHabitId}`);
    }
    const [result] = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(...conditions))
      .limit(1);
    return !!result;
  }

  // Resolves the plan actually used for feature gating — the real
  // billing plan, or a super user's full-access/preview override. See
  // entitlements.effectivePlan for the exact rules.
  async getEffectivePlan(userId: string, isSuperUser: boolean): Promise<PlanTier> {
    const [sub, activeTrial] = await Promise.all([
      this.getSubscription(userId),
      this.getActiveTrial(userId),
    ]);
    // A cancelled subscription still counts as active through the end of
    // the period already paid for (see cancelSubscriptionRecord in
    // lib/billing.ts) — this is what makes "keep access until period
    // ends" true rather than the previous immediate-downgrade bug.
    // After currentPeriodEnd passes, this naturally evaluates to false
    // with no cron needed, same lazy-expiry pattern as trials/referral
    // bonuses.
    const inCancelledGracePeriod =
      sub?.status === "cancelled" && !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > Date.now();
    const isActive = (sub?.status === "active" || inCancelledGracePeriod) && sub?.plan !== "free";
    const realPlan: PlanTier = isActive ? sub!.plan : "free";
    const referralBonusActive = !!(sub?.referralBonusExpiresAt && sub.referralBonusExpiresAt.getTime() > Date.now());
    return effectivePlan({
      realPlan,
      isSuperUser,
      previewPlan: sub?.previewPlan ?? null,
      referralBonusPlan: sub?.referralBonusPlan ?? null,
      referralBonusActive,
      trialType: activeTrial?.trialType ?? null,
      trialActive: !!activeTrial,
    });
  }

  // Lightweight per-habit summary used for AI prompts — deliberately
  // excludes anything beyond name/type/streaks (no notes, no raw event
  // history) to keep what's sent to the AI provider minimal.
  async getHabitBriefs(
    userId: string,
  ): Promise<{ name: string; type: "build" | "avoidance"; currentStreak: number; longestStreak: number }[]> {
    const rows = await db
      .select({
        name: habits.name,
        type: habits.type,
        currentStreak: habits.currentStreak,
        longestStreak: habits.longestStreak,
      })
      .from(habits)
      .where(eq(habits.userId, userId));
    return rows;
  }

  // Habit Implementation
  async getHabits(userId: string): Promise<HabitWithStatus[]> {
    // Stable, deterministic ordering: earliest-created habit first. Without
    // an explicit ORDER BY, Postgres makes no guarantee about row order
    // across repeated SELECTs — habits could visibly "reorder" between
    // one fetch and the next even though nothing about the habits
    // themselves changed. `id` is a serial primary key, so ordering by it
    // is equivalent to creation order but immune to any createdAt
    // timestamp ties.
    const userHabits = await db.select().from(habits).where(eq(habits.userId, userId)).orderBy(asc(habits.id));
    const today = new Date().toISOString().split('T')[0];
    
    const results: HabitWithStatus[] = [];
    
    for (const habit of userHabits) {
      const h: HabitWithStatus = { ...habit };
      
      if (habit.type === 'avoidance') {
        const [debt] = await db.select().from(habitDebts).where(eq(habitDebts.habitId, habit.id));
        h.debt = debt?.debtCount ?? 0;
        h.todayEvents = await this.getTodayEventCount(habit.id, today);
        h.todayConfirmed = debt?.lastCleanDate === today;
      } else {
        // Build habit logic. outstandingDebtUnits is the single source of
        // truth for debt now (see shared/schema.ts) -- no separate
        // scan/derivation needed the way the old day-counting model
        // required.
        h.todayIsRestDay = !isScheduledDay(habit.scheduledDays, today);
        const outstandingDebtUnits = habit.outstandingDebtUnits ?? 0;
        const base = habit.baseTaskValue || 0;
        h.todayTask = base + outstandingDebtUnits;
        h.remainingDebt = outstandingDebtUnits;
        // Display-only estimate ("penalty stacked from N days missed") --
        // see HabitWithStatus's comment. Never used for todayTask itself.
        h.penaltyLevel = base > 0 ? Math.ceil(outstandingDebtUnits / base) : 0;

        const status = await this.getDailyStatus(habit.id, today);
        h.todayCompleted = status?.completed ?? false;
        // Check if marked as missed (has status record but not completed)
        h.todayMissed = status ? !status.completed : false;
      }
      results.push(h);
    }
    
    return results;
  }

  async getHabit(id: number): Promise<Habit | undefined> {
    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    return habit;
  }

  async createHabit(userId: string, habit: CreateHabitRequest): Promise<Habit> {
    const [newHabit] = await db.insert(habits).values({ 
      ...habit, 
      userId,
      currentStreak: 0,
      longestStreak: 0,
    }).returning();
    
    if (habit.type === 'avoidance') {
      await db.insert(habitDebts).values({ habitId: newHabit.id, debtCount: 0 });
    }
    
    return newHabit;
  }

  // Editing itself is plan/time-restriction-agnostic here — that check
  // (Free-plan 20-minute window vs. Pro/Premium Plus unrestricted) lives
  // in the PATCH route (client/src/app/api/habits/[id]/route.ts), same
  // as other plan-gated behavior elsewhere (e.g. history's hasFeature
  // checks). This method only enforces ownership + persists the change.
  async updateHabit(id: number, userId: string, updates: UpdateHabitRequest): Promise<Habit> {
    const habit = await this.getHabit(id);
    if (!habit || habit.userId !== userId) throw new Error("Unauthorized");

    const [updated] = await db.update(habits)
      .set(updates)
      .where(eq(habits.id, id))
      .returning();
    return updated;
  }

  async deleteHabit(id: number, userId: string): Promise<void> {
    const habit = await this.getHabit(id);
    if (!habit || habit.userId !== userId) throw new Error("Unauthorized");
    
    await db.delete(habitEvents).where(eq(habitEvents.habitId, id));
    await db.delete(dailyHabitStatus).where(eq(dailyHabitStatus.habitId, id));
    await db.delete(habitDebts).where(eq(habitDebts.habitId, id));
    await db.delete(buildDebtRepayments).where(eq(buildDebtRepayments.habitId, id));
    await db.delete(habits).where(eq(habits.id, id));
  }

  // Avoidance
  async getTodayEventCount(habitId: number, date: string): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const result = await db.select({ count: count() })
      .from(habitEvents)
      .where(and(
        eq(habitEvents.habitId, habitId),
        gte(habitEvents.timestamp, startOfDay),
        lt(habitEvents.timestamp, endOfDay)
      ));
    
    return result[0]?.count ?? 0;
  }

  async logHabitEvent(habitId: number, notes?: string): Promise<HabitEvent> {
    const [event] = await db.insert(habitEvents).values({ habitId, notes }).returning();
    
    // Increment debt
    await db.execute(
      sql`UPDATE habit_debts SET debt_count = debt_count + 1 WHERE habit_id = ${habitId}`
    );
    
    // Reset streak when event is logged (failure for avoidance)
    const habit = await this.getHabit(habitId);
    if (habit) {
      await db.update(habits)
        .set({ currentStreak: 0 })
        .where(eq(habits.id, habitId));
    }
    
    return event;
  }

  async confirmCleanDay(habitId: number, date: string): Promise<{ debt: number }> {
    const [debtRecord] = await db.select().from(habitDebts).where(eq(habitDebts.habitId, habitId));
    
    if (debtRecord?.lastCleanDate === date) {
      return { debt: debtRecord.debtCount };
    }

    // Reduce debt by 1, min 0
    const [updated] = await db.update(habitDebts)
      .set({ 
        debtCount: sql`GREATEST(0, debt_count - 1)`,
        lastCleanDate: date
      })
      .where(eq(habitDebts.habitId, habitId))
      .returning();
    
    // Update streak for successful clean day
    await this.updateStreak(habitId, date, true);
      
    return { debt: updated.debtCount };
  }

  // Build
  async getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined> {
    const [status] = await db.select()
      .from(dailyHabitStatus)
      .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.date, date)));
    return status;
  }

  // Fills in any FULLY UNTOUCHED scheduled days between the last
  // recorded dailyHabitStatus row (or habit creation, if none) and
  // asOfDate, adding baseTaskValue per such day to outstandingDebtUnits.
  // This is what makes "I just didn't open the app for 3 days" accrue
  // debt automatically, same as the old gap-scanning calculatePenaltyLevel
  // did for display purposes -- except now it's actually persisted, so a
  // later partial repayment has something concrete to reduce.
  //
  // A day that WAS explicitly touched (completed OR marked missed) is
  // never re-counted here, even if it fell short of baseTaskValue --
  // only the true gaps (no row at all) get caught up by this. Meeting
  // baseTaskValue exactly resets the reference point for future gap
  // scans (see the dailyHabitStatus.completed check below); a day that
  // was touched but fell short does not, so debt keeps compounding from
  // the last TRUE full day the same way the old model's penalty stack did.
  //
  // asOfDate itself is never included (countScheduledDaysBetween is
  // exclusive on both ends) -- today's own requirement is handled
  // separately via todayTask, never folded into "debt" until the day
  // has actually passed unresolved.
  private async catchUpMissedDaysInTx(
    tx: DbOrTx,
    habitId: number,
    asOfDate: string,
  ): Promise<number> {
    const [habit] = await tx.select().from(habits).where(eq(habits.id, habitId));
    if (!habit || habit.type !== "build") return habit?.outstandingDebtUnits ?? 0;

    const [lastRow] = await tx
      .select({ date: dailyHabitStatus.date, completed: dailyHabitStatus.completed })
      .from(dailyHabitStatus)
      .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.completed, true)))
      .orderBy(desc(dailyHabitStatus.date))
      .limit(1);

    const createdDateStr = new Date(habit.createdAt).toISOString().split("T")[0];
    const fromDate = lastRow?.date ?? createdDateStr;

    const gapDays = countScheduledDaysBetween(habit.scheduledDays, fromDate, asOfDate);
    if (gapDays <= 0) return habit.outstandingDebtUnits;

    const addedDebt = gapDays * (habit.baseTaskValue || 0);
    const [updated] = await tx
      .update(habits)
      .set({ outstandingDebtUnits: habit.outstandingDebtUnits + addedDebt })
      .where(eq(habits.id, habitId))
      .returning({ outstandingDebtUnits: habits.outstandingDebtUnits });
    return updated.outstandingDebtUnits;
  }

  // Read-path wrapper for getHabits -- same row-lock as the write path,
  // since two people (or two tabs) computing this concurrently could
  // otherwise both see the same gap and double-add it.
  private async catchUpMissedDays(habitId: number, asOfDate: string): Promise<number> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM habits WHERE id = ${habitId} FOR UPDATE`);
      return this.catchUpMissedDaysInTx(tx, habitId, asOfDate);
    });
  }

  // completedValue: raw units actually logged today (e.g. 80 pushups).
  // Both "does today count as done" AND "how much outstanding debt gets
  // cleared" are derived from this single number:
  //   todayTask = baseTaskValue + outstandingDebtUnits (after catch-up)
  //   isCompleted = completedValue >= baseTaskValue -- met TODAY's own
  //     ask, regardless of whether old debt is fully cleared too
  //   newDebt = max(0, todayTask - completedValue) -- whatever's left
  //     after today's entry covers as much of (today's base + old debt)
  //     as it reaches, carries forward to tomorrow
  //
  // Example matching the spec: base=30, 3 prior missed days already
  // accrued as outstandingDebtUnits=90 (via catch-up above) ->
  // todayTask=120. Enter completedValue=80 -> isCompleted=true (80>=30),
  // newDebt=max(0,120-80)=40, carried into tomorrow's todayTask (30+40=70).
  async completeDailyTask(
    habitId: number,
    date: string,
    completedValue: number,
  ): Promise<DailyHabitStatus & { debtSummary: BuildDebtSummary }> {
    if (!Number.isInteger(completedValue) || completedValue < 0) {
      throw new DebtRepaymentError("Amount completed must be a whole number of 0 or more.");
    }

    return db.transaction(async (tx) => {
      // Lock the habit row for the whole operation -- catch-up and the
      // debt write below both read-then-write outstandingDebtUnits, and
      // a concurrent call for the same habit must not interleave with it.
      await tx.execute(sql`SELECT id FROM habits WHERE id = ${habitId} FOR UPDATE`);

      const debtBeforeToday = await this.catchUpMissedDaysInTx(tx, habitId, date);
      const [habit] = await tx.select().from(habits).where(eq(habits.id, habitId));
      const base = habit?.baseTaskValue || 0;
      const todayTask = base + debtBeforeToday;
      const isCompleted = completedValue >= base;
      const newDebt = Math.max(0, todayTask - completedValue);

      const existing = await this.getDailyStatus(habitId, date);
      let status: DailyHabitStatus;
      if (existing) {
        const [updated] = await tx.update(dailyHabitStatus)
          .set({ completed: isCompleted, completedValue })
          .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.date, date)))
          .returning();
        status = updated;
      } else {
        const [inserted] = await tx.insert(dailyHabitStatus)
          .values({ habitId, date, completed: isCompleted, completedValue })
          .returning();
        status = inserted;
      }

      await tx.update(habits).set({ outstandingDebtUnits: newDebt }).where(eq(habits.id, habitId));
      await this.updateStreakInTx(tx, habitId, date, isCompleted);

      return { ...status, debtSummary: { outstandingDebtUnits: newDebt } };
    });
  }

  async updateStreak(habitId: number, date: string, isSuccess: boolean): Promise<void> {
    await this.updateStreakInTx(db, habitId, date, isSuccess);
  }

  private async updateStreakInTx(tx: DbOrTx, habitId: number, date: string, isSuccess: boolean): Promise<void> {
    const habit = await this.getHabit(habitId);
    if (!habit) return;
    
    if (isSuccess) {
      // Check if this is consecutive. For a habit with no custom
      // schedule, previousScheduledDate is always literal yesterday
      // (identical to the original behavior) — this only differs for a
      // Build habit with day-of-week scheduling, where a streak should
      // survive a rest day rather than break over it.
      const previousRequiredDay = previousScheduledDate(habit.scheduledDays, date);
      
      let newStreak = 1;
      let currentStreakStart = date; // Default: streak starts today
      
      if (habit.lastStreakDate === previousRequiredDay) {
        // Continuing streak
        newStreak = habit.currentStreak + 1;
        currentStreakStart = habit.currentStreakStart || date;
      }
      
      const isNewLongest = newStreak > habit.longestStreak;
      const newLongest = Math.max(habit.longestStreak, newStreak);
      
      const updateData: any = { 
        currentStreak: newStreak, 
        longestStreak: newLongest,
        lastStreakDate: date,
        currentStreakStart,
      };
      
      // Update longest streak dates if this is a new record
      if (isNewLongest) {
        updateData.longestStreakStart = currentStreakStart;
        updateData.longestStreakEnd = null; // Still active
      }
      
      await tx.update(habits)
        .set(updateData)
        .where(eq(habits.id, habitId));
    } else {
      // Streak broken - record the end date of longest if it was the current streak
      if (habit.currentStreak === habit.longestStreak && habit.currentStreak > 0) {
        await tx.update(habits)
          .set({ 
            currentStreak: 0,
            currentStreakStart: null,
            longestStreakEnd: habit.lastStreakDate // Record when it ended
          })
          .where(eq(habits.id, habitId));
      } else {
        await tx.update(habits)
          .set({ currentStreak: 0, currentStreakStart: null })
          .where(eq(habits.id, habitId));
      }
    }
  }

}

export const storage = new DatabaseStorage();
