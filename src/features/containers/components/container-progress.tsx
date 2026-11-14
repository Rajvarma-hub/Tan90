import { Check, TriangleAlert } from "lucide-react";
import {
  attentionNotes,
  containerStatusMeta,
  lifecycleIndex,
  lifecycleSteps,
} from "@/features/containers/status";
import { cn } from "@/lib/utils";

export function ContainerProgress({ status }: { status: string }) {
  const current = lifecycleIndex(status);

  if (current === -1) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
        <div>
          <p className="font-medium text-card-foreground">
            {containerStatusMeta[status]?.label ?? status}
          </p>
          <p className="text-muted-foreground">{attentionNotes[status]}</p>
        </div>
      </div>
    );
  }

  return (
    <ol className="flex overflow-x-auto rounded-xl border bg-card px-5 py-5 sm:px-6">
      {lifecycleSteps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.label} className="flex min-w-24 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === 0 ? "invisible" : index <= current ? "bg-primary" : "bg-border",
                )}
              />
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs",
                  done || active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                  active && "ring-4 ring-primary/25",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === lifecycleSteps.length - 1
                    ? "invisible"
                    : index < current
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "text-center text-xs",
                done || active ? "font-medium text-card-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
