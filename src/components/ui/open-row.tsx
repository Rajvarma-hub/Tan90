"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// A table row that opens something when clicked; links and buttons inside it keep their own click.
export function OpenRow({
  onOpen,
  disabled,
  className,
  ...props
}: Omit<ComponentProps<"tr">, "onClick"> & { onOpen: () => void; disabled?: boolean }) {
  return (
    <tr
      {...props}
      tabIndex={disabled ? undefined : 0}
      onClick={(event) => {
        if (disabled || (event.target as HTMLElement).closest("a, button, input, select, textarea")) {
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        if (!disabled && event.key === "Enter" && event.target === event.currentTarget) onOpen();
      }}
      className={cn(
        !disabled && "cursor-pointer focus-visible:bg-accent/40 focus-visible:outline-none",
        className,
      )}
    />
  );
}
