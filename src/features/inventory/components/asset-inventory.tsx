"use client";

import { useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Table, Td, Th } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { createProduct } from "@/features/inventory/actions";
import { categoryOf } from "@/features/inventory/category";
import type { Product, StockBalance } from "@/features/inventory/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatNumber, formatSetpoint } from "@/lib/format";

function AddAssetDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [setpoint, setSetpoint] = useState("");
  const { run, pending, error, clearError } = useServerAction(createProduct, () => {
    setOpen(false);
    setName("");
    setSku("");
    setSetpoint("");
  });

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setOpen(true);
        }}
      >
        <PlusCircle /> Add Asset
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Create Asset">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({ name, sku, setpointC: setpoint === "" ? null : Number(setpoint) });
          }}
        >
          <Field label="Name">
            <Input
              required
              maxLength={200}
              placeholder="Asset name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="SKU">
            <Input
              required
              minLength={2}
              maxLength={64}
              placeholder="PCM-NEG24"
              value={sku}
              onChange={(event) => setSku(event.target.value.toUpperCase())}
            />
          </Field>
          <Field
            label="Setpoint (°C)"
            hint="Sets the category: Frozen at −15 °C or colder, Chiller up to +8 °C."
          >
            <Input
              type="number"
              step="any"
              min={-100}
              max={100}
              placeholder="-24"
              value={setpoint}
              onChange={(event) => setSetpoint(event.target.value)}
            />
          </Field>
          <FormError message={error} />
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending ? "Creating…" : "Create Asset"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}

export function AssetInventory({
  products,
  balances,
}: {
  products: Product[];
  balances: StockBalance[];
}) {
  const [tab, setTab] = useState<"assets" | "inventory">("assets");
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");

  const assets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .map((product) => {
        const rows = balances.filter((b) => b.product_id === product.id);
        return {
          ...product,
          inStock: rows.reduce((sum, b) => sum + b.quantity, 0),
          stations: rows.filter((b) => b.quantity > 0).length,
          category: categoryOf(product.setpoint_c),
        };
      })
      .filter(
        (asset) =>
          !term ||
          [asset.name, asset.sku, asset.category.label]
            .join(" ")
            .toLowerCase()
            .includes(term),
      );
  }, [products, balances, search]);

  const locations = useMemo(
    () =>
      [...new Map(balances.map((b) => [b.location_id, b.location_code]))].map(
        ([id, code]) => ({ id, code }),
      ),
    [balances],
  );

  const stockRows = balances.filter(
    (b) =>
      (!productId || b.product_id === productId) &&
      (!locationId || b.location_id === locationId),
  );

  return (
    <Card>
      <CardHeader title="Asset Inventory" description="Manage all assets" />
      <Tabs
        className="mb-5 flex w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: "assets", label: "Assets" },
          { value: "inventory", label: "Inventory" },
        ]}
      />

      {tab === "assets" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Input
              type="search"
              className="w-full max-w-md"
              placeholder="Search name, SKU, category…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <AddAssetDialog />
          </div>
          {assets.length === 0 ? (
            <EmptyState>No assets match this search.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>SKU</Th>
                  <Th>Category</Th>
                  <Th>Setpoint</Th>
                  <Th className="text-right">Stations</Th>
                  <Th className="text-right">In Stock</Th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <Td>{asset.name}</Td>
                    <Td className="font-mono text-xs">{asset.sku}</Td>
                    <Td>
                      <Badge tone={asset.category.tone}>{asset.category.label}</Badge>
                    </Td>
                    <Td>{formatSetpoint(asset.setpoint_c)}</Td>
                    <Td className="text-right tabular-nums">{asset.stations}</Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatNumber(asset.inStock)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Select
              className="w-64"
              aria-label="Asset"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">All Assets</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
            <Select
              className="w-48"
              aria-label="Station"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">All Stations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code}
                </option>
              ))}
            </Select>
          </div>
          {stockRows.length === 0 ? (
            <EmptyState>No stock recorded for this selection.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Asset Name</Th>
                  <Th>Category</Th>
                  <Th>Station Name</Th>
                  <Th className="text-right">In Stock</Th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row) => {
                  const category = categoryOf(row.setpoint_c);
                  return (
                    <tr key={row.id}>
                      <Td>
                        <div>{row.product_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.sku}
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={category.tone}>{category.label}</Badge>
                      </Td>
                      <Td>
                        <div className="font-medium">{row.location_code}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.location_name}
                        </div>
                      </Td>
                      <Td
                        className={
                          row.quantity === 0
                            ? "text-right font-medium text-red-400 tabular-nums"
                            : "text-right font-medium tabular-nums"
                        }
                      >
                        {formatNumber(row.quantity)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}
