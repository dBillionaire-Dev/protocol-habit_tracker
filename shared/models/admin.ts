import { pgTable, varchar, serial, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

// --- Admin audit log ---
// One row per admin action that changes something. Deliberately denormalizes
// the admin's email onto the row so the log still reads correctly even if
// that admin account is later deleted or loses admin access.
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminUserId: varchar("admin_user_id").notNull().references(() => users.id),
  adminEmail: varchar("admin_email").notNull(),
  action: varchar("action").notNull(), // e.g. "user.suspend", "user.change_plan"
  targetType: varchar("target_type").notNull(), // e.g. "user"
  targetId: varchar("target_id").notNull(),
  details: text("details"), // short human-readable free text, not structured JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;

// --- Support tickets ---
// Deliberately a single flat table, not a full threaded conversation --
// one submission, one admin reply, one status. Matches the current
// support surface (a bug-report form + FAQ + AI chat), which doesn't
// need back-and-forth threading yet. Revisit if that changes.
export const TICKET_STATUSES = ["open", "pending", "resolved"] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  // Nullable: guest-mode submitters have no real account row. `email`
  // below is how an admin actually reaches them either way.
  userId: varchar("user_id").references(() => users.id),
  email: varchar("email"),
  category: varchar("category").notNull().default("Other"),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status", { enum: TICKET_STATUSES }).notNull().default("open"),
  adminReply: text("admin_reply"),
  repliedByEmail: varchar("replied_by_email"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// --- System event log ---
// Intentionally minimal: a handful of high-value spots (billing webhook
// failures first) log here via lib/system-log.ts's logSystemEvent(). Not
// a full observability pipeline -- a real APM/logging service is the
// right next step once this app has traffic that justifies one.
export const EVENT_LEVELS = ["error", "warning"] as const;
export type EventLevel = typeof EVENT_LEVELS[number];

export const systemEvents = pgTable("system_events", {
  id: serial("id").primaryKey(),
  source: varchar("source").notNull(), // e.g. "billing_webhook", "ai", "support_chat"
  level: varchar("level", { enum: EVENT_LEVELS }).notNull().default("error"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SystemEvent = typeof systemEvents.$inferSelect;
