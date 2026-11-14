import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  gray: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-400",
  orange: "border-orange-500/40 bg-orange-500/15 text-orange-400",
  blue: "border-blue-500/40 bg-blue-500/15 text-blue-400",
  cyan: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  purple: "border-purple-500/40 bg-purple-500/15 text-purple-300",
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  red: "border-red-500/40 bg-red-500/15 text-red-400",
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
