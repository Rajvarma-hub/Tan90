"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { FormError, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { Cell, Table, TableCaption, Td, Th } from "@/components/ui/table";
import { ScanChecklist } from "@/features/containers/components/scan-checklist";
import type { DriverTask, TaskStage } from "@/features/deliveries/queries";
import { runOrderAction } from "@/features/orders/actions";
import type { Option } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const stageMeta: Record<TaskStage, { label: string; tone: BadgeTone; hint: string }> = {
  READY: { label: "Ready to depart", tone: "cyan", hint: "Loaded, waiting to leave" },
  ON_ROAD: { label: "On the road", tone: "purple", hint: "On the way to the customer" },
  ARRIVED: { label: "Arrived", tone: "blue", hint: "At the customer, not yet handed over" },
  PICKUP: { label: "Return pickup", tone: "orange", hint: "Collect containers from the customer" },
};

type Filter = "ALL" | "LATE" | "READY" | "ON_ROAD" | "PICKUP";

const filters: Record<Filter, (task: DriverTask) => boolean> = {
  ALL: () => true,
  LATE: (task) => task.due?.overdue === true,
  READY: (task) => task.stage === "READY",
  ON_ROAD: (task) => task.stage === "ON_ROAD" || task.stage === "ARRIVED",
  PICKUP: (task) => task.stage === "PICKUP",
};

// The one step this task needs next. Loading and collecting are verified by scanning each container.
function TaskAction({ task }: { task: DriverTask }) {
  const { order } = task;
  const orderId = order.id;
  const [scanOpen, setScanOpen] = useState(false);
  const [scanned, setScanned] = useState<string[]>([]);
  const { run, pending, error, clearError } = useServerAction(runOrderAction, () =>
    setScanOpen(false),
  );

  const pickup = task.stage === "PICKUP";
  const toScan = pickup
    ? order.containers.filter((container) => container.status === "RETURN_REQUESTED")
    : order.containers;

  function openScan() {
    clearError();
    setScanned([]);
    setScanOpen(true);
  }

  const next =
    task.stage === "PICKUP"
      ? { label: "Collect", onClick: openScan, scan: true }
      : task.stage === "READY"
        ? { label: "Load & Depart", onClick: openScan, scan: true }
        : task.stage === "ON_ROAD"
          ? { label: "Mark Arrived", onClick: () => run({ action: "arrive", orderId }), scan: false }
          : { label: "Mark Delivered", onClick: () => run({ action: "deliver", orderId }), scan: false };

  return (
    <>
      <Button size="sm" disabled={pending} onClick={next.onClick}>
        {pending && !scanOpen ? "Working…" : next.label}
      </Button>
      {!scanOpen && error && (
        <div className="mt-2 text-left">
          <FormError message={error} />
        </div>
      )}
      {next.scan && (
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
            <DialogActions onCancel={() => setScanOpen(false)}>
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
            </DialogActions>
          </div>
        </Dialog>
      )}
    </>
  );
}

