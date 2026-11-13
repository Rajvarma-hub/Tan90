import { z } from "zod";

const id = z.string().min(1).max(64);

export const createProductSchema = z.object({
  sku: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(200),
  setpointC: z.number().min(-100).max(100).nullable(),
});

export const recordMovementSchema = z.object({
  productId: id,
  locationId: id,
  kind: z.enum([
    "NEW_INVENTORY",
    "INTERNAL_TRANSFER",
    "DAMAGED",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
  ]),
  quantity: z.number().int().min(1).max(1_000_000),
  toLocationId: id.nullable(),
  reference: z.string().trim().max(120).nullable(),
});

export const createStationSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["FREEZING_STATION", "WAREHOUSE"]),
  address: z.string().trim().max(500).nullable(),
});
