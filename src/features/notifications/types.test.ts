import { describe, expect, it } from "vitest";
import { notificationHref } from "@/features/notifications/types";

describe("notificationHref", () => {
  it("opens the order a notification is about", () => {
    expect(notificationHref({ reference_type: "order", reference_id: "ord-1" })).toBe("/orders/ord-1");
  });

  it("encodes the id", () => {
    expect(notificationHref({ reference_type: "order", reference_id: "a/b?c" })).toBe(
      "/orders/a%2Fb%3Fc",
    );
  });

  it("has no link without a known reference", () => {
    expect(notificationHref({ reference_type: null, reference_id: null })).toBeNull();
    expect(notificationHref({ reference_type: "order", reference_id: null })).toBeNull();
    expect(notificationHref({ reference_type: "container", reference_id: "c-1" })).toBeNull();
  });
});
