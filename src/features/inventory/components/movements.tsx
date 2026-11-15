"use client";

import { Can } from "@/components/auth/user-context";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { ExportButton } from "@/components/ui/export-button";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { BadgeCell, Cell, Table, Td, Th } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { recordMovement } from "@/features/inventory/actions";
import type { Product, Station, StockMovement } from "@/features/inventory/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, formatNumber, formatTime, humanize } from "@/lib/format";

const KINDS = [
  { value: "NEW_INVENTORY", label: "New inventory (inward)" },
  { value: "INTERNAL_TRANSFER", label: "Internal transfer" },
  { value: "DAMAGED", label: "Damaged (outward)" },
  { value: "ADJUSTMENT_IN", label: "Stock adjustment (inward)" },
  { value: "ADJUSTMENT_OUT", label: "Stock adjustment (outward)" },
] as const;

type Kind = (typeof KINDS)[number]["value"];
type Direction = "ALL" | "INWARD" | "OUTWARD";

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
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record Movement"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function MovementTableRow({
  movement,
  locationCode,
  onProduct,
}: {
  movement: StockMovement;
  locationCode: Map<string, string>;
  onProduct: (productId: string) => void;
}) {
  const inward = movement.direction === "INWARD";

  // What the movement was set against: the other location of a transfer, the order of a dispatch, or a typed reference.
  let reference: React.ReactNode = null;
  let counterparty: string | null = null;
  if (movement.reference_type === "LOCATION") {
    const other = locationCode.get(movement.reference_id) ?? movement.reference_id;
    counterparty = inward ? `From ${other}` : `To ${other}`;
  } else if (movement.reference_type === "ORDER") {
    reference = (
      <Link href={`/orders/${movement.reference_id}`} className="hover:text-primary hover:underline">
        View order
      </Link>
    );
  } else if (movement.reference_id && movement.reference_id !== "—") {
    reference = movement.reference_id;
  }

  return (
    <tr>
      <Td>
        <Cell main={formatDate(movement.occurred_at)}>
          <span>{formatTime(movement.occurred_at)}</span>
        </Cell>
      </Td>
      <Td>
        <Cell
          main={
            <button
              type="button"
              title="Show only this product"
              onClick={() => onProduct(movement.product_id)}
              className="cursor-pointer text-left hover:text-primary hover:underline"
            >
              {movement.product_name}
            </button>
          }
        >
          <span className="font-mono">{movement.sku}</span>
        </Cell>
      </Td>
      <Td className="text-center">
        <BadgeCell
          badge={<Badge tone={inward ? "green" : "blue"}>{inward ? "Inward" : "Outward"}</Badge>}
          note={humanize(movement.reason)}
        />
      </Td>
      <Td className="text-center">
        <Cell
          main={
            <span className="tabular-nums">
              {inward ? "+" : "−"}
              {formatNumber(movement.quantity)}
            </span>
          }
          center
        >
          <span>units</span>
        </Cell>
      </Td>
      <Td>
        <Cell main={movement.location_code}>{counterparty && <span>{counterparty}</span>}</Cell>
      </Td>
      <Td>
        <Cell main={movement.actor_name ?? "Automatic"}>{reference && <span>{reference}</span>}</Cell>
      </Td>
    </tr>
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
  const [direction, setDirection] = useState<Direction>("ALL");
  const [reason, setReason] = useState("");
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const locationCode = useMemo(
    () => new Map(stations.map((station) => [station.id, station.code])),
    [stations],
  );
  const reasons = useMemo(
    () => [...new Set(movements.map((movement) => movement.reason))],
    [movements],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements
      .filter(
        (movement) =>
          (direction === "ALL" || movement.direction === direction) &&
          (!reason || movement.reason === reason) &&
          (!locationId || movement.location_id === locationId) &&
          (!productId || movement.product_id === productId) &&
          (!term ||
            [movement.product_name, movement.sku, movement.actor_name, movement.reference_id]
              .join(" ")
              .toLowerCase()
              .includes(term)),
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [movements, direction, reason, locationId, productId, search]);

  const { rows, page: currentPage, pageCount } = paginate(filtered, page);
  const hasFilters = Boolean(search || reason || locationId || productId);
  const showDirection = (next: Direction) => {
    setDirection(next);
    setPage(1);
  };
  const inwardCount = movements.filter((m) => m.direction === "INWARD").length;
  const netUnits = movements.reduce(
    (sum, m) => sum + (m.direction === "INWARD" ? m.quantity : -m.quantity),
    0,
  );

  return (
    <Page>
      <PageHeader
        title="Stock Movements"
        description="Every inward and outward stock change across all locations."
        actions={
          <>
            <ExportButton
              filename="stock-movements"
              headers={["When (UTC)", "Direction", "Quantity", "Reason", "SKU", "Product", "Location", "Reference", "By"]}
              rows={filtered.map((m) => [
                m.occurred_at,
                m.direction,
                m.quantity,
                m.reason,
                m.sku,
                m.product_name,
                m.location_code,
                m.reference_id,
                m.actor_name,
              ])}
            />
            <Can permission="inventory.move">
              <RecordMovementDialog products={products} stations={stations} />
            </Can>
          </>
        }
      />

      <StatGrid>
        <Stat
          label="Total movements"
          icon={ArrowLeftRight}
          value={formatNumber(movements.length)}
          active={direction === "ALL"}
          onClick={() => showDirection("ALL")}
        />
        <Stat
          label="Inward"
          icon={ArrowDownLeft}
          tone="green"
          value={formatNumber(inwardCount)}
          active={direction === "INWARD"}
          onClick={() => showDirection("INWARD")}
        />
        <Stat
          label="Outward"
          icon={ArrowUpRight}
          value={formatNumber(movements.length - inwardCount)}
          active={direction === "OUTWARD"}
          onClick={() => showDirection("OUTWARD")}
        />
        <Stat
          label="Net units"
          icon={Scale}
          tone={netUnits < 0 ? "red" : "blue"}
          value={`${netUnits > 0 ? "+" : ""}${formatNumber(netUnits)}`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          title="Movement log"
          description={`${filtered.length} of ${movements.length} shown · newest first`}
          actions={
            <Tabs
              value={direction}
              onChange={showDirection}
              options={[
                { value: "ALL", label: "All" },
                { value: "INWARD", label: "Inward" },
                { value: "OUTWARD", label: "Outward" },
              ]}
            />
          }
        />
        <Toolbar>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search product, SKU, reference…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-48"
            aria-label="Type"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
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
            onChange={(event) => {
              setProductId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setReason("");
                setLocationId("");
                setProductId("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>

        {rows.length === 0 ? (
          <EmptyState>No movements match these filters.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Product</Th>
                <Th className="text-center">Movement</Th>
                <Th className="text-center">Quantity</Th>
                <Th>Location</Th>
                <Th>Raised by</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((movement) => (
                <MovementTableRow
                  key={movement.id}
                  movement={movement}
                  locationCode={locationCode}
                  onProduct={(id) => {
                    setProductId(id);
                    setPage(1);
                  }}
                />
              ))}
            </tbody>
          </Table>
        )}

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={filtered.length}
          noun={filtered.length === 1 ? "movement" : "movements"}
          onPage={setPage}
        />
      </Card>
    </Page>
  );
}
