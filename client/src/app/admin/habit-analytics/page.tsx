import { getHabitAnalytics } from "@/lib/admin/storage";
import { StatCard } from "@/components/admin/stat-card";

export const dynamic = "force-dynamic";

export default async function AdminHabitAnalyticsPage() {
  const stats = await getHabitAnalytics();

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight">Habit Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Avg Habits / User" value={stats.avgHabitsPerUser} />
        <StatCard label="Avg Completion Rate" value={`${stats.avgCompletionRate}%`} sublabel="Build habits only" />
        <StatCard label="Avg Streak" value={`${stats.avgStreak}d`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Build Habits" value={`${stats.buildPercent}%`} />
        <StatCard label="Avoidance Habits" value={`${stats.avoidancePercent}%`} />
        <StatCard label="Users With Active Debt" value={`${stats.usersWithActiveDebtPercent}%`} />
      </div>

      <p className="text-xs text-muted-foreground max-w-lg">
        Aggregate only -- this never shows individual habit names, notes, or history. "Active debt" counts a user
        if either an avoidance habit has <code>debtCount &gt; 0</code>, or a build habit's missed days exceed its
        logged repayments (see <code>buildDebtRepayments</code> in <code>shared/schema.ts</code>).
      </p>
    </div>
  );
}
