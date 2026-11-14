import "server-only";
import { formatDuration, formatSpan, parseUtc } from "@/lib/format";
import { backend } from "@/server/backend";
import type { Option, OrderDetail, OrderStatus } from "@/features/orders/types";

type ApiOrder = {
  id: string;
  status: OrderStatus;
  driver_id: string | null;
  return_driver_id: string | null;
};

// Where a run is: waiting at the station, on the road, at the door, or a return to collect.
export type TaskStage = "READY" | "ON_ROAD" | "ARRIVED" | "PICKUP";

export type DriverTask = {
  kind: "DELIVERY" | "PICKUP";
  driverId: string;
  stage: TaskStage;
  order: OrderDetail;
  // How long the order has been in this stage, e.g. "3 hours". Null if unknown.
  stageFor: string | null;
  // Deliveries only: time left, or how late, against the promised date.
  due: { label: string; overdue: boolean } | null;
};

const DELIVERY_STAGE: Partial<Record<OrderStatus, TaskStage>> = {
  DISPATCHED: "READY",
  IN_TRANSIT: "ON_ROAD",
  ARRIVED: "ARRIVED",
};

/** Every open delivery and return pickup, with how long it has waited and whether it is late. */
export async function getDriverBoard(): Promise<{ drivers: Option[]; tasks: DriverTask[] }> {
  const [orders, drivers] = await Promise.all([
    backend<ApiOrder[]>("/api/orders"),
    backend<{ id: string; full_name: string }[]>("/api/users?role=DRIVER"),
  ]);

  const open: { kind: DriverTask["kind"]; stage: TaskStage; driverId: string; id: string }[] = [];
  for (const order of orders) {
    const stage = DELIVERY_STAGE[order.status];
    if (order.driver_id && stage) {
      open.push({ kind: "DELIVERY", stage, driverId: order.driver_id, id: order.id });
    } else if (order.return_driver_id && order.status === "RETURN_REQUESTED") {
      open.push({ kind: "PICKUP", stage: "PICKUP", driverId: order.return_driver_id, id: order.id });
    }
  }

  const now = Date.now();
  const tasks = await Promise.all(
    open.map(async ({ kind, stage, driverId, id }): Promise<DriverTask> => {
      const order = await backend<OrderDetail>(`/api/orders/${encodeURIComponent(id)}/detail`);

      const entered = order.history
        .filter((event) => event.to === order.status)
        .map((event) => event.occurred_at)
        .sort()
        .at(-1);

      let due: DriverTask["due"] = null;
      if (kind === "DELIVERY" && order.expected_delivery_at) {
        const left = parseUtc(order.expected_delivery_at).getTime() - now;
        due =
          left < 0
            ? { label: `Overdue by ${formatSpan(-left)}`, overdue: true }
            : { label: `Due in ${formatSpan(left)}`, overdue: false };
      }

      return {
        kind,
        driverId,
        stage,
        order,
        stageFor: entered ? formatDuration(entered, now) : null,
        due,
      };
    }),
  );

  // Late runs first, then by order number.
  tasks.sort(
    (a, b) =>
      Number(b.due?.overdue ?? false) - Number(a.due?.overdue ?? false) ||
      a.order.order_number.localeCompare(b.order.order_number),
  );

  return {
    drivers: drivers.map((driver) => ({ id: driver.id, label: driver.full_name })),
    tasks,
  };
}
