import { describe, expect, it } from "vitest";
import {
  DELIVERED,
  IN_PROGRESS,
  milestoneIndex,
  orderMilestones,
  orderStatusMeta,
  orderStatuses,
} from "@/features/orders/status";

describe("order status", () => {
  it("has a label for every status", () => {
    for (const status of orderStatuses) {
      expect(orderStatusMeta[status].label).not.toBe("");
    }
  });

  it("keeps the stat-card groups apart", () => {
    for (const status of IN_PROGRESS) expect(DELIVERED.has(status)).toBe(false);
  });

  it("moves forward along the happy path", () => {
    const path = [
      "PENDING_OPS_APPROVAL",
      "APPROVED",
      "PACKED",
      "DISPATCHED",
      "DELIVERED",
      "CUSTOMER_CONFIRMED",
      "RETURN_RECEIVED",
      "CLOSED",
    ] as const;
    const indexes = path.map(milestoneIndex);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(milestoneIndex("CLOSED")).toBe(orderMilestones.length - 1);
  });
});
