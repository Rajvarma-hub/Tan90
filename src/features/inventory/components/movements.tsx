"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { recordMovement } from "@/features/inventory/actions";
import type { Product, Station, StockMovement } from "@/features/inventory/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDay, formatNumber, formatTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

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
          <Field label="Product">
            <Select
              required
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={transfer ? "From" : "Location"}>
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
  onProduct,
}: {
  movement: StockMovement;
  locationCode: Map<string, string>;
  onProduct: (productId: string) => void;
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
    <li className="flex items-center gap-4 px-4 py-3.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          inward ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-card-foreground">
          <span className="font-semibold tabular-nums">
            {formatNumber(movement.quantity)} ×
          </span>{" "}
          <button
            type="button"
            title="Show only this product"
            onClick={() => onProduct(movement.product_id)}
            className="cursor-pointer hover:text-primary hover:underline"
          >
            {movement.product_name}
          </button>
          <span className="text-muted-foreground">{counterparty}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {humanize(movement.reason)} · {movement.location_code} ·{" "}
          {formatTime(movement.occurred_at)}
        </p>
        {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
      </div>
      <Badge tone={inward ? "green" : "orange"}>{inward ? "Inward" : "Outward"}</Badge>
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
  const inwardCount = movements.filter((m) => m.direction === "INWARD").length;
  const netUnits = movements.reduce(
    (sum, m) => sum + (m.direction === "INWARD" ? m.quantity : -m.quantity),
    0,
  );

  return (
    <Page>
      <PageHeader
        title="Movements"
        description="Every inward and outward stock change across all locations."
        actions={<RecordMovementDialog products={products} stations={stations} />}
      />

      <StatGrid>
        <Stat
          label="Total movements"
          value={formatNumber(movements.length)}
          active={direction === "ALL"}
          onClick={() => setDirection("ALL")}
        />
        <Stat
          label="Inward"
          value={formatNumber(inwardCount)}
          active={direction === "INWARD"}
          onClick={() => setDirection("INWARD")}
        />
        <Stat
          label="Outward"
          value={formatNumber(movements.length - inwardCount)}
          active={direction === "OUTWARD"}
          onClick={() => setDirection("OUTWARD")}
        />
        <Stat
          label="Net units"
          value={`${netUnits > 0 ? "+" : ""}${formatNumber(netUnits)}`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          title="Movement log"
          description={`${shown} of ${movements.length} shown`}
          actions={
            <Tabs
              value={direction}
              onChange={setDirection}
              options={[
                { value: "ALL", label: "All" },
                { value: "INWARD", label: "Inward" },
                { value: "OUTWARD", label: "Outward" },
              ]}
            />
          }
        />
        <Toolbar>
          <Select
            className="w-48"
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
            className="w-48"
            aria-label="Location"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">All locations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.code}
              </option>
            ))}
          </Select>
          <Select
            className="w-48"
            aria-label="Product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </Toolbar>

        {days.length === 0 ? (
          <EmptyState>No movements match these filters.</EmptyState>
        ) : (
          <div className="grid gap-5">
            {days.map(([day, list]) => (
              <section key={day}>
                <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {day}
                </h3>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {list.map((movement) => (
                    <MovementRow
                      key={movement.id}
                      movement={movement}
                      locationCode={locationCode}
                      onProduct={setProductId}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
