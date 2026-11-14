import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// One-line explanation above a table: how to read it and how it is sorted.
export function TableCaption({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm text-muted-foreground">{children}</p>;
}

// The standard cell: the main fact on top, supporting facts in small muted lines below.
export function Cell({
  main,
  children,
  className,
}: {
  main: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-0.5", className)}>
      <div className="text-sm font-medium text-card-foreground">{main}</div>
      {children && <div className="grid gap-0.5 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table
        className={cn(
          "w-full text-left text-sm [&_tbody_tr:last-child_td]:border-b-0",
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
        "border-b border-border/60 bg-muted/50 px-4 py-3 text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase",
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
        "border-b border-border/60 px-4 py-3.5 align-middle text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}
