import { Check } from "lucide-react";
import { milestoneIndex, orderMilestones } from "@/features/orders/status";
import type { OrderStatus } from "@/features/orders/types";
import { cn } from "@/lib/utils";

export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") return null;
  const reached = milestoneIndex(status);

  return (
    <ol className="flex overflow-x-auto rounded-xl border bg-card px-5 py-5 sm:px-6">
      {orderMilestones.map((label, index) => {
        const done = index <= reached;
        return (
          <li key={label} className="flex min-w-20 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === 0 ? "invisible" : done ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === orderMilestones.length - 1
                    ? "invisible"
                    : index < reached
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "text-xs",
                done ? "font-medium text-card-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
