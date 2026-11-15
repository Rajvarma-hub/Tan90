import type { BadgeTone } from "@/components/ui/badge";
import type { OrderStatus } from "@/features/orders/types";

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; tone: BadgeTone }
> = {
  PENDING_OPS_APPROVAL: { label: "Pending approval", tone: "amber" },
  APPROVED: { label: "Approved", tone: "blue" },
  PACKING: { label: "Packing", tone: "blue" },
  PACKED: { label: "Packed", tone: "blue" },
  DISPATCHED: { label: "Dispatched", tone: "blue" },
  IN_TRANSIT: { label: "In transit", tone: "blue" },
  ARRIVED: { label: "Arrived", tone: "blue" },
  DELIVERED: { label: "Delivered", tone: "green" },
  CUSTOMER_CONFIRMED: { label: "Confirmed", tone: "green" },
  DISPUTED: { label: "Disputed", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
  RETURN_REQUESTED: { label: "Return requested", tone: "amber" },
  RETURN_COLLECTED: { label: "Return collected", tone: "blue" },
  RETURN_RECEIVED: { label: "Return received", tone: "blue" },
  CLOSED: { label: "Closed", tone: "gray" },
};

export const orderStatuses = Object.keys(orderStatusMeta) as OrderStatus[];

// The groups behind the stat cards on Orders.
export const IN_PROGRESS = new Set<string>([
  "APPROVED",
  "PACKING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED",
]);

export const DELIVERED = new Set<string>([
  "DELIVERED",
  "CUSTOMER_CONFIRMED",
  "RETURN_REQUESTED",
  "RETURN_COLLECTED",
  "RETURN_RECEIVED",
  "CLOSED",
]);

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
