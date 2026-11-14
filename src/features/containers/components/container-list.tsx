"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { ScanInput } from "@/components/ui/scan-input";
import { Table, Td, Th } from "@/components/ui/table";
import { lookupContainer, registerContainer } from "@/features/containers/actions";
import { ContainerStatusBadge } from "@/features/containers/components/container-status-badge";
import {
  containerBuckets,
  containerStatusMeta,
  containerStatuses,
  whereabouts,
} from "@/features/containers/status";
import type {
  Container,
  ContainerSummary,
  ContainerType,
} from "@/features/containers/types";
import type { Option } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatNumber } from "@/lib/format";

function RegisterDialog({
  types,
  stations,
}: {
  types: ContainerType[];
  stations: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [epc, setEpc] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [locationId, setLocationId] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const { run, pending, error, clearError } = useServerAction(
    registerContainer,
    (container) => {
      // Stay open so several containers can be registered in a row.
      setCreated(container.code);
      setEpc("");
    },
  );

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setCreated(null);
          setOpen(true);
        }}
      >
        <Plus /> Register Container
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Register Container"
        description="Scan the new container's tag, then pick its type and where it is. The container code is generated."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setCreated(null);
            run({ epc, typeCode, locationId });
          }}
        >
          <Field label="Tag ID" hint={epc ? undefined : "Scan the tag or type its ID."}>
            {epc ? (
              <div className="flex items-center gap-2">
                <Input readOnly className="flex-1 font-mono" value={epc} />
                <Button variant="outline" onClick={() => setEpc("")}>
                  Rescan
                </Button>
              </div>
            ) : (
              <ScanInput onScan={setEpc} autoFocus />
            )}
          </Field>
          <Field label="Container type">
            <Select
              required
              value={typeCode}
              onChange={(event) => setTypeCode(event.target.value)}
            >
              <option value="">Select type</option>
              {types.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <Select
              required
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Select location</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.label}
                </option>
              ))}
            </Select>
          </Field>
          {created && (
            <p role="status" className="text-sm text-emerald-400">
              Registered {created}. Scan the next tag to add another.
            </p>
          )}
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
            <Button type="submit" disabled={pending || !epc}>
              {pending ? "Registering…" : "Register"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ContainerList({
  containers,
  summary,
  types,
  stations,
}: {
  containers: Container[];
  summary: ContainerSummary;
  types: ContainerType[];
  stations: Option[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[] | null>(null);
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const lookup = useServerAction(lookupContainer, (container) =>
    router.push(`/assets/${container.id}`),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return containers.filter(
      (c) =>
        (!statuses || statuses.includes(c.status)) &&
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
  }, [containers, search, statuses, status, locationId, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const resetPage = () => setPage(1);

  return (
    <Page>
      <PageHeader
        title="Containers"
        description="Containers tracked by RFID tag and barcode label."
        actions={<RegisterDialog types={types} stations={stations} />}
      />

      <StatGrid>
        {containerBuckets.map((bucket) => {
          const count = bucket.statuses.reduce(
            (sum, value) => sum + (summary.by_status[value] ?? 0),
            0,
          );
          const active = statuses === bucket.statuses;
          return (
            <Stat
              key={bucket.label}
              label={bucket.label}
              value={formatNumber(count)}
              active={active}
              onClick={() => {
                setStatuses(active ? null : bucket.statuses);
                setStatus("");
                resetPage();
              }}
            />
          );
        })}
      </StatGrid>

      <Card>
        <CardHeader
          title="All containers"
          description={`${filtered.length} of ${summary.total} shown`}
        />

        <Toolbar>
          <div className="min-w-56 flex-1">
            <ScanInput
              placeholder="Scan a container to open it"
              disabled={lookup.pending}
              onScan={(code) => lookup.run({ code })}
            />
            {lookup.error && (
              <p role="alert" className="mt-1 text-sm text-red-400">
                {lookup.error}
              </p>
            )}
          </div>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search code, tag, order, customer…"
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
            {containerStatuses.map((value) => (
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
        </Toolbar>

        {rows.length === 0 ? (
          <EmptyState>No containers match these filters.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Container</Th>
                <Th className="text-center">Type</Th>
                <Th className="text-center">Status</Th>
                <Th>Location</Th>
                <Th>Order</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((container) => (
                <tr key={container.id} className="transition-colors hover:bg-accent/50">
                  <Td>
                    <Link
                      href={`/assets/${container.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {container.container_code}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {container.epc ?? "No tag"}
                    </div>
                  </Td>
                  <Td className="text-center">{container.container_type}</Td>
                  <Td className="text-center">
                    <ContainerStatusBadge status={container.status} />
                  </Td>
                  <Td>
                    <div>{whereabouts(container).primary}</div>
                    <div className="text-xs text-muted-foreground">
                      {whereabouts(container).secondary}
                    </div>
                  </Td>
                  <Td>
                    {container.current_order ? (
                      <>
                        <Link
                          href={`/orders/${container.current_order.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {container.current_order.order_number}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {container.current_order.customer_name}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                </tr>
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
      </Card>
    </Page>
  );
}
