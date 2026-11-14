"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

// A barcode or RFID scanner acts as a keyboard: it types the code and presses Enter.
// Typing a code by hand and pressing Enter works the same way.
const scanClass =
  "h-9 w-full rounded-md border border-primary/50 bg-background/40 pr-3 pl-9 font-mono text-sm text-card-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

// A tag field that is part of a form: the typed or scanned value counts immediately,
// so the form can be submitted without pressing Enter first.
export function TagInput({
  value,
  onChange,
  placeholder = "Scan the tag or type its ID",
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
      <input
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label="Tag ID"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        onKeyDown={(event) => {
          // A scanner ends with Enter; it must not submit the form before the rest is filled in.
          if (event.key === "Enter") event.preventDefault();
        }}
        className={scanClass}
      />
    </div>
  );
}

export function ScanInput({
  onScan,
  placeholder = "Scan barcode or tag, or type a code and press Enter",
  disabled,
  autoFocus,
  className,
}: {
  onScan: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");

  return (
    <div className={cn("relative", className)}>
      <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Scan code"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Enter must not submit a surrounding form.
          event.preventDefault();
          const code = value.trim();
          if (!code) return;
          setValue("");
          onScan(code);
        }}
        className={scanClass}
      />
    </div>
  );
}
