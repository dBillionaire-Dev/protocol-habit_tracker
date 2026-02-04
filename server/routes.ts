import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { createEmailUser, verifyEmailUser, getUserById, getUserByEmail } from "./auth/email-auth";
import { getGoogleAuthUrl, handleGoogleCallback, createOrGetGoogleUser, verifyGoogleToken } from "./auth/google-auth";

// Guest user ID for demo/testing
const GUEST_USER_ID = "guest-demo-user";

// Session user type
interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  provider: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth (only if Replit credentials are set)
  if (process.env.REPL_ID && process.env.REPLIT_CLIENT_SECRET) {
    await setupAuth(app);
    registerAuthRoutes(app);
  }

  // ==================== EMAIL/PASSWORD AUTH ====================
  
  // Email signup
  app.post("/api/auth/email/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const user = await createEmailUser(email, password, firstName, lastName);
      
      // Create session
      (req as any).session.user = user;
      
      res.status(201).json(user);
    } catch (err) {
      console.error("Email signup error:", err);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Email login
  app.post("/api/auth/email/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await verifyEmailUser(email, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      (req as any).session.user = user;
      
      res.json(user);
    } catch (err) {
      console.error("Email login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ==================== GOOGLE OAUTH ====================
  
  // Google login redirect
  app.get("/api/auth/google", (req, res) => {
    const authUrl = getGoogleAuthUrl();
    res.redirect(authUrl);
  });

  // Google callback
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== "string") {
        return res.redirect("/?error=no_code");
      }

      const googleUser = await handleGoogleCallback(code);
      
      if (!googleUser) {
        return res.redirect("/?error=google_auth_failed");
      }

      const user = await createOrGetGoogleUser(googleUser);
      
      // Create session
      (req as any).session.user = user;
      
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect("/?error=google_callback_failed");
    }
  });

  // Google token login (for frontend)
  app.post("/api/auth/google/token", async (req, res) => {
    try {
      const { idToken } = req.body;
      
      if (!idToken) {
        return res.status(400).json({ message: "ID token required" });
      }

      const googleUser = await verifyGoogleToken(idToken);
      
      if (!googleUser) {
        return res.status(401).json({ message: "Invalid Google token" });
      }

      const user = await createOrGetGoogleUser(googleUser);
      
      // Create session
      (req as any).session.user = user;
      
      res.json(user);
    } catch (err) {
      console.error("Google token login error:", err);
      res.status(500).json({ message: "Google login failed" });
    }
  });

  // ==================== LOGOUT ====================
  
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });

  // ==================== GUEST MODE ====================
  
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

  // Helper to get user ID (supports all auth methods)
  const getUserId = (req: any): string | null => {
    // Replit OAuth users
    if (req.isAuthenticated?.() && req.user?.claims?.sub) {
      return req.user.claims.sub;
    }
    // Email/Google users (session-based)
    if (req.session?.user?.id) {
      return req.session.user.id;
    }
    // Guest users
    if (req.session?.guestUser) {
      return GUEST_USER_ID;
    }
    return null;
  };

  // Helper to get user object (supports all auth methods)
  const getUser = (req: any): any => {
    // Replit OAuth users
    if (req.isAuthenticated?.() && req.user?.claims) {
      return {
        ...req.user.claims,
        provider: "replit"
      };
    }
    // Email/Google users (session-based)
    if (req.session?.user) {
      return req.session.user;
    }
    // Guest users
    if (req.session?.guestUser) {
      return {
        id: GUEST_USER_ID,
        email: "guest@demo.app",
        firstName: "Guest",
        lastName: "User",
        profileImageUrl: null,
        provider: "guest"
      };
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

  // Modified auth/user endpoint to support all auth methods
  app.get("/api/auth/user", async (req: any, res) => {
    const user = getUser(req);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // For guest users, check session for onboarding preference
    if (user.provider === "guest") {
      return res.json({
        ...user,
        showOnboarding: req.session.guestShowOnboarding !== false ? "true" : "false"
      });
    }

    // For authenticated users, get onboarding preference from database
    const dbUser = await storage.getUser(user.id);
    res.json({
      ...user,
      showOnboarding: dbUser?.showOnboarding ?? "true"
    });
  });

  // Update user preferences (onboarding)
  app.post("/api/user/preferences", requireUser, async (req: any, res) => {
    try {
      const { showOnboarding } = req.body;
      if (req.userId === GUEST_USER_ID) {
        // Store in session for guest users
        req.session.guestShowOnboarding = showOnboarding !== "false";
        return res.json({ showOnboarding: showOnboarding });
      }
      await storage.updateUserPreferences(req.userId, { showOnboarding });
      res.json({ showOnboarding });
    } catch (err) {
      console.error("Update preferences error:", err);
      res.status(500).json({ message: "Failed to update preferences" });
    }
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
