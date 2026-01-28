import { db } from "./db";
import {
  habits, habitEvents, dailyHabitStatus, habitDebts,
  type InsertHabit, type Habit, type HabitEvent, type DailyHabitStatus, type HabitDebt,
  type CreateHabitRequest, type HabitWithStatus,
  users, type User, type UpsertUser
} from "@shared/schema";
import { eq, and, desc, sql, gte, lt, count } from "drizzle-orm";

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
  getTodayEventCount(habitId: number, date: string): Promise<number>;
  
  // Build
  getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined>;
  completeDailyTask(habitId: number, date: string, completed: boolean): Promise<DailyHabitStatus>;
  calculatePenaltyLevel(habitId: number, date: string): Promise<number>;
  
  // Streaks
  updateStreak(habitId: number, date: string, isSuccess: boolean): Promise<void>;
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
    const today = new Date().toISOString().split('T')[0];
    
    const results: HabitWithStatus[] = [];
    
    for (const habit of userHabits) {
      const h: HabitWithStatus = { ...habit };
      
      if (habit.type === 'avoidance') {
        const debt = await db.select().from(habitDebts).where(eq(habitDebts.habitId, habit.id));
        h.debt = debt[0]?.debtCount ?? 0;
        h.todayEvents = await this.getTodayEventCount(habit.id, today);
      } else {
        // Build habit logic
        const penalty = await this.calculatePenaltyLevel(habit.id, today);
        h.penaltyLevel = penalty;
        h.todayTask = (habit.baseTaskValue || 0) + ((habit.baseTaskValue || 0) * penalty);
        
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

  async completeDailyTask(habitId: number, date: string, completed: boolean): Promise<DailyHabitStatus> {
    const penaltyLevel = await this.calculatePenaltyLevel(habitId, date);
    
    // Check if status exists
    const existing = await this.getDailyStatus(habitId, date);
    
    let status: DailyHabitStatus;
    if (existing) {
      const [updated] = await db.update(dailyHabitStatus)
        .set({ completed, penaltyLevel })
        .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.date, date)))
        .returning();
      status = updated;
    } else {
      const [inserted] = await db.insert(dailyHabitStatus)
        .values({ habitId, date, completed, penaltyLevel })
        .returning();
      status = inserted;
    }
    
    // Update streak
    await this.updateStreak(habitId, date, completed);
      
    return status;
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
      
      await db.update(habits)
        .set(updateData)
        .where(eq(habits.id, habitId));
    } else {
      // Streak broken - record the end date of longest if it was the current streak
      const habit = await this.getHabit(habitId);
      if (habit && habit.currentStreak === habit.longestStreak && habit.currentStreak > 0) {
        await db.update(habits)
          .set({ 
            currentStreak: 0,
            currentStreakStart: null,
            longestStreakEnd: habit.lastStreakDate // Record when it ended
          })
          .where(eq(habits.id, habitId));
      } else {
        await db.update(habits)
          .set({ currentStreak: 0, currentStreakStart: null })
          .where(eq(habits.id, habitId));
      }
    }
  }
}

export const storage = new DatabaseStorage();
export { authStorage } from "./replit_integrations/auth/storage";
