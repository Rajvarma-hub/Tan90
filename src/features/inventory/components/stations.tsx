"use client";

import { useState } from "react";
import { MapPin, PlusCircle, Snowflake, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
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
        <PlusCircle /> Add Freezing Station
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add Freezing Station">
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
            {pending ? "Adding…" : "Add Station"}
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
    <Card>
      <CardHeader
        title="Freezing Stations"
        description="Monitor stock, containers and open orders at every station."
        actions={<AddStationDialog />}
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          type="search"
          className="w-full max-w-md"
          placeholder="Search freezing stations…"
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
      </div>

      {shown.length === 0 ? (
        <EmptyState>No stations match this search.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((station) => {
            const Icon = station.kind === "WAREHOUSE" ? Warehouse : Snowflake;
            return (
              <li
                key={station.id}
                className="flex flex-col gap-4 rounded-xl border bg-background/30 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-card-foreground">{station.code}</h3>
                    <p className="text-sm text-muted-foreground">{station.name}</p>
                  </div>
                  <Icon className="size-5 shrink-0 text-primary" />
                </div>
                <p className="flex gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {station.address ?? "No address"}
                </p>
                <dl className="grid grid-cols-3 gap-2 border-t pt-4 text-center">
                  <div>
                    <dd className="text-lg font-semibold text-card-foreground tabular-nums">
                      {formatNumber(station.stockUnits)}
                    </dd>
                    <dt className="text-xs text-muted-foreground">Panels in stock</dt>
                  </div>
                  <div>
                    <dd className="text-lg font-semibold text-card-foreground tabular-nums">
                      {station.containersAvailable}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{station.containersTotal}
                      </span>
                    </dd>
                    <dt className="text-xs text-muted-foreground">Containers free</dt>
                  </div>
                  <div>
                    <dd className="text-lg font-semibold text-card-foreground tabular-nums">
                      {station.openOrders}
                    </dd>
                    <dt className="text-xs text-muted-foreground">Open orders</dt>
                  </div>
                </dl>
                <div>
                  <Badge tone={station.is_active ? "blue" : "gray"}>
                    {station.is_active ? "Online" : "Offline"}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
