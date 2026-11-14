"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
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
        <Plus /> Add Product
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add Product">
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
              placeholder="Product name"
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
            {pending ? "Adding…" : "Add Product"}
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

  const stockByProduct = new Map<string, number>();
  for (const b of balances) {
    stockByProduct.set(b.product_id, (stockByProduct.get(b.product_id) ?? 0) + b.quantity);
  }
  const unitsInStock = balances.reduce((sum, b) => sum + b.quantity, 0);
  const outOfStock = products.filter((p) => !stockByProduct.get(p.id)).length;

  return (
    <Page>
      <PageHeader
        title="Products"
        description="Cooling-panel types and the stock held at each location."
        actions={<AddAssetDialog />}
      />

      <StatGrid>
        <Stat label="Products" value={formatNumber(products.length)} />
        <Stat label="Units in stock" value={formatNumber(unitsInStock)} />
        <Stat label="Locations stocked" value={formatNumber(locations.length)} />
        <Stat label="Out of stock" value={formatNumber(outOfStock)} />
      </StatGrid>

      <Card>
        <CardHeader
          title={tab === "assets" ? "All products" : "Stock by location"}
          description={
            tab === "assets"
              ? `${assets.length} of ${products.length} shown`
              : `${stockRows.length} of ${balances.length} shown`
          }
          actions={
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "assets", label: "Products" },
                { value: "inventory", label: "Stock" },
              ]}
            />
          }
        />

        {tab === "assets" ? (
          <>
            <Toolbar>
              <Input
                type="search"
                className="min-w-56 flex-1"
                placeholder="Search name, SKU, category…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Toolbar>
            {assets.length === 0 ? (
              <EmptyState>No products match this search.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-center">Category</Th>
                    <Th className="text-center">Setpoint</Th>
                    <Th className="text-center">Locations</Th>
                    <Th className="text-center">In stock</Th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const showStock = () => {
                      setProductId(asset.id);
                      setLocationId("");
                      setTab("inventory");
                    };
                    return (
                    <tr
                      key={asset.id}
                      tabIndex={0}
                      title="View stock by location"
                      onClick={showStock}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") showStock();
                      }}
                      className="cursor-pointer transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                    >
                      <Td>
                        <div className="font-medium">{asset.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{asset.sku}</div>
                      </Td>
                      <Td className="text-center">
                        <Badge tone={asset.category.tone}>{asset.category.label}</Badge>
                      </Td>
                      <Td className="text-center tabular-nums">
                        {formatSetpoint(asset.setpoint_c)}
                      </Td>
                      <Td className="text-center tabular-nums">{asset.stations}</Td>
                      <Td className="text-center font-medium tabular-nums">
                        {formatNumber(asset.inStock)}
                      </Td>
                    </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </>
        ) : (
          <>
            <Toolbar>
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
              <Select
                className="w-48"
                aria-label="Location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code}
                  </option>
                ))}
              </Select>
            </Toolbar>
            {stockRows.length === 0 ? (
              <EmptyState>No stock recorded for this selection.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="text-center">Category</Th>
                    <Th>Location</Th>
                    <Th className="text-center">In stock</Th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => {
                    const category = categoryOf(row.setpoint_c);
                    return (
                      <tr key={row.id}>
                        <Td>
                          <div className="font-medium">{row.product_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {row.sku}
                          </div>
                        </Td>
                        <Td className="text-center">
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
                              ? "text-center font-medium text-red-400 tabular-nums"
                              : "text-center font-medium tabular-nums"
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
    </Page>
  );
}
