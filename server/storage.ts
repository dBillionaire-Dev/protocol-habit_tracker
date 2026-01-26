import { db } from "./db";
import {
  habits, habitEvents, dailyHabitStatus, habitDebts,
  type InsertHabit, type Habit, type HabitEvent, type DailyHabitStatus, type HabitDebt,
  type CreateHabitRequest, type HabitWithStatus,
  users, type User, type UpsertUser
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Habits
  getHabits(userId: string): Promise<HabitWithStatus[]>;
  getHabit(id: number): Promise<Habit | undefined>;
  createHabit(userId: string, habit: CreateHabitRequest): Promise<Habit>;
  deleteHabit(id: number, userId: string): Promise<void>;
  
  // Avoidance
  logHabitEvent(habitId: number, notes?: string): Promise<HabitEvent>;
  confirmCleanDay(habitId: number, date: string): Promise<{ debt: number }>;
  
  // Build
  getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined>;
  completeDailyTask(habitId: number, date: string, completed: boolean): Promise<DailyHabitStatus>;
  calculatePenaltyLevel(habitId: number, date: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Auth Implementation
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  // Habit Implementation
  async getHabits(userId: string): Promise<HabitWithStatus[]> {
    const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));
    
    const results: HabitWithStatus[] = [];
    
    for (const habit of userHabits) {
      const h: HabitWithStatus = { ...habit };
      
      if (habit.type === 'avoidance') {
        const debt = await db.select().from(habitDebts).where(eq(habitDebts.habitId, habit.id));
        h.debt = debt[0]?.debtCount ?? 0;
      } else {
        // Build habit logic
        const today = new Date().toISOString().split('T')[0];
        const penalty = await this.calculatePenaltyLevel(habit.id, today);
        h.penaltyLevel = penalty;
        h.todayTask = (habit.baseTaskValue || 0) * Math.pow(2, penalty);
        
        const status = await this.getDailyStatus(habit.id, today);
        h.todayCompleted = status?.completed ?? false;
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
    const [newHabit] = await db.insert(habits).values({ ...habit, userId }).returning();
    
    if (habit.type === 'avoidance') {
      await db.insert(habitDebts).values({ habitId: newHabit.id, debtCount: 0 });
    }
    
    return newHabit;
  }

  async deleteHabit(id: number, userId: string): Promise<void> {
    // Check ownership
    const habit = await this.getHabit(id);
    if (!habit || habit.userId !== userId) throw new Error("Unauthorized");
    
    await db.delete(habitEvents).where(eq(habitEvents.habitId, id));
    await db.delete(dailyHabitStatus).where(eq(dailyHabitStatus.habitId, id));
    await db.delete(habitDebts).where(eq(habitDebts.habitId, id));
    await db.delete(habits).where(eq(habits.id, id));
  }

  // Avoidance
  async logHabitEvent(habitId: number, notes?: string): Promise<HabitEvent> {
    const [event] = await db.insert(habitEvents).values({ habitId, notes }).returning();
    
    // Increment debt
    await db.execute(
      sql`UPDATE habit_debts SET debt_count = debt_count + 1 WHERE habit_id = ${habitId}`
    );
    
    return event;
  }

  async confirmCleanDay(habitId: number, date: string): Promise<{ debt: number }> {
    // Check if clean day already logged for this date (prevent double reduction)
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
      
    return { debt: updated.debtCount };
  }

  // Build
  async getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined> {
    const [status] = await db.select()
      .from(dailyHabitStatus)
      .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.date, date)));
    return status;
  }

  async completeDailyTask(habitId: number, date: string, completed: boolean): Promise<DailyHabitStatus> {
    // Get current penalty level to store with status
    const penaltyLevel = await this.calculatePenaltyLevel(habitId, date);
    
    // Upsert status
    const [status] = await db.insert(dailyHabitStatus)
      .values({ habitId, date, completed, penaltyLevel })
      .onConflictDoUpdate({
        target: [dailyHabitStatus.habitId, dailyHabitStatus.date],
        set: { completed, penaltyLevel }
      })
      .returning();
      
    return status;
  }

  async calculatePenaltyLevel(habitId: number, today: string): Promise<number> {
    // Logic: Look back from yesterday. 
    // If yesterday missed -> penalty + 1
    // If yesterday completed -> reset to 0
    // Recurse? No, strict rule: "If the habit is completed → no penalty. If missed: next day doubles."
    // Wait, "Once completed, the requirement resets to the base task".
    // So if I completed yesterday, today is 0. 
    // If I missed yesterday, today is yesterday's penalty + 1.
    // If I missed yesterday AND the day before? It stacks.
    
    // We need to find the most recent 'completed' status.
    // All days since then are missed => penalty level = count of days missed.
    // BUT we need to check if those days *existed* (i.e. was the habit created?).
    // "Each day, the user confirms". If they don't open the app? It counts as missed.
    
    const habit = await this.getHabit(habitId);
    if (!habit) return 0;
    
    // Get last completed status
    const [lastCompleted] = await db.select()
      .from(dailyHabitStatus)
      .where(and(
        eq(dailyHabitStatus.habitId, habitId),
        eq(dailyHabitStatus.completed, true),
        sql`date < ${today}`
      ))
      .orderBy(desc(dailyHabitStatus.date))
      .limit(1);

    const startDate = lastCompleted ? new Date(lastCompleted.date) : new Date(habit.createdAt);
    const endDate = new Date(today);
    
    // Calculate days difference
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    // If last completed was yesterday (diff 1), penalty is 0.
    // If last completed was 2 days ago (missed yesterday), penalty is 1.
    // If never completed, penalty is days since creation.
    
    // Corner case: Habit created today. diffDays = 0. penalty 0.
    // Habit created yesterday. diffDays = 1. penalty 0? No, if created yesterday and not done, today is penalty 1?
    // Rule: "Day 1 missed -> Day 2 requires 40".
    
    let penalty = 0;
    if (lastCompleted) {
       // If last completed was yesterday, diff is 1. Penalty 0.
       // If last completed was 2 days ago, diff is 2. Missed 1 day. Penalty 1.
       penalty = Math.max(0, diffDays - 1);
    } else {
       // Never completed.
       // Created today: diff 0. Penalty 0.
       // Created yesterday: diff 1. Penalty 1?
       // Let's assume day of creation counts as Day 1.
       const created = new Date(habit.createdAt);
       const diffFromStart = Math.ceil(Math.abs(endDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
       penalty = diffFromStart;
       
       // Note: This logic assumes strictly strict mode. If user creates habit at 11:58PM and fails... tough luck. 
       // But maybe we should compare dates string-wise to avoid hour issues.
       // Using YYYY-MM-DD comparison is safer.
    }
    
    return penalty;
  }
}

export const storage = new DatabaseStorage();
// Hook up auth storage to the same instance or re-export
export { authStorage } from "./replit_integrations/auth/storage";
