import type { BadgeTone } from "@/components/ui/badge";

// The backend has no category column; the portal derives it from the PCM setpoint.
export function categoryOf(setpoint: number | null): {
  label: string;
  tone: BadgeTone;
} {
  if (setpoint === null) return { label: "Miscellaneous", tone: "gray" };
  if (setpoint <= -15) return { label: "Frozen", tone: "blue" };
  if (setpoint <= 8) return { label: "Chiller", tone: "cyan" };
  return { label: "Ambient", tone: "amber" };
}
