import "server-only";
import { AppError } from "@/lib/errors";
import { backend } from "@/server/backend";
import type { OrderContainer, OrderDetail } from "@/features/orders/types";

const orderPath = (orderId: string) => `/api/orders/${encodeURIComponent(orderId)}`;

const getDetail = (orderId: string) =>
  backend<OrderDetail>(`${orderPath(orderId)}/detail`);

function epcsOf(containers: OrderContainer[]) {
  return containers.flatMap((c) => (c.epc ? [c.epc] : []));
}

// Split the ordered panels evenly across the scanned containers.
// A real packing station records what went into each box; the prototype assumes an even split.
function splitContents(order: OrderDetail, containerCount: number) {
  const perContainer: { sku: string; qty: number }[][] = Array.from(
    { length: containerCount },
    () => [],
  );
  for (const item of order.items) {
    const base = Math.floor(item.quantity / containerCount);
    const extra = item.quantity % containerCount;
    for (let index = 0; index < containerCount; index++) {
      const qty = base + (index < extra ? 1 : 0);
      if (qty > 0) {
        perContainer[index].push({ sku: item.sku ?? item.product_id, qty });
      }
    }
  }
  return perContainer;
}

/** Scan the chosen containers into the open packing session, fill them and close the session. */
export async function packOrder(orderId: string, epcs: string[]) {
  const before = await getDetail(orderId);
  const session = before.packing_session;
  if (!session || session.status !== "OPEN") {
    throw new AppError("CONFLICT", "This order has no open packing session");
  }
  if (epcs.length > 0) {
    await backend(`/api/packing-sessions/${session.id}/scans`, {
      method: "POST",
      body: { epcs },
    });
  }

  const order = await getDetail(orderId);
  if (order.containers.length === 0) {
    throw new AppError("BAD_REQUEST", "Select at least one container to pack");
  }
  const contents = splitContents(order, order.containers.length);
  if (contents.some((list) => list.length === 0)) {
    throw new AppError(
      "BAD_REQUEST",
      "More containers than panels: every container must hold at least one item",
    );
  }
  for (const [index, container] of order.containers.entries()) {
    await backend(
      `/api/packing-sessions/${session.id}/items/${container.container_id}`,
      { method: "PATCH", body: { contents: contents[index] } },
    );
  }
  await backend(`/api/packing-sessions/${session.id}/complete`, { method: "POST" });
}

export async function dispatchOrder(
  orderId: string,
  driverId: string,
  vehicleRef: string,
) {
  const order = await getDetail(orderId);
  await backend(`${orderPath(orderId)}/dispatch`, {
    method: "POST",
    body: {
      driver_id: driverId,
      vehicle_ref: vehicleRef,
      epcs: epcsOf(order.containers),
    },
  });
}

export async function confirmReceipt(
  orderId: string,
  missing: string[],
  damaged: string[],
  notes: string | null,
) {
  const order = await getDetail(orderId);
  const flagged = new Set([...missing, ...damaged]);
  await backend(`${orderPath(orderId)}/confirm-receipt`, {
    method: "POST",
    body: {
      received: order.containers
        .map((c) => c.container_id)
        .filter((containerId) => !flagged.has(containerId)),
      missing,
      damaged,
      notes,
    },
  });
}

export async function requestReturn(orderId: string) {
  const order = await getDetail(orderId);
  const withCustomer = order.containers.filter((c) => c.status === "WITH_CUSTOMER");
  if (withCustomer.length === 0) {
    throw new AppError("CONFLICT", "No containers are with the customer");
  }
  await backend(`${orderPath(orderId)}/returns`, {
    method: "POST",
    body: { container_ids: withCustomer.map((c) => c.container_id) },
  });
}

export async function collectReturn(orderId: string) {
  const order = await getDetail(orderId);
  await backend(`${orderPath(orderId)}/returns/collect`, {
    method: "POST",
    body: {
      epcs: epcsOf(order.containers.filter((c) => c.status === "RETURN_REQUESTED")),
    },
  });
}

/** Simple transitions that only need the order id. */
export function postOrderStep(
  orderId: string,
  step: "cancel" | "depart" | "arrive" | "deliver" | "packing-sessions" | "returns/receive",
) {
  return backend(`${orderPath(orderId)}/${step}`, { method: "POST" });
}

export function postOrder(orderId: string, step: string, body: unknown) {
  return backend(`${orderPath(orderId)}/${step}`, { method: "POST", body });
}
