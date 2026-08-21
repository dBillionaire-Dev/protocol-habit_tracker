import { db } from "./db";
import { supportTickets, type SupportTicket, type TicketStatus } from "shared/schema";
import { eq, desc, count } from "drizzle-orm";

export async function createTicket(input: {
  userId: string | null;
  email: string | null;
  category: string;
  subject: string;
  message: string;
}): Promise<SupportTicket> {
  const [ticket] = await db.insert(supportTickets).values(input).returning();
  return ticket;
}

export async function listTickets(status?: TicketStatus): Promise<SupportTicket[]> {
  const query = db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  if (status) {
    return query.where(eq(supportTickets.status, status));
  }
  return query;
}

export async function getTicket(id: number): Promise<SupportTicket | undefined> {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
  return ticket;
}

export async function replyToTicket(
  id: number,
  message: string,
  repliedByEmail: string,
): Promise<SupportTicket> {
  const [ticket] = await db
    .update(supportTickets)
    .set({
      adminReply: message,
      repliedByEmail,
      repliedAt: new Date(),
      status: "resolved",
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, id))
    .returning();
  return ticket;
}

export async function setTicketStatus(id: number, status: TicketStatus): Promise<SupportTicket> {
  const [ticket] = await db
    .update(supportTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportTickets.id, id))
    .returning();
  return ticket;
}

export async function getTicketCountsByStatus(): Promise<Record<TicketStatus, number>> {
  const rows = await db
    .select({ status: supportTickets.status, count: count() })
    .from(supportTickets)
    .groupBy(supportTickets.status);

  const result: Record<TicketStatus, number> = { open: 0, pending: 0, resolved: 0 };
  for (const row of rows) {
    result[row.status as TicketStatus] = row.count;
  }
  return result;
}
