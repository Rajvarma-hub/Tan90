"use client";

import { Can, useCan } from "@/components/auth/user-context";
import { useState } from "react";
import { Box, Layers, MapPin, Package, Plus, Snowflake, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ItemCard, ItemGrid } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { createStation, updateStation } from "@/features/inventory/actions";
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
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Location"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function EditStationDialog({
  station,
  onClose,
}: {
  station: StationSummary;
  onClose: () => void;
}) {
  const [name, setName] = useState(station.name);
  const [address, setAddress] = useState(station.address ?? "");
  const [isActive, setIsActive] = useState(station.is_active);
  const { run, pending, error } = useServerAction(updateStation, onClose);

  return (
    <Dialog open onClose={onClose} title="Edit Location" description={station.code}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          run({ id: station.id, name, address: address || null, isActive });
        }}
      >
        <Field label="Name">
          <Input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Address">
          <Input maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>
            <span className="font-medium text-card-foreground">Online</span>
            <span className="block text-xs text-muted-foreground">
              Mark a location offline when it is closed. Its stock, containers and orders stay as they are.
            </span>
          </span>
        </label>
        <FormError message={error} />
        <DialogActions onCancel={onClose}>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function Stations({ stations }: { stations: StationSummary[] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [editing, setEditing] = useState<StationSummary | null>(null);
  const canEdit = useCan()("catalog.manage");

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
        actions={
          <Can permission="catalog.manage">
            <AddStationDialog />
          </Can>
        }
      />

      <StatGrid>
        <Stat label="Locations" icon={Warehouse} value={formatNumber(stations.length)} />
        <Stat
          label="Units in stock"
          icon={Layers}
          value={formatNumber(stations.reduce((sum, s) => sum + s.stockUnits, 0))}
        />
        <Stat
          label="Containers free"
          icon={Box}
          tone="green"
          value={formatNumber(stations.reduce((sum, s) => sum + s.containersAvailable, 0))}
        />
        <Stat
          label="Open orders"
          icon={Package}
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
                  <Badge tone={station.is_active ? "green" : "gray"}>
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
                footer={
                  canEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setEditing(station)}
                    >
                      Edit
                    </Button>
                  ) : undefined
                }
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
      {editing && <EditStationDialog key={editing.id} station={editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
