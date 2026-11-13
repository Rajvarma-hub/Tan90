"use client";

import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-lg bg-muted p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "border bg-card text-card-foreground shadow-sm"
              : "border border-transparent text-muted-foreground hover:text-card-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
