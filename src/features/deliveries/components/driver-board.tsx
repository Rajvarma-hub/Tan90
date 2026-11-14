"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Truck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ItemGrid, ItemCard } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { ScanChecklist } from "@/features/containers/components/scan-checklist";
import type { DriverTask } from "@/features/deliveries/queries";
import { runOrderAction } from "@/features/orders/actions";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { Option } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate } from "@/lib/format";

type TaskFilter = "ALL" | "DELIVERY" | "PICKUP";

const TASK_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DELIVERY", label: "Deliveries" },
  { value: "PICKUP", label: "Pickups" },
];

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
    ? order.containers.filter((container) => container.status === "RETURN_REQUESTED")
    : order.containers;
  const needsScan = pickup || order.status === "DISPATCHED";
  const origin = pickup
    ? order.destination ?? "Customer site"
    : order.station?.code ?? "Station";
  const destination = pickup
    ? order.station?.code ?? "Station"
    : order.destination ?? "Customer site";

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
    <ItemCard
      icon={pickup ? Undo2 : Truck}
      title={
        <Link href={`/orders/${order.id}`} className="hover:text-primary hover:underline">
          {order.order_number}
        </Link>
      }
      subtitle={order.customer?.name ?? "Customer not set"}
      badge={<OrderStatusBadge status={order.status} />}
      stats={[
        { label: "Driver", value: driver },
        { label: "Containers", value: toScan.length },
        { label: "Due", value: pickup ? "—" : formatDate(order.expected_delivery_at) },
      ]}
      footer={
        <Button className="w-full" disabled={pending} onClick={next.onClick}>
          {pending && !scanOpen ? "Working…" : next.label}
        </Button>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border/60 px-3 py-3 text-center">
        <div className="min-w-0">
          <p className="text-xs">{pickup ? "Collect from" : "From"}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-card-foreground">
            {origin}
          </p>
        </div>
        <ArrowRight aria-hidden="true" className="size-4" />
        <div className="min-w-0">
          <p className="text-xs">{pickup ? "Return to" : "To"}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-card-foreground">
            {destination}
          </p>
        </div>
      </div>

      {!scanOpen && error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

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
    </ItemCard>
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
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("ALL");
  const driverTasks = tasks.filter((task) => !driverId || task.driverId === driverId);
  const shown = driverTasks.filter(
    (task) => taskFilter === "ALL" || task.kind === taskFilter,
  );
  const driverNames = new Map(drivers.map(({ id, label }) => [id, label] as const));
  const driverName = (id: string) => driverNames.get(id) ?? id;
  const taskCountByDriver = new Map<string, number>();
  for (const task of tasks) {
    taskCountByDriver.set(task.driverId, (taskCountByDriver.get(task.driverId) ?? 0) + 1);
  }

  const readyCount = driverTasks.filter(
    (task) => task.kind === "DELIVERY" && task.order.status === "DISPATCHED",
  ).length;
  const inTransitCount = driverTasks.filter((task) => task.order.status === "IN_TRANSIT").length;
  const pickupCount = driverTasks.filter((task) => task.kind === "PICKUP").length;

  return (
    <Page>
      <PageHeader
        title="Deliveries"
        description="Active outbound runs and return collections."
        actions={
          <Select
            className="w-56"
            aria-label="Filter by driver"
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            <option value="">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.label} ({taskCountByDriver.get(driver.id) ?? 0})
              </option>
            ))}
          </Select>
        }
      />

      <StatGrid>
        <Stat label="Active tasks" value={driverTasks.length} />
        <Stat label="Ready to depart" value={readyCount} />
        <Stat label="In transit" value={inTransitCount} />
        <Stat label="Return pickups" value={pickupCount} />
      </StatGrid>

      <Card>
        <CardHeader
          title="Active tasks"
          description={`${shown.length} ${shown.length === 1 ? "task" : "tasks"}${
            driverId ? ` for ${driverName(driverId)}` : " across all drivers"
          }`}
          actions={<Tabs value={taskFilter} onChange={setTaskFilter} options={TASK_FILTERS} />}
        />

        {shown.length === 0 ? (
          <EmptyState>
            No active tasks{driverId ? ` for ${driverName(driverId)}` : ""}. Tasks appear when an
            order is dispatched or a return driver is assigned.
          </EmptyState>
        ) : (
          <ItemGrid>
            {shown.map((task) => (
              <TaskCard
                key={`${task.kind}-${task.order.id}-${task.order.status}`}
                task={task}
                driver={driverName(task.driverId)}
              />
            ))}
          </ItemGrid>
        )}
      </Card>
    </Page>
  );
}
