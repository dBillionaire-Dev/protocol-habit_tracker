import { sendEmail } from "./email/resend";
import { storage } from "./storage";
import {
  TRIAL_REMINDER_SCHEDULE,
  TRIAL_CONFIG,
  type SubscriptionTrial,
  type TrialReminderKey,
  type TrialType,
} from "shared/schema";
import { planDisplayName } from "./entitlements";

// Pure function: given a trial row and "now", which reminder checkpoints
// (spec section 1's "2 days remaining" / "1 day remaining" / "final
// reminder") are due to be sent RIGHT NOW but haven't been sent yet.
// Kept separate from the DB/email side effects below so this is
// trivially unit-testable without a database or network.
export function dueReminders(trial: SubscriptionTrial, now: Date): TrialReminderKey[] {
  const schedule = TRIAL_REMINDER_SCHEDULE[trial.trialType as TrialType];
  const sentAt: Record<TrialReminderKey, Date | null> = {
    two_days: trial.twoDayReminderSentAt,
    one_day: trial.oneDayReminderSentAt,
    final: trial.finalReminderSentAt,
  };

  return schedule
    .filter(({ key, hoursBefore }) => {
      if (sentAt[key]) return false; // already sent
      const fireAt = new Date(trial.endsAt.getTime() - hoursBefore * 60 * 60 * 1000);
      return now >= fireAt && now < trial.endsAt;
    })
    .map((s) => s.key);
}

function reminderCopy(trialType: TrialType, key: TrialReminderKey, endsAt: Date) {
  const config = TRIAL_CONFIG[trialType];
  const planName = planDisplayName(config.grantsPlan);
  const expiryDate = endsAt.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  const urgency: Record<TrialReminderKey, string> = {
    two_days: `2 days left on your ${planName} trial`,
    one_day: `1 day left on your ${planName} trial`,
    final: `Your ${planName} trial ends today`,
  };

  const bodyIntro: Record<TrialReminderKey, string> = {
    two_days: `You have 2 days remaining on your ${planName} trial.`,
    one_day: `You have 1 day remaining on your ${planName} trial.`,
    final: `Your ${planName} trial ends today, ${expiryDate}.`,
  };

  return {
    subject: urgency[key],
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">Protocol</h2>
        <p>${bodyIntro[key]}</p>
        <p>
          After it ends, you'll return to your previous plan unless you subscribe to keep
          ${planName}.
        </p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://protocol-nex.vercel.app"}/pricing"
             style="display: inline-block; background: #d97706; color: #fff; padding: 10px 20px;
                    border-radius: 6px; text-decoration: none; margin-top: 12px;">
            Keep ${planName}
          </a>
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          Trial ends ${expiryDate}.
        </p>
      </div>
    `,
  };
}

// The actual sweep: called by the cron route (app/api/cron/trial-reminders).
// For every currently-active trial across all users, sends whichever
// reminder checkpoints are newly due and marks them sent so a checkpoint
// is never emailed twice, even if the cron fires more often than the
// schedule's granularity.
export async function runTrialReminderSweep(): Promise<{ checked: number; sent: number }> {
  const activeTrials = await storage.getActiveTrialsForReminders();
  const now = new Date();
  let sent = 0;

  for (const trial of activeTrials) {
    if (!trial.userEmail) continue; // no email on file — nothing to send to

    const due = dueReminders(trial, now);
    for (const key of due) {
      const { subject, html } = reminderCopy(trial.trialType as TrialType, key, trial.endsAt);
      try {
        await sendEmail({ to: trial.userEmail, subject, html });
        await storage.markTrialReminderSent(trial.id, key);
        sent += 1;
      } catch (err) {
        // Don't let one failed send (e.g. a transient Resend error)
        // abort the whole sweep — log and move on to the next trial so
        // one bad email address doesn't block everyone else's reminders.
        console.error(`Failed to send ${key} trial reminder for trial ${trial.id}:`, err);
      }
    }
  }

  return { checked: activeTrials.length, sent };
}
