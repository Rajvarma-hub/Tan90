import type { ComponentProps, ReactNode } from "react";
import type { BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const accents: Record<BadgeTone, string> = {
  gray: "[&>td:first-child]:shadow-zinc-500",
  blue: "[&>td:first-child]:shadow-blue-500",
  green: "[&>td:first-child]:shadow-emerald-500",
  amber: "[&>td:first-child]:shadow-amber-500",
  red: "[&>td:first-child]:shadow-red-500",
};

// A coloured bar on a row's left edge, for the rows that need attention.
export function rowAccent(tone?: BadgeTone | null) {
  return tone ? cn("[&>td:first-child]:shadow-[inset_3px_0_0_0]", accents[tone]) : undefined;
}

// One-line explanation above a table: how to read it and how it is sorted.
export function TableCaption({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm text-muted-foreground">{children}</p>;
}

// The standard cell: the main fact on top, supporting facts in small muted lines below.
// Pair `center` with `className="text-center"` on the column's Th and Td.
export function Cell({
  main,
  children,
  center,
  className,
}: {
  main: ReactNode;
  children?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-0.5", center && "justify-items-center text-center", className)}>
      <div className="text-sm font-medium text-card-foreground">{main}</div>
      {children && <div className="grid gap-0.5 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

// Placeholder for a value that does not exist.
export function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

// A status badge with an optional short note beneath it.
export function BadgeCell({ badge, note }: { badge: ReactNode; note?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-1">
      {badge}
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/40">
      <table
        className={cn(
          "w-full text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-foreground/5 [&_tbody_tr:last-child_td]:border-b-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-border/60 bg-muted/70 px-4 py-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "border-b border-border/40 px-4 py-4 align-middle text-card-foreground first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}
