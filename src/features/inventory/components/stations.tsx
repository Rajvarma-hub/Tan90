"use client";

import { useState } from "react";
import { MapPin, Plus, Snowflake, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ItemCard, ItemGrid } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { createStation } from "@/features/inventory/actions";
import type { StationSummary } from "@/features/inventory/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatNumber } from "@/lib/format";

function AddStationDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"FREEZING_STATION" | "WAREHOUSE">(
    "FREEZING_STATION",
  );
  const [address, setAddress] = useState("");
  const { run, pending, error, clearError } = useServerAction(createStation, () => {
    setOpen(false);
    setCode("");
    setName("");
    setAddress("");
  });

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setOpen(true);
        }}
      >
        <Plus /> Add Location
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add Location">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({ code, name, kind, address: address || null });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code">
              <Input
                required
                minLength={2}
                maxLength={20}
                placeholder="FS-MUM"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Type">
              <Select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as "FREEZING_STATION" | "WAREHOUSE")
                }
              >
                <option value="FREEZING_STATION">Freezing station</option>
                <option value="WAREHOUSE">Warehouse</option>
              </Select>
            </Field>
          </div>
          <Field label="Name">
            <Input
              required
              maxLength={200}
              placeholder="Freezing Station Mumbai"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Address">
            <Input
              maxLength={500}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <FormError message={error} />
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending ? "Adding…" : "Add Location"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}

export function Stations({ stations }: { stations: StationSummary[] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");

  const term = search.trim().toLowerCase();
  const shown = stations.filter(
    (station) =>
      (!kind || station.kind === kind) &&
      (!term ||
        [station.code, station.name, station.address]
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );

  return (
    <Page>
      <PageHeader
        title="Locations"
        description="Stock, free containers and open orders at every location."
        actions={<AddStationDialog />}
      />

      <StatGrid>
        <Stat label="Locations" value={formatNumber(stations.length)} />
        <Stat
          label="Units in stock"
          value={formatNumber(stations.reduce((sum, s) => sum + s.stockUnits, 0))}
        />
        <Stat
          label="Containers free"
          value={formatNumber(stations.reduce((sum, s) => sum + s.containersAvailable, 0))}
        />
        <Stat
          label="Open orders"
          value={formatNumber(stations.reduce((sum, s) => sum + s.openOrders, 0))}
        />
      </StatGrid>

      <Card>
        <CardHeader
          title="All locations"
          description={`${shown.length} of ${stations.length} shown`}
        />
        <Toolbar>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search code, name, address…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            className="w-48"
            aria-label="Type"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="">All types</option>
            <option value="FREEZING_STATION">Freezing stations</option>
            <option value="WAREHOUSE">Warehouses</option>
          </Select>
        </Toolbar>

        {shown.length === 0 ? (
          <EmptyState>No locations match this search.</EmptyState>
        ) : (
          <ItemGrid>
            {shown.map((station) => (
              <ItemCard
                key={station.id}
                icon={station.kind === "WAREHOUSE" ? Warehouse : Snowflake}
                title={station.code}
                subtitle={station.name}
                badge={
                  <Badge tone={station.is_active ? "blue" : "gray"}>
                    {station.is_active ? "Online" : "Offline"}
                  </Badge>
                }
                stats={[
                  { label: "In stock", value: formatNumber(station.stockUnits) },
                  {
                    label: "Containers free",
                    value: `${station.containersAvailable}/${station.containersTotal}`,
                  },
                  { label: "Open orders", value: station.openOrders },
                ]}
              >
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span className="line-clamp-2">{station.address ?? "No address"}</span>
                </p>
              </ItemCard>
            ))}
          </ItemGrid>
        )}
      </Card>
    </Page>
  );
}
