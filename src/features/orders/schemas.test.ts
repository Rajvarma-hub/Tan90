import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { createOrderSchema, orderActionSchema } from "@/features/orders/schemas";

const order = {
  customerId: "cust-1",
  stationId: null,
  destination: null,
  expectedDeliveryAt: null,
  items: [{ productId: "prd-1", quantity: 2 }],
};

describe("createOrderSchema", () => {
  it("accepts a valid order", () => {
    expect(createOrderSchema.safeParse(order).success).toBe(true);
  });

  it("requires at least one item", () => {
    expect(createOrderSchema.safeParse({ ...order, items: [] }).success).toBe(false);
  });

  it.each([0, 1.5, 10_001])("rejects quantity %s", (quantity) => {
    const items = [{ productId: "prd-1", quantity }];
    expect(createOrderSchema.safeParse({ ...order, items }).success).toBe(false);
  });
});

describe("orderActionSchema", () => {
  it("selects the schema by action", () => {
    expect(
      orderActionSchema.safeParse({ action: "approve", orderId: "o1", stationId: "s1" }).success,
    ).toBe(true);
    expect(orderActionSchema.safeParse({ action: "approve", orderId: "o1" }).success).toBe(false);
  });

  it("rejects unknown actions", () => {
    expect(orderActionSchema.safeParse({ action: "explode", orderId: "o1" }).success).toBe(false);
  });

  it("limits a dispatch scan to 500 codes", () => {
    const base = { action: "dispatch", orderId: "o1", driverId: "d1", vehicleRef: "KA-1" };
    const codes = (n: number) => Array.from({ length: n }, (_, i) => `C${i}`);
    expect(orderActionSchema.safeParse({ ...base, codes: codes(500) }).success).toBe(true);
    expect(orderActionSchema.safeParse({ ...base, codes: codes(501) }).success).toBe(false);
    expect(orderActionSchema.safeParse({ ...base, codes: [] }).success).toBe(false);
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data", () => {
    expect(parseOrThrow(createOrderSchema, order).items).toHaveLength(1);
  });

  it("throws a validation AppError with field errors", () => {
    try {
      parseOrThrow(createOrderSchema, { ...order, customerId: "" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("VALIDATION_ERROR");
      expect(appError.status).toBe(422);
      expect(appError.fieldErrors?.customerId).toBeDefined();
    }
  });
});
