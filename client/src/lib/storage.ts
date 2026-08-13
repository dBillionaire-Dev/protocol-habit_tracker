import { db } from "./db";
import {
  habits, habitEvents, dailyHabitStatus, habitDebts, buildDebtRepayments,
  type InsertHabit, type Habit, type HabitEvent, type DailyHabitStatus, type HabitDebt,
  type CreateHabitRequest, type HabitWithStatus, type BuildDebtSummary,
  users, type User, type UpsertUser,
  subscriptions, type Subscription, type UpsertSubscription,
} from "shared/schema";
import { eq, and, desc, sql, gte, lt, count } from "drizzle-orm";
import { effectivePlan } from "./entitlements";
import type { PlanTier } from "shared/schema";

export class DebtRepaymentError extends Error {}

// The type of the `tx` param inside a db.transaction(async (tx) => ...)
// callback — distinct from `typeof db` (a PgTransaction isn't assignable
// to NodePgDatabase). Functions that need to run either standalone or
// inside an existing transaction take this type so callers can pass
// either `db` or a `tx`.
type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

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

  // Habits
  getHabits(userId: string): Promise<HabitWithStatus[]>;
  getHabit(id: number): Promise<Habit | undefined>;
  createHabit(userId: string, habit: CreateHabitRequest): Promise<Habit>;
  deleteHabit(id: number, userId: string): Promise<void>;
  
  // Avoidance
  logHabitEvent(habitId: number, notes?: string): Promise<HabitEvent>;
  confirmCleanDay(habitId: number, date: string): Promise<{ debt: number }>;
  getTodayEventCount(habitId: number, date: string): Promise<number>;
  
  // Build
  getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined>;
  completeDailyTask(habitId: number, date: string, completed: boolean, debtRepayment?: number): Promise<DailyHabitStatus & { debtSummary: BuildDebtSummary }>;
  calculatePenaltyLevel(habitId: number, date: string): Promise<number>;
  getBuildDebtSummary(habitId: number): Promise<BuildDebtSummary>;
  repayBuildDebt(habitId: number, userId: string, amount: number, date: string): Promise<BuildDebtSummary>;
  
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

  async countActiveHabits(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(habits)
      .where(eq(habits.userId, userId));
    return result?.count ?? 0;
  }

  // Resolves the plan actually used for feature gating — the real
  // billing plan, or a super user's full-access/preview override. See
  // entitlements.effectivePlan for the exact rules.
  async getEffectivePlan(userId: string, isSuperUser: boolean): Promise<PlanTier> {
    const sub = await this.getSubscription(userId);
    const isActive = sub?.status === "active" && sub.plan !== "free";
    const realPlan: PlanTier = isActive ? sub!.plan : "free";
    return effectivePlan({ realPlan, isSuperUser, previewPlan: sub?.previewPlan ?? null });
  }

  // Habit Implementation
  async getHabits(userId: string): Promise<HabitWithStatus[]> {
    const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));
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
        // Build habit logic
        const penalty = await this.calculatePenaltyLevel(habit.id, today);
        h.penaltyLevel = penalty;
        h.todayTask = (habit.baseTaskValue || 0) + ((habit.baseTaskValue || 0) * penalty);
        
        const status = await this.getDailyStatus(habit.id, today);
        h.todayCompleted = status?.completed ?? false;
        // Check if marked as missed (has status record but not completed)
        h.todayMissed = status ? !status.completed : false;

        const debtSummary = await this.getBuildDebtSummary(habit.id);
        h.totalMissedDays = debtSummary.totalMissedDays;
        h.totalRepaidDays = debtSummary.totalRepaidDays;
        h.remainingDebt = debtSummary.remainingDebt;
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

  async completeDailyTask(
    habitId: number,
    date: string,
    completed: boolean,
    debtRepayment?: number,
  ): Promise<DailyHabitStatus & { debtSummary: BuildDebtSummary }> {
    const penaltyLevel = await this.calculatePenaltyLevel(habitId, date);

    return db.transaction(async (tx) => {
      // Lock the habit row so a concurrent repayment (standalone or via
      // another completion call) can't race this one — see
      // repayBuildDebtInTx for why this matters.
      await tx.execute(sql`SELECT id FROM habits WHERE id = ${habitId} FOR UPDATE`);

      const existing = await this.getDailyStatus(habitId, date);

      let status: DailyHabitStatus;
      if (existing) {
        const [updated] = await tx.update(dailyHabitStatus)
          .set({ completed, penaltyLevel })
          .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.date, date)))
          .returning();
        status = updated;
      } else {
        const [inserted] = await tx.insert(dailyHabitStatus)
          .values({ habitId, date, completed, penaltyLevel })
          .returning();
        status = inserted;
      }

      await this.updateStreakInTx(tx, habitId, date, completed);

      // Completing today's requirement does NOT implicitly repay debt —
      // that's a separate, explicit choice (see repayBuildDebtInTx).
      // Only record a repayment here if the caller actually asked for one.
      const habit = await this.getHabit(habitId);
      let debtSummary: BuildDebtSummary;
      if (debtRepayment && debtRepayment > 0 && habit) {
        debtSummary = await this.repayBuildDebtInTx(tx, habitId, habit.userId, debtRepayment, date);
      } else {
        debtSummary = await this.getBuildDebtSummaryInTx(tx, habitId);
      }

      return { ...status, debtSummary };
    });
  }

  async calculatePenaltyLevel(habitId: number, today: string): Promise<number> {
    const habit = await this.getHabit(habitId);
    if (!habit) return 0;
    
    // Check if habit was created today - no penalty on creation day
    const createdDate = new Date(habit.createdAt).toISOString().split('T')[0];
    if (createdDate === today) {
      return 0;
    }
    
    // Get last completed status before today
    const [lastCompleted] = await db.select()
      .from(dailyHabitStatus)
      .where(and(
        eq(dailyHabitStatus.habitId, habitId),
        eq(dailyHabitStatus.completed, true),
        sql`date < ${today}`
      ))
      .orderBy(desc(dailyHabitStatus.date))
      .limit(1);

    if (lastCompleted) {
      // Calculate days since last completion
      const lastDate = new Date(lastCompleted.date);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // If completed yesterday (diff 1), penalty 0
      return Math.max(0, diffDays - 1);
    } else {
      // Never completed - count days since creation (excluding creation day)
      const created = new Date(habit.createdAt);
      created.setHours(0, 0, 0, 0);
      const todayDate = new Date(today);
      todayDate.setHours(0, 0, 0, 0);
      const diffTime = todayDate.getTime() - created.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Created yesterday means 1 day passed, so 1 penalty
      return Math.max(0, diffDays);
    }
  }

  async updateStreak(habitId: number, date: string, isSuccess: boolean): Promise<void> {
    await this.updateStreakInTx(db, habitId, date, isSuccess);
  }

  private async updateStreakInTx(tx: DbOrTx, habitId: number, date: string, isSuccess: boolean): Promise<void> {
    const habit = await this.getHabit(habitId);
    if (!habit) return;
    
    if (isSuccess) {
      // Check if this is consecutive
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let newStreak = 1;
      let currentStreakStart = date; // Default: streak starts today
      
      if (habit.lastStreakDate === yesterdayStr) {
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

  // Build debt: derived from real history (dailyHabitStatus + repayments),
  // never a directly-settable number. See buildDebtRepayments in
  // shared/schema.ts for why.
  async getBuildDebtSummary(habitId: number): Promise<BuildDebtSummary> {
    return this.getBuildDebtSummaryInTx(db, habitId);
  }

  private async getBuildDebtSummaryInTx(tx: DbOrTx, habitId: number): Promise<BuildDebtSummary> {
    const [missedResult] = await tx
      .select({ count: count() })
      .from(dailyHabitStatus)
      .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.completed, false)));
    const totalMissedDays = missedResult?.count ?? 0;

    const [repaidResult] = await tx
      .select({ total: sql<number>`COALESCE(SUM(${buildDebtRepayments.amount}), 0)` })
      .from(buildDebtRepayments)
      .where(eq(buildDebtRepayments.habitId, habitId));
    const totalRepaidDays = Number(repaidResult?.total ?? 0);

    return {
      totalMissedDays,
      totalRepaidDays,
      remainingDebt: Math.max(0, totalMissedDays - totalRepaidDays),
    };
  }

  async repayBuildDebt(
    habitId: number,
    userId: string,
    amount: number,
    date: string,
  ): Promise<BuildDebtSummary> {
    return db.transaction(async (tx) => {
      // Row-locks the habit for the duration of this transaction, so a
      // second concurrent repayment (standalone, or via completeDailyTask)
      // for the SAME habit has to wait for this one to commit before it
      // reads outstanding debt — otherwise two simultaneous requests could
      // both read "1 remaining" and both successfully repay 1, silently
      // over-repaying. Postgres blocks the second FOR UPDATE until the
      // first transaction ends, so by the time it proceeds it sees the
      // up-to-date remaining debt.
      await tx.execute(sql`SELECT id FROM habits WHERE id = ${habitId} FOR UPDATE`);
      return this.repayBuildDebtInTx(tx, habitId, userId, amount, date);
    });
  }

  private async repayBuildDebtInTx(
    tx: DbOrTx,
    habitId: number,
    userId: string,
    amount: number,
    date: string,
  ): Promise<BuildDebtSummary> {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new DebtRepaymentError("Repayment amount must be a whole number of at least 1.");
    }

    const summary = await this.getBuildDebtSummaryInTx(tx, habitId);
    if (amount > summary.remainingDebt) {
      throw new DebtRepaymentError(
        summary.remainingDebt === 0
          ? "You have no outstanding debt to repay."
          : `Repayment amount cannot exceed your outstanding debt of ${summary.remainingDebt}.`,
      );
    }

    await tx.insert(buildDebtRepayments).values({ habitId, userId, amount, date });

    return {
      totalMissedDays: summary.totalMissedDays,
      totalRepaidDays: summary.totalRepaidDays + amount,
      remainingDebt: summary.remainingDebt - amount,
    };
  }
}

export const storage = new DatabaseStorage();
