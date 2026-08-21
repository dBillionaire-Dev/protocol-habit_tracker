import { getSystemHealth } from "@/lib/admin/storage";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const health = await getSystemHealth();

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight">System Health</h1>

      <div className="flex items-center gap-2 text-sm">
        <span className={`w-2 h-2 rounded-full ${health.dbOk ? "bg-green-500" : "bg-red-500"}`} />
        Database {health.dbOk ? "Operational" : "Unreachable"}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Errors -- Last 24h
        </h2>
        {health.eventsBySource.length === 0 ? (
          <p className="text-sm text-muted-foreground">No errors logged in the last 24 hours.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">Level</th>
                  <th className="text-left px-4 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {health.eventsBySource.map((e, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2">{e.source}</td>
                    <td className="px-4 py-2 capitalize">{e.level}</td>
                    <td className="px-4 py-2 font-mono">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Events</h2>
        <div className="space-y-2">
          {health.recentEvents.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
          {health.recentEvents.map((e) => (
            <div key={e.id} className="text-sm border border-border rounded-md p-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {e.source} &middot; {e.level}
                </span>
                <span>{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="font-mono text-xs break-words">{e.message}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground max-w-lg">
        This only covers a handful of instrumented spots (the Paystack webhook first) via{" "}
        <code>lib/system-log.ts</code>&apos;s <code>logSystemEvent()</code> -- not full request-level observability.
        Add more calls to it as you find spots worth watching.
      </p>
    </div>
  );
}
