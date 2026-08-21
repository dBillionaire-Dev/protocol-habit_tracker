import { listAuditLog } from "@/lib/admin/storage";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const { rows } = await listAuditLog(100, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold tracking-tight">Audit Log</h1>
      <p className="text-sm text-muted-foreground">Most recent 100 admin actions.</p>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No admin actions logged yet.</p>}
        {rows.map((entry) => (
          <div key={entry.id} className="border border-border rounded-md p-3 text-sm">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{entry.adminEmail}</span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1">
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{entry.action}</span>{" "}
              <span className="text-muted-foreground">
                {entry.targetType}:{entry.targetId}
              </span>
            </p>
            {entry.details && <p className="mt-1 text-muted-foreground">{entry.details}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
