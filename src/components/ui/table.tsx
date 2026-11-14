import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

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
