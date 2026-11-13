"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, PackageCheck, Truck, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Select } from "@/components/ui/form";
import { ScanChecklist } from "@/features/containers/components/scan-checklist";
import type { DriverTask } from "@/features/deliveries/queries";
import { runOrderAction } from "@/features/orders/actions";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { Option } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDateTime } from "@/lib/format";

function TaskCard({ task, driver }: { task: DriverTask; driver: string }) {
  const { order } = task;
  const orderId = order.id;
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<string[]>([]);
  const { run, pending, error, clearError } = useServerAction(runOrderAction, () =>
    setScanOpen(false),
  );

  const pickup = task.kind === "PICKUP";
  // Loading (delivery) and collecting (pickup) are the two steps verified by scanning.
  const toScan = pickup
    ? order.containers.filter((c) => c.status === "RETURN_REQUESTED")
    : order.containers;
  const needsScan = pickup || order.status === "DISPATCHED";

  function openScan() {
    clearError();
    setScanned([]);
    setScanOpen(true);
  }

  const next = pickup
    ? { label: "Collect Containers", onClick: openScan }
    : order.status === "DISPATCHED"
      ? { label: "Load & Depart", onClick: openScan }
      : order.status === "IN_TRANSIT"
        ? { label: "Mark Arrived", onClick: () => run({ action: "arrive", orderId }) }
        : { label: "Mark Delivered", onClick: () => run({ action: "deliver", orderId }) };

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-background/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {pickup ? (
            <Undo2 className="size-5 text-orange-400" />
          ) : (
            <Truck className="size-5 text-primary" />
          )}
          <Link
            href={`/orders/${order.id}`}
            className="font-medium text-card-foreground hover:text-primary hover:underline"
          >
            {order.order_number}
          </Link>
          <Badge tone={pickup ? "orange" : "blue"}>
            {pickup ? "Return pickup" : "Delivery"}
          </Badge>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="text-sm">
        <p className="font-medium text-card-foreground">{order.customer?.name}</p>
        <p className="text-xs text-muted-foreground">Driver: {driver}</p>
        <p className="mt-1 flex gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {pickup
            ? `From ${order.destination ?? "customer site"} to ${order.station?.code ?? "station"}`
            : `From ${order.station?.code ?? "station"} to ${order.destination ?? "customer site"}`}
        </p>
        <p className="mt-1 flex gap-2 text-muted-foreground">
          <PackageCheck className="mt-0.5 size-4 shrink-0" />
          {toScan.length} container{toScan.length === 1 ? "" : "s"}:{" "}
          {toScan.map((c) => c.container_code).join(", ")}
        </p>
        {!pickup && (
          <p className="mt-1 text-xs text-muted-foreground">
            Vehicle {order.vehicle_ref ?? "—"} · due{" "}
            {formatDateTime(order.expected_delivery_at)}
          </p>
        )}
      </div>

      {!scanOpen && <FormError message={error} />}
      <Button className="self-start" disabled={pending} onClick={next.onClick}>
        {pending && !scanOpen ? "Working…" : next.label}
      </Button>

      {needsScan && (
        <Dialog
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          title={pickup ? "Collect Containers" : "Load Vehicle"}
          description={
            pickup
              ? "Scan every container you pick up from the customer."
              : "Scan every container as you load it. You can depart once all are verified."
          }
        >
          <div className="grid gap-4">
            <ScanChecklist containers={toScan} onChange={setScanned} />
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setScanOpen(false)}>
                Back
              </Button>
              <Button
                disabled={pending || scanned.length !== toScan.length}
                onClick={() =>
                  run(
                    pickup
                      ? { action: "collect_return", orderId, codes: scanned }
                      : { action: "depart", orderId },
                  )
                }
              >
                {pending ? "Working…" : pickup ? "Mark Collected" : "Depart"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </li>
  );
}

export function DriverBoard({
  drivers,
  tasks,
}: {
  drivers: Option[];
  tasks: DriverTask[];
}) {
  const [driverId, setDriverId] = useState("");
  const shown = tasks.filter((task) => !driverId || task.driverId === driverId);
  const driverName = (id: string) =>
    drivers.find((driver) => driver.id === id)?.label ?? id;

  return (
    <Card>
      <CardHeader
        title="Deliveries"
        description="Open deliveries and return pickups. Pick a driver to see only their tasks."
        actions={
          <Select
            className="w-56"
            aria-label="Acting as driver"
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            <option value="">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.label} ({tasks.filter((t) => t.driverId === driver.id).length})
              </option>
            ))}
          </Select>
        }
      />
      {shown.length === 0 ? (
        <EmptyState>
          No open tasks{driverId ? ` for ${driverName(driverId)}` : ""}. Tasks appear when an
          order is dispatched or a return driver is assigned.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((task) => (
            <TaskCard
              key={`${task.kind}-${task.order.id}-${task.order.status}`}
              task={task}
              driver={driverName(task.driverId)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
