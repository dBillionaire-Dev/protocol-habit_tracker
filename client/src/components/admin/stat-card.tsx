import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sublabel,
  className,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}
