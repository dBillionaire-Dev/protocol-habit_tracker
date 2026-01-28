import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

// Guest user ID for demo/testing
const GUEST_USER_ID = "guest-demo-user";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Guest mode endpoint
  app.post("/api/auth/guest", async (req, res) => {
    // Set up guest session
    (req as any).session.guestUser = true;
    res.json({ 
      id: GUEST_USER_ID, 
      email: "guest@demo.app",
      firstName: "Guest",
      lastName: "User",
      profileImageUrl: null 
    });
  });

  // Helper to get user ID (supports both auth and guest)
  const getUserId = (req: any): string | null => {
    if (req.isAuthenticated?.() && req.user?.claims?.sub) {
      return req.user.claims.sub;
    }
    if (req.session?.guestUser) {
      return GUEST_USER_ID;
    }
    return null;
  };

  // Middleware that allows both authenticated and guest users
  const requireUser = (req: any, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (userId) {
      req.userId = userId;
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Modified auth/user endpoint to support guest
  app.get("/api/auth/user", (req: any, res) => {
    if (req.session?.guestUser) {
      return res.json({
        id: GUEST_USER_ID,
        email: "guest@demo.app",
        firstName: "Guest",
        lastName: "User",
        profileImageUrl: null
      });
    }
    // Fall through to normal auth check
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user?.claims || {});
  });

  // Habits Routes
  app.get(api.habits.list.path, requireUser, async (req: any, res) => {
    const habits = await storage.getHabits(req.userId);
    res.json(habits);
  });

  app.post(api.habits.create.path, requireUser, async (req: any, res) => {
    try {
      const input = api.habits.create.input.parse(req.body);
      const habit = await storage.createHabit(req.userId, input);
      res.status(201).json(habit);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.habits.get.path, requireUser, async (req: any, res) => {
    const habit = await storage.getHabit(Number(req.params.id));
    if (!habit) return res.status(404).json({ message: 'Habit not found' });
    if (habit.userId !== req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(habit);
  });

  app.delete(api.habits.delete.path, requireUser, async (req: any, res) => {
    try {
      await storage.deleteHabit(Number(req.params.id), req.userId);
      res.status(204).send();
    } catch (err) {
      if ((err as Error).message === "Unauthorized") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(404).json({ message: "Habit not found" });
    }
  });

  app.post(api.habits.logEvent.path, requireUser, async (req: any, res) => {
    try {
      const habit = await storage.getHabit(Number(req.params.id));
      if (!habit || habit.userId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const input = api.habits.logEvent.input.parse(req.body);
      const event = await storage.logHabitEvent(Number(req.params.id), input.notes);
      res.status(201).json(event);
    } catch (err) {
      res.status(500).json({ message: "Failed to log event" });
    }
  });

  app.post(api.habits.confirmCleanDay.path, requireUser, async (req: any, res) => {
    try {
      const habit = await storage.getHabit(Number(req.params.id));
      if (!habit || habit.userId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const input = api.habits.confirmCleanDay.input.parse(req.body);
      const result = await storage.confirmCleanDay(Number(req.params.id), input.date);
      res.json({ debt: result.debt, message: "Clean day confirmed" });
    } catch (err) {
      res.status(500).json({ message: "Failed to confirm" });
    }
  });

  app.post(api.habits.completeDaily.path, requireUser, async (req: any, res) => {
    try {
      const habit = await storage.getHabit(Number(req.params.id));
      if (!habit || habit.userId !== req.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const input = api.habits.completeDaily.input.parse(req.body);
      const result = await storage.completeDailyTask(Number(req.params.id), input.date, input.completed);
      res.json(result);
    } catch (err) {
      console.error("Complete task error:", err);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  return httpServer;
}
