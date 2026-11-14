import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Button rules used across the portal:
// md (h-9): header actions, form submits, dialog footers, toolbar buttons, full-width card footers.
// sm (h-8): actions inside table rows and card headers.
// primary = the one main action; outline = secondary and Cancel; danger = destructive row action;
// destructive = confirming a destructive action in a dialog; ghost = quiet actions such as Clear filters.
const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border bg-background/40 text-card-foreground hover:bg-accent",
  danger:
    "border border-destructive/50 bg-destructive/10 text-red-400 hover:bg-destructive/20 hover:text-red-300",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-4 text-sm",
  icon: "size-8",
} as const;

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}
