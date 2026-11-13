import "server-only";
import { AppError } from "@/lib/errors";
import { backend } from "@/server/backend";
import type { OrderDetail } from "@/features/orders/types";

const orderPath = (orderId: string) => `/api/orders/${encodeURIComponent(orderId)}`;

const getDetail = (orderId: string) =>
  backend<OrderDetail>(`${orderPath(orderId)}/detail`);

export type ScanOutcome = {
  outcome: "added" | "duplicate" | "unknown" | "unavailable";
  message: string;
};

async function openSession(orderId: string) {
  const order = await getDetail(orderId);
  const session = order.packing_session;
  if (!session || session.status !== "OPEN") {
    throw new AppError("CONFLICT", "This order has no open packing session");
  }
  return { order, sessionId: session.id };
}

/** Scan one container (tag ID or barcode label) into the order's open packing session. */
export async function scanIntoPacking(orderId: string, code: string): Promise<ScanOutcome> {
  const { sessionId } = await openSession(orderId);
  const result = await backend<{
    added: { container_code: string }[];
    duplicates: string[];
    unknown_epcs: string[];
    unavailable: { container_id: string; status: string }[];
  }>(`/api/packing-sessions/${sessionId}/scans`, {
    method: "POST",
    body: { epcs: [code] },
  });
  if (result.added.length > 0) {
    return { outcome: "added", message: `${result.added[0].container_code} added` };
  }
  if (result.duplicates.length > 0) {
    return { outcome: "duplicate", message: `${code} is already on this order` };
  }
  if (result.unavailable.length > 0) {
    const { status } = result.unavailable[0];
    return {
      outcome: "unavailable",
      message:
        status === "AVAILABLE"
          ? `${code} is at a different station`
          : `${code} is not free (${status.replaceAll("_", " ").toLowerCase()})`,
    };
  }
  return { outcome: "unknown", message: `${code} does not match any container` };
}

export async function removeFromPacking(orderId: string, containerId: string) {
  const { sessionId } = await openSession(orderId);
  await backend(`/api/packing-sessions/${sessionId}/items/${containerId}`, {
    method: "DELETE",
  });
}

/** Save what went into each container, then close the packing session. */
export async function completePacking(
  orderId: string,
  contents: { containerId: string; lines: { sku: string; qty: number }[] }[],
) {
  const { order, sessionId } = await openSession(orderId);
  if (order.containers.length === 0) {
    throw new AppError("BAD_REQUEST", "Scan at least one container before completing");
  }
  const byContainer = new Map(
    contents.map((entry) => [
      entry.containerId,
      entry.lines.filter((line) => line.qty > 0),
    ]),
  );
  for (const container of order.containers) {
    if (!byContainer.get(container.container_id)?.length) {
      throw new AppError(
        "BAD_REQUEST",
        `${container.container_code} is empty. Add its contents or remove it.`,
      );
    }
  }
  // Everything ordered must be packed, no more and no less.
  for (const item of order.items) {
    const sku = item.sku ?? item.product_id;
    const packed = order.containers.reduce(
      (sum, container) =>
        sum +
        (byContainer.get(container.container_id) ?? [])
          .filter((line) => line.sku === sku)
          .reduce((total, line) => total + line.qty, 0),
      0,
    );
    if (packed !== item.quantity) {
      throw new AppError(
        "BAD_REQUEST",
        `${item.product_name}: packed ${packed} of ${item.quantity} ordered`,
      );
    }
  }
  for (const container of order.containers) {
    await backend(`/api/packing-sessions/${sessionId}/items/${container.container_id}`, {
      method: "PATCH",
      body: { contents: byContainer.get(container.container_id) },
    });
  }
  await backend(`/api/packing-sessions/${sessionId}/complete`, { method: "POST" });
}

export function dispatchOrder(
  orderId: string,
  driverId: string,
  vehicleRef: string,
  codes: string[],
) {
  // The backend rejects the dispatch unless the scans match the packed containers exactly.
  return backend(`${orderPath(orderId)}/dispatch`, {
    method: "POST",
    body: { driver_id: driverId, vehicle_ref: vehicleRef, epcs: codes },
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

export function collectReturn(orderId: string, codes: string[]) {
  return backend(`${orderPath(orderId)}/returns/collect`, {
    method: "POST",
    body: { epcs: codes },
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
