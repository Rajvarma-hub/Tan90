"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Building2, TriangleAlert, Truck, Undo2, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { OpenRow } from "@/components/ui/open-row";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { Cell, Dash, rowAccent, Table, Td, Th } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { ContainerScan } from "@/features/containers/components/container-scan";
import { ContainerStatusBadge } from "@/features/containers/components/container-status-badge";
import {
  CustomerTracking,
  DriverTracking,
  LocationTracking,
  type ShowFilter,
} from "@/features/containers/components/container-tracking";
import { RegisterDialog } from "@/features/containers/components/register-dialog";
import {
  containerBuckets,
  containerStatusMeta,
  containerStatuses,
  NEEDS_ATTENTION,
  whereabouts,
} from "@/features/containers/status";
import type {
  Container,
  ContainerCustomer,
  ContainerDriver,
  ContainerLocation,
  ContainerSummary,
  ContainerType,
  OrderDrivers,
} from "@/features/containers/types";
import {
  containerViewMeta,
  containerViews,
  parseView,
  viewHref,
} from "@/features/containers/views";
import type { Option } from "@/features/orders/types";
import { formatNumber } from "@/lib/format";

const bucketLook: Record<string, { icon: LucideIcon; tone: BadgeTone }> = {
  "In stock": { icon: Box, tone: "green" },
  "Out for delivery": { icon: Truck, tone: "blue" },
  "With customers": { icon: Building2, tone: "blue" },
  "Coming back": { icon: Undo2, tone: "amber" },
  "Needs attention": { icon: TriangleAlert, tone: "red" },
};

