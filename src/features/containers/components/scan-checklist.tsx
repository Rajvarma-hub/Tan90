"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { ScanInput } from "@/components/ui/scan-input";
import { cn } from "@/lib/utils";

export type ChecklistContainer = {
  container_id: string;
  container_code: string;
  container_type: string;
  epc: string | null;
};

/**
 * Verify a set of expected containers by scanning each one.
 * Reports the scanned container codes; the caller decides what "complete" allows.
 */
export function ScanChecklist({
  containers,
  onChange,
}: {
  containers: ChecklistContainer[];
  onChange: (scannedCodes: string[]) => void;
}) {
  const [scanned, setScanned] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function update(next: string[]) {
    setScanned(next);
    onChange(next);
  }

  function handleScan(code: string) {
    const match = containers.find(
      (c) =>
        c.container_code.toLowerCase() === code.toLowerCase() || c.epc === code,
    );
    if (!match) {
      setMessage({ ok: false, text: `${code} is not on this order` });
    } else if (scanned.includes(match.container_code)) {
      setMessage({ ok: true, text: `${match.container_code} already scanned` });
    } else {
      setMessage({ ok: true, text: `${match.container_code} verified` });
      update([...scanned, match.container_code]);
    }
  }

  return (
    <div className="grid gap-3">
      <ScanInput onScan={handleScan} autoFocus />
      {message && (
        <p
          role="status"
          className={cn("text-sm", message.ok ? "text-emerald-400" : "text-red-400")}
        >
          {message.text}
        </p>
      )}
      <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2">
        {containers.map((container) => {
          const done = scanned.includes(container.container_code);
          return (
            <li key={container.container_id}>
              <button
                type="button"
                title="Click to mark without a scanner"
                onClick={() =>
                  update(
                    done
                      ? scanned.filter((code) => code !== container.container_code)
                      : [...scanned, container.container_code],
                  )
                }
                className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium text-card-foreground">
                  {container.container_code}
                </span>
                <span className="text-muted-foreground">{container.container_type}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {scanned.length} of {containers.length} verified. No scanner? Click a row to
        mark it.
      </p>
    </div>
  );
}
