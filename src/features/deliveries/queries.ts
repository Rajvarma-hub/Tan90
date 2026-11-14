import "server-only";
import { backend } from "@/server/backend";
import type { Option, OrderDetail, OrderStatus } from "@/features/orders/types";

type ApiOrder = {
  id: string;
  status: OrderStatus;
  driver_id: string | null;
  return_driver_id: string | null;
};

export type DriverTask = {
  kind: "DELIVERY" | "PICKUP";
  driverId: string;
  order: OrderDetail;
};

const DELIVERY_STATUSES = new Set<OrderStatus>(["DISPATCHED", "IN_TRANSIT", "ARRIVED"]);

/** Every open delivery and return pickup, with the containers each driver must handle. */
export async function getDriverBoard(): Promise<{ drivers: Option[]; tasks: DriverTask[] }> {
  const [orders, drivers] = await Promise.all([
    backend<ApiOrder[]>("/api/orders"),
    backend<{ id: string; full_name: string }[]>("/api/users?role=DRIVER"),
  ]);

  const open: { kind: DriverTask["kind"]; driverId: string; id: string }[] = [];
  for (const order of orders) {
    if (order.driver_id && DELIVERY_STATUSES.has(order.status)) {
      open.push({ kind: "DELIVERY", driverId: order.driver_id, id: order.id });
    } else if (order.return_driver_id && order.status === "RETURN_REQUESTED") {
      open.push({ kind: "PICKUP", driverId: order.return_driver_id, id: order.id });
    }
  }

  const tasks = await Promise.all(
    open.map(async ({ kind, driverId, id }) => ({
      kind,
      driverId,
      order: await backend<OrderDetail>(`/api/orders/${encodeURIComponent(id)}/detail`),
    })),
  );

  return {
    drivers: drivers.map((driver) => ({ id: driver.id, label: driver.full_name })),
    tasks,
  };
}
