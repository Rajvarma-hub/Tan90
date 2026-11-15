"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageCheck, Route, Timer, Truck, Undo2, type LucideIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { BadgeCell, Cell, Dash, rowAccent, Table, TableCaption, Td, Th } from "@/components/ui/table";
import { ScanChecklist } from "@/features/containers/components/scan-checklist";
import type { DriverTask, TaskStage } from "@/features/deliveries/queries";
import { runOrderAction } from "@/features/orders/actions";
import type { Option } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const stageMeta: Record<TaskStage, { label: string; tone: BadgeTone; hint: string }> = {
  READY: { label: "Ready to depart", tone: "gray", hint: "Loaded, waiting to leave" },
  ON_ROAD: { label: "On the road", tone: "blue", hint: "On the way to the customer" },
  ARRIVED: { label: "Arrived", tone: "green", hint: "At the customer, not yet handed over" },
  PICKUP: { label: "Return pickup", tone: "amber", hint: "Collect containers from the customer" },
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
      <Button size="sm" className="w-32" disabled={pending} onClick={next.onClick}>
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

export function DriverBoard({
  drivers,
  tasks,
}: {
  drivers: Option[];
  tasks: DriverTask[];
}) {
  const [driverId, setDriverId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const driverNames = new Map(drivers.map(({ id, label }) => [id, label] as const));
  const driverName = (id: string) => driverNames.get(id) ?? id;
  const countByDriver = new Map<string, number>();
  for (const task of tasks) {
    countByDriver.set(task.driverId, (countByDriver.get(task.driverId) ?? 0) + 1);
  }

  const mine = tasks.filter((task) => !driverId || task.driverId === driverId);
  const count = (key: Filter) => mine.filter(filters[key]).length;
  const term = search.trim().toLowerCase();
  const shown = mine.filter(
    (task) =>
      filters[filter](task) &&
      (!term ||
        [
          task.order.order_number,
          task.order.customer?.name,
          task.order.destination,
          task.order.vehicle_ref,
          driverName(task.driverId),
          ...task.order.containers.map((c) => c.container_code),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );
  const { rows, page: currentPage, pageCount } = paginate(shown, page);
  const hasFilters = Boolean(search || driverId || filter !== "ALL");

  const stat = (label: string, key: Filter, icon: LucideIcon, tone: BadgeTone) => (
    <Stat
      label={label}
      icon={icon}
      tone={tone}
      value={count(key)}
      active={filter === key && key !== "ALL"}
      onClick={() => {
        setFilter(filter === key ? "ALL" : key);
        setPage(1);
      }}
    />
  );

  return (
    <Page>
      <PageHeader
        title="Deliveries"
        description="What is moving right now, and what is running late."
      />

      <StatGrid>
        {stat("Active runs", "ALL", Route, "blue")}
        {stat("Running late", "LATE", Timer, count("LATE") ? "red" : "green")}
        {stat("Ready to depart", "READY", PackageCheck, "blue")}
        {stat("On the road", "ON_ROAD", Truck, "blue")}
        {stat("Return pickups", "PICKUP", Undo2, count("PICKUP") ? "amber" : "blue")}
      </StatGrid>

      <Card>
        <CardHeader
          title="Runs"
          description={`${shown.length} of ${tasks.length} shown`}
        />
        <TableCaption>
          Late runs come first. A run is late when its promised delivery time has passed and the
          order has not been delivered. The action button is the next step for that run.
        </TableCaption>

        <Toolbar>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search order, customer, destination, container…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-48"
            aria-label="Driver"
            value={driverId}
            onChange={(event) => {
              setDriverId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.label} ({countByDriver.get(driver.id) ?? 0})
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setDriverId("");
                setFilter("ALL");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>

        {rows.length === 0 ? (
          <EmptyState>
            {tasks.length === 0
              ? "Nothing is out right now. Runs appear when an order is dispatched or a return driver is assigned."
              : "No runs match these filters."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Route</Th>
                <Th>Driver and vehicle</Th>
                <Th className="text-center">Stage</Th>
                <Th className="text-center">Promised delivery</Th>
                <Th className="text-center">Next step</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => {
                const { order } = task;
                const pickup = task.stage === "PICKUP";
                const stationCode = order.station?.code ?? "Station";
                const site = order.destination ?? "Customer site";
                const containers = pickup
                  ? order.containers.filter((c) => c.status === "RETURN_REQUESTED")
                  : order.containers;
                return (
                  <tr
                    key={`${task.stage}-${order.id}`}
                    className={rowAccent(task.due?.overdue ? "red" : null)}
                  >
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
                        <span title={containers.map((c) => c.container_code).join(", ")}>
                          {containers.length} {containers.length === 1 ? "container" : "containers"}
                        </span>
                      </Cell>
                    </Td>
                    <Td>
                      <Cell main={site} className="max-w-56">
                        <span>{pickup ? `Return to ${stationCode}` : `From ${stationCode}`}</span>
                      </Cell>
                    </Td>
                    <Td>
                      <Cell main={driverName(task.driverId)}>
                        <span>
                          {(pickup ? null : order.vehicle_ref) ?? "No vehicle recorded"}
                        </span>
                      </Cell>
                    </Td>
                    <Td className="text-center">
                      <BadgeCell
                        badge={
                          <Badge tone={stageMeta[task.stage].tone}>{stageMeta[task.stage].label}</Badge>
                        }
                        note={task.stageFor ? `for ${task.stageFor}` : stageMeta[task.stage].hint}
                      />
                    </Td>
                    <Td className="text-center">
                      {pickup || !order.expected_delivery_at ? (
                        <Cell main={<Dash />} center>
                          <span>No promised time</span>
                        </Cell>
                      ) : (
                        <Cell main={formatDate(order.expected_delivery_at)} center>
                          <span>{formatTime(order.expected_delivery_at)}</span>
                          {task.due && (
                            <span
                              className={cn(
                                "font-medium",
                                task.due.overdue ? "text-red-400" : "text-muted-foreground",
                              )}
                            >
                              {task.due.label}
                            </span>
                          )}
                        </Cell>
                      )}
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

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={shown.length}
          noun={shown.length === 1 ? "run" : "runs"}
          onPage={setPage}
        />
      </Card>
    </Page>
  );
}
