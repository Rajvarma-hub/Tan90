import { z } from "zod";

const id = z.string().min(1).max(64);

export const createOrderSchema = z.object({
  customerId: id,
  stationId: id.nullable(),
  destination: z.string().trim().max(500).nullable(),
  expectedDeliveryAt: z.string().nullable(),
  items: z
    .array(
      z.object({
        productId: id,
        quantity: z.number().int().min(1).max(10_000),
      }),
    )
    .min(1, "Add at least one item"),
});

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), orderId: id, stationId: id }),
  z.object({ action: z.literal("cancel"), orderId: id }),
  z.object({ action: z.literal("start_packing"), orderId: id }),
  z.object({
    action: z.literal("pack"),
    orderId: id,
    epcs: z.array(z.string()).max(100),
  }),
  z.object({
    action: z.literal("dispatch"),
    orderId: id,
    driverId: id,
    vehicleRef: z.string().trim().min(1).max(64),
  }),
  z.object({ action: z.literal("depart"), orderId: id }),
  z.object({ action: z.literal("arrive"), orderId: id }),
  z.object({ action: z.literal("deliver"), orderId: id }),
  z.object({
    action: z.literal("confirm_receipt"),
    orderId: id,
    missing: z.array(id),
    damaged: z.array(id),
    notes: z.string().trim().max(1000).nullable(),
  }),
  z.object({ action: z.literal("request_return"), orderId: id }),
  z.object({
    action: z.literal("assign_return_driver"),
    orderId: id,
    driverId: id,
  }),
  z.object({ action: z.literal("collect_return"), orderId: id }),
  z.object({ action: z.literal("receive_return"), orderId: id }),
  z.object({
    action: z.literal("inspect"),
    orderId: id,
    results: z
      .array(
        z.object({
          containerId: id,
          condition: z.enum(["OK", "DAMAGED", "CONTAMINATED"]),
        }),
      )
      .min(1),
  }),
]);

export type OrderActionInput = z.input<typeof orderActionSchema>;
