"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Snowflake, TriangleAlert, Truck, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState, ItemCard, ItemGrid } from "@/components/ui/card";
import { OpenRow } from "@/components/ui/open-row";
import { Cell, Table, Td, Th } from "@/components/ui/table";
import {
  AT_CUSTOMER,
  AT_LOCATION,
  containerStatusMeta,
  NEEDS_ATTENTION,
  ON_VEHICLE,
} from "@/features/containers/status";
import type {
  Container,
  ContainerCustomer,
  ContainerDriver,
  ContainerLocation,
  OrderDrivers,
} from "@/features/containers/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ShowFilter = {
  locationId?: string;
  statuses?: string[];
  ids?: string[];
};

function ShowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClass({ variant: "outline", className: "w-full" })}
    >
      View containers <ArrowRight />
    </button>
  );
}

const MAX_CODES = 4;

function CodeLinks({ list }: { list: Container[] }) {
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {list.slice(0, MAX_CODES).map((container) => (
        <li key={container.id}>
          <Link
            href={`/assets/${container.id}`}
            className="font-mono text-xs hover:text-primary hover:underline"
          >
            {container.container_code}
          </Link>
        </li>
      ))}
      {list.length > MAX_CODES && (
        <li className="text-xs text-muted-foreground">+{list.length - MAX_CODES} more</li>
      )}
    </ul>
  );
}

// Count that dims at zero so the people holding something stand out.
function Count({ value, tone }: { value: number; tone?: "warn" }) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        value === 0 ? "text-muted-foreground/60" : tone === "warn" && "text-amber-400",
      )}
    >
      {formatNumber(value)}
    </span>
  );
}

function PeopleRow({
  disabled,
  onShow,
  children,
}: {
  disabled: boolean;
  onShow: () => void;
  children: ReactNode;
}) {
  return (
    <OpenRow disabled={disabled} onOpen={onShow}>
      {children}
      <Td className="text-center">
        <Button variant="outline" size="sm" className="w-24" disabled={disabled} onClick={onShow}>
          View <ArrowRight />
        </Button>
      </Td>
    </OpenRow>
  );
}

export function LocationTracking({
  containers,
  locations,
  onShow,
}: {
  containers: Container[];
  locations: ContainerLocation[];
  onShow: (filter: ShowFilter) => void;
}) {
  const onVehicle = containers.filter((c) => ON_VEHICLE.includes(c.status));
  const missing = containers.filter((c) => c.status === "MISSING");

  return (
    <ItemGrid>
      {locations.map((location) => {
        const here = containers.filter(
          (c) => c.current_location_id === location.id && AT_LOCATION.includes(c.status),
        );
        const busy = AT_LOCATION.filter((status) => status !== "AVAILABLE")
          .map((status) => [status, here.filter((c) => c.status === status).length] as const)
          .filter(([, count]) => count > 0);
        const attention = here.filter((c) => NEEDS_ATTENTION.includes(c.status)).length;

        return (
          <ItemCard
            key={location.id}
            icon={location.warehouse ? Warehouse : Snowflake}
            title={location.code}
            subtitle={location.name}
            badge={
              <Badge tone="gray">
                {location.team.length} {location.team.length === 1 ? "person" : "people"}
              </Badge>
            }
            stats={[
              { label: "On site", value: formatNumber(here.length) },
              {
                label: "In stock",
                value: formatNumber(here.filter((c) => c.status === "AVAILABLE").length),
              },
              {
                label: "Needs attention",
                value: <span className={attention ? "text-red-400" : undefined}>{attention}</span>,
              },
            ]}
            footer={
              <ShowButton
                onClick={() => onShow({ locationId: location.id, statuses: AT_LOCATION })}
              />
            }
          >
            <p>
              {busy.length === 0
                ? "All containers on site are in stock."
                : `Not in stock: ${busy
                    .map(([status, count]) => `${containerStatusMeta[status].label} ${count}`)
                    .join(" · ")}`}
            </p>
            {location.team.length > 0 && (
              <p className="mt-2 line-clamp-2 text-xs">
                Team: {location.team.map((member) => member.name).join(", ")}
              </p>
            )}
          </ItemCard>
        );
      })}

      <ItemCard
        icon={Truck}
        title="On the road"
        subtitle="On a delivery vehicle"
        stats={[
          { label: "On vehicle", value: formatNumber(onVehicle.length) },
          {
            label: "To customers",
            value: formatNumber(
              onVehicle.filter((c) => c.status === "IN_TRANSIT_TO_CUSTOMER").length,
            ),
          },
          {
            label: "Returning",
            value: formatNumber(
              onVehicle.filter((c) => c.status === "IN_TRANSIT_TO_STATION").length,
            ),
          },
        ]}
        footer={<ShowButton onClick={() => onShow({ statuses: ON_VEHICLE })} />}
      >
        {new Set(onVehicle.map((c) => c.current_order?.id).filter(Boolean)).size} orders in
        transit right now.
      </ItemCard>

      {missing.length > 0 && (
        <ItemCard
          icon={TriangleAlert}
          title="Missing"
          subtitle="Last known location only"
          badge={<Badge tone="red">{missing.length}</Badge>}
          footer={<ShowButton onClick={() => onShow({ statuses: ["MISSING"] })} />}
        >
          Reported missing and not yet found.
        </ItemCard>
      )}
    </ItemGrid>
  );
}

