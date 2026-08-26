import { getSubscriptionStats } from "@/lib/admin/storage";
import { StatCard } from "@/components/admin/stat-card";
import { formatNaira } from "@/lib/paystack/plans";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const stats = await getSubscriptionStats();

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-xl font-bold tracking-tight">Subscriptions &amp; Revenue</h1>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <StatCard label="MRR" value={formatNaira(stats.mrr)} />
        <StatCard label="ARR" value={formatNaira(stats.arr)} />
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <StatCard label="Pro (MRR)" value={formatNaira(stats.mrrByPlan.pro)} />
        <StatCard label="Premium Plus (MRR)" value={formatNaira(stats.mrrByPlan.premium_plus)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
        <StatCard label="New Subs (30d)" value={stats.newSubscriptions30d} />
        <StatCard label="Cancellations (30d)" value={stats.cancellations30d} />
        <StatCard label="Failed Payments (30d)" value={stats.failedPayments30d} />
      </div>

      <p className="text-xs text-muted-foreground max-w-lg">
        MRR/ARR are computed from active subscriptions using the display pricing in{" "}
        <code>lib/paystack/plans.ts</code> (annual plans normalized to a monthly figure). This reflects what
        PROTOCOL believes is active -- Paystack's dashboard is the source of truth for actual settled revenue.
      </p>
    </div>
  );
}
