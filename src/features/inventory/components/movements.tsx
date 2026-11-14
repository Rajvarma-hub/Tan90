"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { recordMovement } from "@/features/inventory/actions";
import type { Product, Station, StockMovement } from "@/features/inventory/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDay, formatNumber, formatTime, humanize } from "@/lib/format";

const KINDS = [
  { value: "NEW_INVENTORY", label: "New inventory (inward)" },
  { value: "INTERNAL_TRANSFER", label: "Internal transfer" },
  { value: "DAMAGED", label: "Damaged (outward)" },
  { value: "ADJUSTMENT_IN", label: "Stock adjustment (inward)" },
  { value: "ADJUSTMENT_OUT", label: "Stock adjustment (outward)" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

function RecordMovementDialog({
  products,
  stations,
}: {
  products: Product[];
  stations: Station[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("NEW_INVENTORY");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const { run, pending, error, clearError } = useServerAction(recordMovement, () => {
    setOpen(false);
    setQuantity("");
    setReference("");
  });
  const transfer = kind === "INTERNAL_TRANSFER";

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setOpen(true);
        }}
      >
        <Plus /> Record Movement
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record Movement"
        description="Stock updates immediately. Sales movements are recorded automatically when an order is dispatched."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({
              kind,
              productId,
              locationId,
              toLocationId: transfer ? toLocationId : null,
              quantity: Number(quantity),
              reference: reference || null,
            });
          }}
        >
          <Field label="Type">
            <Select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Asset">
            <Select
              required
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Select asset</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={transfer ? "From" : "Station"}>
              <Select
                required
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">Select location</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.code}
                  </option>
                ))}
              </Select>
            </Field>
            {transfer ? (
              <Field label="To">
                <Select
                  required
                  value={toLocationId}
                  onChange={(event) => setToLocationId(event.target.value)}
                >
                  <option value="">Select location</option>
                  {stations
                    .filter((station) => station.id !== locationId)
                    .map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.code}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : (
              <Field label="Reference">
                <Input
                  maxLength={120}
                  placeholder="Supplier, challan no."
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
            )}
          </div>
          <Field label="Quantity">
            <Input
              required
              type="number"
              min={1}
              max={1000000}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record Movement"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function MovementRow({
  movement,
  locationCode,
}: {
  movement: StockMovement;
  locationCode: Map<string, string>;
}) {
  const inward = movement.direction === "INWARD";
  const Icon = inward ? ArrowDownLeft : ArrowUpRight;

  let counterparty = "";
  let footnote: React.ReactNode = movement.actor_name
    ? `Raised by ${movement.actor_name}`
    : null;
  if (movement.reference_type === "LOCATION") {
    const other = locationCode.get(movement.reference_id) ?? movement.reference_id;
    counterparty = inward ? ` from ${other}` : ` to ${other}`;
  } else if (movement.reference_type === "ORDER") {
    footnote = (
      <>
        Recorded automatically from the dispatch ·{" "}
        <Link
          href={`/orders/${movement.reference_id}`}
          className="text-primary hover:underline"
        >
          View order
        </Link>
      </>
    );
  } else if (movement.reference_id && movement.reference_id !== "—") {
    counterparty = ` · ${movement.reference_id}`;
  }

  return (
    <li className="flex gap-3">
      <span
        className={
          inward
            ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 text-emerald-400"
            : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-orange-500/40 text-orange-400"
        }
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-card-foreground">
          <Badge tone={inward ? "green" : "orange"}>
            {inward ? "Inward" : "Outward"}
          </Badge>
          <Badge>{humanize(movement.reason)}</Badge>
          <span>
            <span className="font-semibold tabular-nums">
              {formatNumber(movement.quantity)} ×
            </span>{" "}
            {movement.product_name}
            <span className="text-muted-foreground">{counterparty}</span>
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatTime(movement.occurred_at)} · {movement.location_code}
        </p>
        {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
      </div>
    </li>
  );
}

export function Movements({
  movements,
  products,
  stations,
}: {
  movements: StockMovement[];
  products: Product[];
  stations: Station[];
}) {
  const [direction, setDirection] = useState<"ALL" | "INWARD" | "OUTWARD">("ALL");
  const [reason, setReason] = useState("");
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");

  const locationCode = useMemo(
    () => new Map(stations.map((station) => [station.id, station.code])),
    [stations],
  );
  const reasons = useMemo(
    () => [...new Set(movements.map((movement) => movement.reason))],
    [movements],
  );

  const days = useMemo(() => {
    const groups = new Map<string, StockMovement[]>();
    for (const movement of movements) {
      if (
        (direction !== "ALL" && movement.direction !== direction) ||
        (reason && movement.reason !== reason) ||
        (locationId && movement.location_id !== locationId) ||
        (productId && movement.product_id !== productId)
      ) {
        continue;
      }
      const day = formatDay(movement.occurred_at);
      groups.set(day, [...(groups.get(day) ?? []), movement]);
    }
    return [...groups];
  }, [movements, direction, reason, locationId, productId]);

  const shown = days.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border bg-card text-primary">
            <ArrowLeftRight className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-medium text-card-foreground">Movements</h1>
            <p className="text-sm text-muted-foreground">
              {shown} of {movements.length} movements across all stations
            </p>
          </div>
        </div>
        <RecordMovementDialog products={products} stations={stations} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Tabs
          value={direction}
          onChange={setDirection}
          options={[
            { value: "ALL", label: "All" },
            { value: "INWARD", label: "Inward" },
            { value: "OUTWARD", label: "Outward" },
          ]}
        />
        <Select
          className="w-44"
          aria-label="Type"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          <option value="">All types</option>
          {reasons.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </Select>
        <Select
          className="w-44"
          aria-label="Station"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">All stations</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.code}
            </option>
          ))}
        </Select>
        <Select
          className="w-56"
          aria-label="Asset"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">All assets</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
      </div>

      {days.length === 0 ? (
        <EmptyState>No movements match these filters.</EmptyState>
      ) : (
        days.map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">{day}</h2>
            <ul className="grid gap-4">
              {list.map((movement) => (
                <MovementRow
                  key={movement.id}
                  movement={movement}
                  locationCode={locationCode}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
