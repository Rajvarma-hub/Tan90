import type { BadgeTone } from "@/components/ui/badge";
import type { OrderStatus } from "@/features/orders/types";

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; tone: BadgeTone }
> = {
  PENDING_OPS_APPROVAL: { label: "Pending approval", tone: "amber" },
  APPROVED: { label: "Approved", tone: "blue" },
  PACKING: { label: "Packing", tone: "cyan" },
  PACKED: { label: "Packed", tone: "cyan" },
  DISPATCHED: { label: "Dispatched", tone: "purple" },
  IN_TRANSIT: { label: "In transit", tone: "purple" },
  ARRIVED: { label: "Arrived", tone: "purple" },
  DELIVERED: { label: "Delivered", tone: "green" },
  CUSTOMER_CONFIRMED: { label: "Confirmed", tone: "green" },
  DISPUTED: { label: "Disputed", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
  RETURN_REQUESTED: { label: "Return requested", tone: "orange" },
  RETURN_COLLECTED: { label: "Return collected", tone: "orange" },
  RETURN_RECEIVED: { label: "Return received", tone: "orange" },
  CLOSED: { label: "Closed", tone: "gray" },
};

export const orderStatuses = Object.keys(orderStatusMeta) as OrderStatus[];

// Milestones for the progress strip, and how far each status has got.
export const orderMilestones = [
  "Placed",
  "Approved",
  "Packed",
  "Dispatched",
  "Delivered",
  "Confirmed",
  "Returned",
  "Closed",
] as const;

const reached: Record<OrderStatus, number> = {
  PENDING_OPS_APPROVAL: 0,
  CANCELLED: 0,
  APPROVED: 1,
  PACKING: 1,
  PACKED: 2,
  DISPATCHED: 3,
  IN_TRANSIT: 3,
  ARRIVED: 3,
  DELIVERED: 4,
  CUSTOMER_CONFIRMED: 5,
  DISPUTED: 4,
  RETURN_REQUESTED: 5,
  RETURN_COLLECTED: 5,
  RETURN_RECEIVED: 6,
  CLOSED: 7,
};

export function milestoneIndex(status: OrderStatus): number {
  return reached[status];
}
