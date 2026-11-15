import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// One palette for the whole portal: gray is neutral or closed, blue is normal and in progress,
// green is done or healthy, amber is waiting for someone, red is a problem.
// The pill stays neutral and only the dot carries the colour; amber and red also tint the pill.
const tones = {
  gray: { dot: "bg-zinc-400", pill: "border-border bg-muted/50" },
  blue: { dot: "bg-blue-400", pill: "border-border bg-muted/50" },
  green: { dot: "bg-emerald-400", pill: "border-border bg-muted/50" },
  amber: { dot: "bg-amber-400", pill: "border-amber-500/30 bg-amber-500/10" },
  red: { dot: "bg-red-400", pill: "border-red-500/30 bg-red-500/10" },
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "gray",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-card-foreground",
        tones[tone].pill,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tones[tone].dot)} />
      {children}
    </span>
  );
}
