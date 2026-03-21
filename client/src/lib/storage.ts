import { db } from "./db";
import {
  habits, habitEvents, dailyHabitStatus, habitDebts,
  type Habit, type HabitEvent, type DailyHabitStatus, type HabitDebt,
  type CreateHabitRequest, type HabitWithStatus,
} from "../types/schema";
import { users, type User, type UpsertUser } from "../types/auth";
import { eq, and, desc, sql, gte, lt, count } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(userId: string, prefs: { showOnboarding?: string }): Promise<void>;
  getHabits(userId: string): Promise<HabitWithStatus[]>;
  getHabit(id: number): Promise<Habit | undefined>;
  createHabit(userId: string, habit: CreateHabitRequest): Promise<Habit>;
  deleteHabit(id: number, userId: string): Promise<void>;
  logHabitEvent(habitId: number, notes?: string): Promise<HabitEvent>;
  confirmCleanDay(habitId: number, date: string): Promise<{ debt: number }>;
  getTodayEventCount(habitId: number, date: string): Promise<number>;
  getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined>;
  completeDailyTask(habitId: number, date: string, completed: boolean): Promise<DailyHabitStatus>;
  calculatePenaltyLevel(habitId: number, date: string): Promise<number>;
  updateStreak(habitId: number, date: string, isSuccess: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
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

  async updateUserPreferences(userId: string, prefs: { showOnboarding?: string }): Promise<void> {
    await db.update(users)
      .set({ 
        showOnboarding: prefs.showOnboarding,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

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
        const penalty = await this.calculatePenaltyLevel(habit.id, today);
        h.penaltyLevel = penalty;
        h.todayTask = (habit.baseTaskValue || 0) + ((habit.baseTaskValue || 0) * penalty);
        
        const status = await this.getDailyStatus(habit.id, today);
        h.todayCompleted = status?.completed ?? false;
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

  async deleteHabit(id: number, userId: string): Promise<void> {
    const habit = await this.getHabit(id);
    if (!habit || habit.userId !== userId) throw new Error("Unauthorized");
    
    await db.delete(habitEvents).where(eq(habitEvents.habitId, id));
    await db.delete(dailyHabitStatus).where(eq(dailyHabitStatus.habitId, id));
    await db.delete(habitDebts).where(eq(habitDebts.habitId, id));
    await db.delete(habits).where(eq(habits.id, id));
  }

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
    
    await db.execute(
      sql`UPDATE habit_debts SET debt_count = debt_count + 1 WHERE habit_id = ${habitId}`
    );
    
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

    const [updated] = await db.update(habitDebts)
      .set({ 
        debtCount: sql`GREATEST(0, debt_count - 1)`,
        lastCleanDate: date
      })
      .where(eq(habitDebts.habitId, habitId))
      .returning();
    
    await this.updateStreak(habitId, date, true);
      
    return { debt: updated.debtCount };
  }

  async getDailyStatus(habitId: number, date: string): Promise<DailyHabitStatus | undefined> {
    const [status] = await db.select()
      .from(dailyHabitStatus)
      .where(and(eq(dailyHabitStatus.habitId, habitId), eq(dailyHabitStatus.date, date)));
    return status;
  }

  async completeDailyTask(habitId: number, date: string, completed: boolean): Promise<DailyHabitStatus> {
    const penaltyLevel = await this.calculatePenaltyLevel(habitId, date);
    
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
    
    await this.updateStreak(habitId, date, completed);
      
    return status;
  }

  async calculatePenaltyLevel(habitId: number, today: string): Promise<number> {
    const habit = await this.getHabit(habitId);
    if (!habit) return 0;
    
    const createdDate = new Date(habit.createdAt).toISOString().split('T')[0];
    if (createdDate === today) {
      return 0;
    }
    
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
      const lastDate = new Date(lastCompleted.date);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays - 1);
    } else {
      const created = new Date(habit.createdAt);
      created.setHours(0, 0, 0, 0);
      const todayDate = new Date(today);
      todayDate.setHours(0, 0, 0, 0);
      const diffTime = todayDate.getTime() - created.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
  }

  async updateStreak(habitId: number, date: string, isSuccess: boolean): Promise<void> {
    const habit = await this.getHabit(habitId);
    if (!habit) return;
    
    if (isSuccess) {
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let newStreak = 1;
      let currentStreakStart = date;
      
      if (habit.lastStreakDate === yesterdayStr) {
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
      
      if (isNewLongest) {
        updateData.longestStreakStart = currentStreakStart;
        updateData.longestStreakEnd = null;
      }
      
      await db.update(habits)
        .set(updateData)
        .where(eq(habits.id, habitId));
    } else {
      const habit = await this.getHabit(habitId);
      if (habit && habit.currentStreak === habit.longestStreak && habit.currentStreak > 0) {
        await db.update(habits)
          .set({ 
            currentStreak: 0,
            currentStreakStart: null,
            longestStreakEnd: habit.lastStreakDate
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
