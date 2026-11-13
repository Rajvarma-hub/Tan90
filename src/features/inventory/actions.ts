"use server";

import {
  createProductSchema,
  createStationSchema,
  recordMovementSchema,
} from "@/features/inventory/schemas";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";

export const createProduct = createAction(createProductSchema, async (input) => {
  await backend("/api/products", {
    method: "POST",
    body: { sku: input.sku, name: input.name, setpoint_c: input.setpointC },
  });
  return null;
});

export const recordMovement = createAction(recordMovementSchema, async (input) => {
  const outward = input.kind === "DAMAGED" || input.kind === "ADJUSTMENT_OUT";
  await backend("/api/inventory/movements", {
    method: "POST",
    body: {
      product_id: input.productId,
      location_id: input.locationId,
      direction: outward || input.kind === "INTERNAL_TRANSFER" ? "OUTWARD" : "INWARD",
      reason: input.kind.startsWith("ADJUSTMENT") ? "ADJUSTMENT" : input.kind,
      quantity: input.quantity,
      to_location_id: input.kind === "INTERNAL_TRANSFER" ? input.toLocationId : null,
      reference: input.reference || null,
    },
  });
  return null;
});

export const createStation = createAction(createStationSchema, async (input) => {
  await backend("/api/stations", {
    method: "POST",
    body: {
      code: input.code,
      name: input.name,
      kind: input.kind,
      address: input.address || null,
    },
  });
  return null;
});