export function CustomerTracking({
  containers,
  customers,
  onShow,
}: {
  containers: Container[];
  customers: ContainerCustomer[];
  onShow: (filter: ShowFilter) => void;
}) {
  const rows = customers
    .map((customer) => {
      const held = containers.filter(
        (c) => c.current_customer_id === customer.id && AT_CUSTOMER.includes(c.status),
      );
      return {
        customer,
        held,
        returning: held.filter((c) => c.status === "RETURN_REQUESTED").length,
        orders: new Set(held.map((c) => c.current_order?.id).filter(Boolean)).size,
      };
    })
    .sort(
      (a, b) => b.held.length - a.held.length || a.customer.name.localeCompare(b.customer.name),
    );

  if (rows.length === 0) return <EmptyState>No customers yet.</EmptyState>;

  return (
    <Table>
      <thead>
        <tr>
          <Th>Customer</Th>
          <Th className="text-center">Holding</Th>
          <Th className="text-center">Return requested</Th>
          <Th className="text-center">Orders</Th>
          <Th>Containers</Th>
          <Th className="text-center">Action</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ customer, held, returning, orders }) => (
          <PeopleRow
            key={customer.id}
            disabled={held.length === 0}
            onShow={() => onShow({ ids: held.map((c) => c.id) })}
          >
            <Td>
              <Cell main={customer.name}>
                <span>
                  {customer.contacts.length > 0 ? customer.contacts.join(", ") : "No portal user"}
                </span>
              </Cell>
            </Td>
            <Td className="text-center">
              <Count value={held.length} />
            </Td>
            <Td className="text-center">
              <Count value={returning} tone="warn" />
            </Td>
            <Td className="text-center">
              <Count value={orders} />
            </Td>
            <Td>
              <CodeLinks list={held} />
            </Td>
          </PeopleRow>
        ))}
      </tbody>
    </Table>
  );
}

export function DriverTracking({
  containers,
  drivers,
  orderDrivers,
  onShow,
}: {
  containers: Container[];
  drivers: ContainerDriver[];
  orderDrivers: OrderDrivers;
  onShow: (filter: ShowFilter) => void;
}) {
  const driverOf = (container: Container) => {
    const assignment = container.current_order && orderDrivers[container.current_order.id];
    if (!assignment) return null;
    return container.status === "IN_TRANSIT_TO_CUSTOMER" ? assignment.delivery : assignment.pickup;
  };

  const onVehicle = containers.filter((c) => ON_VEHICLE.includes(c.status));
  const people = [...drivers, { id: "", name: "Unassigned" }];
  const rows = people
    .map((driver) => {
      const carried = onVehicle.filter((c) => (driverOf(c) ?? "") === driver.id);
      return {
        driver,
        carried,
        delivering: carried.filter((c) => c.status === "IN_TRANSIT_TO_CUSTOMER").length,
        returning: carried.filter((c) => c.status === "IN_TRANSIT_TO_STATION").length,
        orders: new Set(carried.map((c) => c.current_order?.id).filter(Boolean)).size,
      };
    })
    .filter((row) => row.driver.id !== "" || row.carried.length > 0)
    .sort(
      (a, b) => b.carried.length - a.carried.length || a.driver.name.localeCompare(b.driver.name),
    );

  if (rows.length === 0) return <EmptyState>No drivers yet.</EmptyState>;

  return (
    <Table>
      <thead>
        <tr>
          <Th>Driver</Th>
          <Th className="text-center">On vehicle</Th>
          <Th className="text-center">Delivering</Th>
          <Th className="text-center">Returning</Th>
          <Th className="text-center">Orders</Th>
          <Th>Containers</Th>
          <Th className="text-center">Action</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ driver, carried, delivering, returning, orders }) => (
          <PeopleRow
            key={driver.id || "unassigned"}
            disabled={carried.length === 0}
            onShow={() => onShow({ ids: carried.map((c) => c.id) })}
          >
            <Td>
              <Cell main={driver.name}>
                <span>{carried.length === 0 ? "Idle" : "On the road"}</span>
              </Cell>
            </Td>
            <Td className="text-center">
              <Count value={carried.length} />
            </Td>
            <Td className="text-center">
              <Count value={delivering} />
            </Td>
            <Td className="text-center">
              <Count value={returning} tone="warn" />
            </Td>
            <Td className="text-center">
              <Count value={orders} />
            </Td>
            <Td>
              <CodeLinks list={carried} />
            </Td>
          </PeopleRow>
        ))}
      </tbody>
    </Table>
  );
}
