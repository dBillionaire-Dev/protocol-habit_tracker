import { db } from "./db";
import { systemEvents, type EventLevel } from "shared/schema";

/**
 * Records a system-level failure for the admin System Health page. Swallows
 * its own errors -- a logging call failing should never take down the code
 * path that was trying to log something.
 */
export async function logSystemEvent(source: string, level: EventLevel, message: string): Promise<void> {
  try {
    await db.insert(systemEvents).values({ source, level, message: message.slice(0, 2000) });
  } catch (err) {
    console.error("[system-log] failed to record event:", err);
  }
}
