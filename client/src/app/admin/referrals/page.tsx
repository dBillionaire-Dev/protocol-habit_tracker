import { getReferralStats } from "@/lib/admin/storage";
import { StatCard } from "@/components/admin/stat-card";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const stats = await getReferralStats();

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight">Referrals</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Referrals" value={stats.totalReferrals} />
        <StatCard label="Converted" value={stats.converted} />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} />
        <StatCard label="Rewards Granted" value={stats.totalRewardsGranted} sublabel={`${stats.totalBonusDaysGranted} bonus days total`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top Referrers</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">#</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {stats.topReferrers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No referrals yet.
                  </td>
                </tr>
              )}
              {stats.topReferrers.map((r, i) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2">{r.email ?? r.userId}</td>
                  <td className="px-4 py-2 font-mono">{r.referralCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
