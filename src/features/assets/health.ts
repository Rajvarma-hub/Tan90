import type { BadgeTone } from "@/components/ui/badge";

export type Health = "healthy" | "inspection" | "damaged" | "quarantined" | "missing" | "retired";

export const healthMeta: Record<Health, { label: string; tone: BadgeTone; bar: string }> = {
  healthy: { label: "Healthy", tone: "green", bar: "bg-emerald-500" },
  inspection: { label: "Under inspection", tone: "amber", bar: "bg-amber-500" },
  damaged: { label: "Damaged", tone: "red", bar: "bg-red-500" },
  quarantined: { label: "Quarantined", tone: "orange", bar: "bg-orange-500" },
  missing: { label: "Missing", tone: "purple", bar: "bg-purple-500" },
  retired: { label: "Unregistered", tone: "gray", bar: "bg-zinc-600" },
};

export const healthOrder = Object.keys(healthMeta) as Health[];

// Anything in circulation that is not damaged, quarantined, missing or being inspected is healthy.
export function healthOf(status: string): Health {
  switch (status) {
    case "UNDER_INSPECTION":
      return "inspection";
    case "DAMAGED":
      return "damaged";
    case "QUARANTINED":
      return "quarantined";
    case "MISSING":
      return "missing";
    case "RETIRED":
      return "retired";
    default:
      return "healthy";
  }
}

export const needsAttention = (health: Health) =>
  health === "damaged" || health === "quarantined" || health === "missing";

// The registry filter: one health value, or all the ones that need attention together.
export type HealthFilter = Health | "attention" | "";

export function matchesHealth(status: string, filter: HealthFilter): boolean {
  const health = healthOf(status);
  if (filter === "") return health !== "retired";
  if (filter === "attention") return needsAttention(health);
  return health === filter;
}

// Statuses in which the container's own record (type, location) can be edited.
export const EDITABLE_STATUSES = ["AVAILABLE", "DAMAGED", "QUARANTINED", "MISSING"];

export function healthCounts(containers: { status: string }[]): Record<Health, number> {
  const counts = Object.fromEntries(healthOrder.map((health) => [health, 0])) as Record<
    Health,
    number
  >;
  for (const container of containers) counts[healthOf(container.status)] += 1;
  return counts;
}