export function ContainerList({
  containers,
  summary,
  types,
  stations,
  locations,
  customers,
  drivers,
  orderDrivers,
}: {
  containers: Container[];
  summary: ContainerSummary;
  types: ContainerType[];
  stations: Option[];
  locations: ContainerLocation[];
  customers: ContainerCustomer[];
  drivers: ContainerDriver[];
  orderDrivers: OrderDrivers;
}) {
  const router = useRouter();
  const view = parseView(useSearchParams().get("view"));
  const [search, setSearch] = useState("");
  const [ids, setIds] = useState<string[] | null>(null);
  const [statuses, setStatuses] = useState<string[] | null>(null);
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return containers.filter(
      (c) =>
        (view !== "attention" || NEEDS_ATTENTION.includes(c.status)) &&
        (view !== "all" || !ids || ids.includes(c.id)) &&
        (view !== "all" || !statuses || statuses.includes(c.status)) &&
        (!status || c.status === status) &&
        (!locationId || c.current_location_id === locationId) &&
        (!type || c.container_type === type) &&
        (!term ||
          [
            c.container_code,
            c.epc,
            c.container_type,
            c.current_order?.order_number,
            c.current_order?.customer_name,
            c.customer_name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [containers, view, ids, search, statuses, status, locationId, type]);

  const { rows, page: currentPage, pageCount } = paginate(filtered, page);
  const resetPage = () => setPage(1);
  const hasFilters = Boolean(
    search || (view === "all" && (ids || statuses)) || status || locationId || type,
  );

  function clearFilters() {
    setSearch("");
    setIds(null);
    setStatuses(null);
    setStatus("");
    setLocationId("");
    setType("");
    resetPage();
  }

  // Tracking cards and rows hand off to the table, filtered to exactly what they counted.
  function showContainers(filter: ShowFilter) {
    setSearch("");
    setIds(filter.ids ?? null);
    setStatuses(filter.statuses ?? null);
    setStatus("");
    setLocationId(filter.locationId ?? "");
    setType("");
    resetPage();
    router.push(viewHref("all"));
  }

  return (
    <Page>
      <PageHeader
        title="Containers"
        description="Containers tracked by RFID tag and barcode label."
        actions={
          <>
            <ContainerScan className="w-64" />
            <RegisterDialog types={types} stations={stations} />
          </>
        }
      />

      <StatGrid>
        {containerBuckets.map((bucket) => {
          const count = bucket.statuses.reduce(
            (sum, value) => sum + (summary.by_status[value] ?? 0),
            0,
          );
          const active = statuses === bucket.statuses;
          const look = bucketLook[bucket.label];
          return (
            <Stat
              key={bucket.label}
              label={bucket.label}
              icon={look.icon}
              tone={bucket.label === "Needs attention" && count === 0 ? "green" : look.tone}
              value={formatNumber(count)}
              active={active}
              onClick={() => {
                setIds(null);
                setStatuses(active ? null : bucket.statuses);
                setStatus("");
                router.push(viewHref("all"));
                resetPage();
              }}
            />
          );
        })}
      </StatGrid>

      <Card>
        <CardHeader
          title={containerViewMeta[view].title}
          description={
            view === "all" || view === "attention"
              ? `${filtered.length} shown · ${containerViewMeta[view].description}`
              : containerViewMeta[view].description
          }
          actions={
            <Tabs
              value={view}
              onChange={(next) => router.push(viewHref(next))}
              options={containerViews.map((value) => ({
                value,
                label: containerViewMeta[value].tab,
              }))}
            />
          }
        />

        {view === "locations" && (
          <LocationTracking containers={containers} locations={locations} onShow={showContainers} />
        )}
        {view === "customers" && (
          <CustomerTracking
            containers={containers}
            customers={customers}
            onShow={showContainers}
          />
        )}
        {view === "drivers" && (
          <DriverTracking
            containers={containers}
            drivers={drivers}
            orderDrivers={orderDrivers}
            onShow={showContainers}
          />
        )}

        {(view === "all" || view === "attention") && (
          <>
        <Toolbar>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search code, tag, order or customer"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
          <Select
            className="w-48"
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setStatuses(null);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {(view === "attention" ? NEEDS_ATTENTION : containerStatuses).map((value) => (
              <option key={value} value={value}>
                {containerStatusMeta[value].label}
              </option>
            ))}
          </Select>
          <Select
            className="w-48"
            aria-label="Location"
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              resetPage();
            }}
          >
            <option value="">All locations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.label}
              </option>
            ))}
          </Select>
          <Select
            className="w-48"
            aria-label="Type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              resetPage();
            }}
          >
            <option value="">All types</option>
            {types.map((value) => (
              <option key={value.code} value={value.name}>
                {value.name}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Toolbar>

        {rows.length === 0 ? (
          <EmptyState>No containers match these filters.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Container and tag</Th>
                <Th className="text-center">Type</Th>
                <Th className="text-center">Status</Th>
                <Th>Where it is</Th>
                <Th>On order</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((container) => (
                <OpenRow
                  key={container.id}
                  onOpen={() => router.push(`/assets/${container.id}`)}
                  className={rowAccent(
                    NEEDS_ATTENTION.includes(container.status)
                      ? containerStatusMeta[container.status]?.tone
                      : null,
                  )}
                >
                  <Td>
                    <Cell
                      main={
                        <Link
                          href={`/assets/${container.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {container.container_code}
                        </Link>
                      }
                    >
                      <span className="font-mono">{container.epc ?? "No tag"}</span>
                    </Cell>
                  </Td>
                  <Td className="text-center">{container.container_type}</Td>
                  <Td className="text-center">
                    <ContainerStatusBadge status={container.status} />
                  </Td>
                  <Td>
                    <Cell main={whereabouts(container).primary}>
                      {whereabouts(container).secondary && (
                        <span>{whereabouts(container).secondary}</span>
                      )}
                    </Cell>
                  </Td>
                  <Td>
                    {container.current_order ? (
                      <Cell
                        main={
                          <Link
                            href={`/orders/${container.current_order.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {container.current_order.order_number}
                          </Link>
                        }
                      >
                        <span>{container.current_order.customer_name}</span>
                      </Cell>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                </OpenRow>
              ))}
            </tbody>
          </Table>
        )}

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={filtered.length}
          noun={filtered.length === 1 ? "container" : "containers"}
          onPage={setPage}
        />
          </>
        )}
      </Card>
    </Page>
  );
}
