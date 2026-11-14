import { Badge } from "@/components/ui/badge";
import { healthMeta, healthOrder, type Health } from "@/features/assets/health";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function HealthBadge({ health }: { health: Health }) {
  return <Badge tone={healthMeta[health].tone}>{healthMeta[health].label}</Badge>;
}

// A stacked bar of the health mix, with a legend that only lists what is present.
export function HealthBar({
  counts,
  showLegend = true,
}: {
  counts: Record<Health, number>;
  showLegend?: boolean;
}) {
  const present = healthOrder.filter((health) => health !== "retired" && counts[health] > 0);
  const total = present.reduce((sum, health) => sum + counts[health], 0);

  if (total === 0) {
    return <div className="h-2 rounded-full bg-border" aria-label="No assets" />;
  }

  return (
    <div className="grid gap-2">
      <div
        role="img"
        aria-label={present.map((h) => `${healthMeta[h].label} ${counts[h]}`).join(", ")}
        className="flex h-2 overflow-hidden rounded-full bg-border"
      >
        {present.map((health) => (
          <span
            key={health}
            className={cn("h-full", healthMeta[health].bar)}
            style={{ width: `${(counts[health] / total) * 100}%` }}
          />
        ))}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {present.map((health) => (
            <li key={health} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", healthMeta[health].bar)} />
              {healthMeta[health].label}
              <span className="font-medium text-card-foreground tabular-nums">
                {formatNumber(counts[health])}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