// From/to as two labelled lines, so the direction is clear without an arrow.
function Route({ from, to, fromLabel, toLabel }: { from: string; to: string; fromLabel: string; toLabel: string }) {
  return (
    <dl className="grid max-w-72 grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 text-sm">
      <dt className="text-xs text-muted-foreground">{fromLabel}</dt>
      <dd className="truncate text-card-foreground">{from}</dd>
      <dt className="text-xs text-muted-foreground">{toLabel}</dt>
      <dd className="truncate text-card-foreground">{to}</dd>
    </dl>
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
  const [filter, setFilter] = useState<Filter>("ALL");

  const driverNames = new Map(drivers.map(({ id, label }) => [id, label] as const));
  const driverName = (id: string) => driverNames.get(id) ?? id;
  const countByDriver = new Map<string, number>();
  for (const task of tasks) {
    countByDriver.set(task.driverId, (countByDriver.get(task.driverId) ?? 0) + 1);
  }

  const mine = tasks.filter((task) => !driverId || task.driverId === driverId);
  const shown = mine.filter(filters[filter]);
  const count = (key: Filter) => mine.filter(filters[key]).length;

  const stat = (label: string, key: Filter) => (
    <Stat
      label={label}
      value={count(key)}
      active={filter === key && key !== "ALL"}
      onClick={() => setFilter(filter === key ? "ALL" : key)}
    />
  );

  return (
    <Page>
      <PageHeader
        title="Deliveries"
        description="What is moving right now, and what is running late."
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
                {driver.label} ({countByDriver.get(driver.id) ?? 0})
              </option>
            ))}
          </Select>
        }
      />

      <StatGrid>
        {stat("Active runs", "ALL")}
        {stat("Running late", "LATE")}
        {stat("Ready to depart", "READY")}
        {stat("On the road", "ON_ROAD")}
        {stat("Return pickups", "PICKUP")}
      </StatGrid>

      <Card>
        <CardHeader
          title="Runs"
          description={`${shown.length} ${shown.length === 1 ? "run" : "runs"}${
            driverId ? ` for ${driverName(driverId)}` : ""
          }`}
        />
        <TableCaption>
          Late runs come first. A run is late when its promised delivery time has passed and the
          order has not been delivered. The action button is the next step for that run.
        </TableCaption>

        {shown.length === 0 ? (
          <EmptyState>
            {tasks.length === 0
              ? "Nothing is out right now. Runs appear when an order is dispatched or a return driver is assigned."
              : "No runs match this filter."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Route</Th>
                <Th>Driver and vehicle</Th>
                <Th className="text-center">Stage</Th>
                <Th>Promised delivery</Th>
                <Th className="text-center">Containers</Th>
                <Th className="text-center">Next step</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((task) => {
                const { order } = task;
                const pickup = task.stage === "PICKUP";
                const stationCode = order.station?.code ?? "Station";
                const site = order.destination ?? "Customer site";
                const containers = pickup
                  ? order.containers.filter((c) => c.status === "RETURN_REQUESTED")
                  : order.containers;
                return (
                  <tr key={`${task.stage}-${order.id}`}>
                    <Td>
                      <Cell
                        main={
                          <Link
                            href={`/orders/${order.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {order.order_number}
                          </Link>
                        }
                      >
                        <span>{order.customer?.name ?? "—"}</span>
                      </Cell>
                    </Td>
                    <Td>
                      <Route
                        fromLabel={pickup ? "Collect from" : "From"}
                        from={pickup ? site : stationCode}
                        toLabel={pickup ? "Return to" : "To"}
                        to={pickup ? stationCode : site}
                      />
                    </Td>
                    <Td>
                      <Cell main={driverName(task.driverId)}>
                        <span>
                          {(pickup ? null : order.vehicle_ref) ?? "No vehicle recorded"}
                        </span>
                      </Cell>
                    </Td>
                    <Td className="text-center">
                      <div className="grid justify-items-center gap-1">
                        <Badge tone={stageMeta[task.stage].tone}>{stageMeta[task.stage].label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {task.stageFor ? `for ${task.stageFor}` : stageMeta[task.stage].hint}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      {pickup || !order.expected_delivery_at ? (
                        <Cell main={<span className="text-muted-foreground">—</span>}>
                          <span>No promised time</span>
                        </Cell>
                      ) : (
                        <Cell main={formatDate(order.expected_delivery_at)}>
                          <span>{formatTime(order.expected_delivery_at)}</span>
                          {task.due && (
                            <span
                              className={cn(
                                "font-medium",
                                task.due.overdue ? "text-red-400" : "text-emerald-400",
                              )}
                            >
                              {task.due.label}
                            </span>
                          )}
                        </Cell>
                      )}
                    </Td>
                    <Td className="text-center">
                      <Cell main={containers.length} className="justify-items-center">
                        <span className="max-w-40 truncate">
                          {containers
                            .slice(0, 2)
                            .map((c) => c.container_code)
                            .join(", ")}
                          {containers.length > 2 ? ` +${containers.length - 2}` : ""}
                        </span>
                      </Cell>
                    </Td>
                    <Td className="text-center">
                      <TaskAction task={task} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  );
}
