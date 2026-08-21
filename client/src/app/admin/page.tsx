import { getOverviewStats } from "@/lib/admin/storage";
import { StatCard } from "@/components/admin/stat-card";
import { formatNaira } from "@/lib/paystack/plans";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getOverviewStats();

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-xl font-bold tracking-tight">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} />
        <StatCard label="MRR" value={formatNaira(stats.mrr)} />
        <StatCard label="ARR" value={formatNaira(stats.arr)} />
        <StatCard label="Cancelled Subs" value={stats.cancelledSubscriptions.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Free" value={stats.freeUsers.toLocaleString()} />
        <StatCard label="Pro" value={stats.proUsers.toLocaleString()} />
        <StatCard label="Premium Plus" value={stats.premiumPlusUsers.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="New Today" value={stats.newUsersToday} />
        <StatCard label="New This Week" value={stats.newUsersWeek} />
        <StatCard label="New This Month" value={stats.newUsersMonth} />
        <StatCard label="Referral Signups" value={stats.referralSignups} />
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <StatCard label="Avg Habits / User" value={stats.avgHabitsPerUser} />
      </div>

      <p className="text-xs text-muted-foreground">
        Guest-mode usage isn't included here -- guest data never touches the database (see{" "}
        <code>lib/guest-storage.ts</code>), so there's nothing to count server-side.
      </p>
    </div>
  );
}
