"use server";

import {
  createOrderSchema,
  orderActionSchema,
  scanIntoPackingSchema,
} from "@/features/orders/schemas";
import * as orders from "@/features/orders/service";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";

export const createOrder = createAction(createOrderSchema, async (input) => {
  const order = await backend<{ id: string }>("/api/orders", {
    method: "POST",
    body: {
      customer_id: input.customerId,
      station_id: input.stationId,
      destination: input.destination || null,
      expected_delivery_at: input.expectedDeliveryAt
        ? new Date(input.expectedDeliveryAt).toISOString()
        : null,
      items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
    },
  });
  return { id: order.id };
});

// Returns the scan outcome rather than failing, so the packer sees why a scan was not added.
export const scanIntoPacking = createAction(scanIntoPackingSchema, ({ orderId, code }) =>
  orders.scanIntoPacking(orderId, code),
);

// One entry point for every step in the order lifecycle.
export const runOrderAction = createAction(orderActionSchema, async (input) => {
  const { orderId } = input;
  switch (input.action) {
    case "approve":
      await orders.postOrder(orderId, "approve", { station_id: input.stationId });
      break;
    case "cancel":
      await orders.postOrderStep(orderId, "cancel");
      break;
    case "start_packing":
      await orders.postOrderStep(orderId, "packing-sessions");
      break;
    case "remove_container":
      await orders.removeFromPacking(orderId, input.containerId);
      break;
    case "complete_packing":
      await orders.completePacking(orderId, input.contents);
      break;
    case "dispatch":
      await orders.dispatchOrder(orderId, input.driverId, input.vehicleRef, input.codes);
      break;
    case "depart":
    case "arrive":
    case "deliver":
      await orders.postOrderStep(orderId, input.action);
      break;
    case "confirm_receipt":
      await orders.confirmReceipt(orderId, input.missing, input.damaged, input.notes);
      break;
    case "request_return":
      await orders.requestReturn(orderId);
      break;
    case "assign_return_driver":
      await orders.postOrder(orderId, "returns/assign-driver", {
        driver_id: input.driverId,
      });
      break;
    case "collect_return":
      await orders.collectReturn(orderId, input.codes);
      break;
    case "receive_return":
      await orders.postOrderStep(orderId, "returns/receive");
      break;
    case "inspect":
      await orders.postOrder(orderId, "returns/inspect", {
        results: input.results.map((result) => ({
          container_id: result.containerId,
          condition: result.condition,
        })),
      });
      break;
  }
  return null;
});
