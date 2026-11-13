import { Badge } from "@/components/ui/badge";
import { orderStatusMeta } from "@/features/orders/status";
import type { OrderStatus } from "@/features/orders/types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = orderStatusMeta[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={meta.tone}>{meta.label.toUpperCase()}</Badge>;
}
