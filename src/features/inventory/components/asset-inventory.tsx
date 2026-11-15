"use client";

import { Can, useCan } from "@/components/auth/user-context";
import { useMemo, useState } from "react";
import { Layers, MapPin, PackageSearch, PackageX, Plus, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { ExportButton } from "@/components/ui/export-button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { OpenRow } from "@/components/ui/open-row";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { Cell, Table, Td, Th } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { createProduct, updateProduct } from "@/features/inventory/actions";
import { categoryOf } from "@/features/inventory/category";
import type { Product, StockBalance } from "@/features/inventory/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatNumber, formatSetpoint } from "@/lib/format";

function AddAssetDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [setpoint, setSetpoint] = useState("");
  const [reorder, setReorder] = useState("0");
  const { run, pending, error, clearError } = useServerAction(createProduct, () => {
    setOpen(false);
    setName("");
    setSku("");
    setSetpoint("");
    setReorder("0");
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
            run({
              name,
              sku,
              setpointC: setpoint === "" ? null : Number(setpoint),
              reorderLevel: Number(reorder) || 0,
            });
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
          <Field label="Reorder level" hint="Ops are alerted when total stock falls to this. 0 turns the alert off.">
            <Input
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={reorder}
              onChange={(event) => setReorder(event.target.value)}
            />
          </Field>
          <FormError message={error} />
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add Product"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function EditProductDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const [name, setName] = useState(product.name);
  const [setpoint, setSetpoint] = useState(product.setpoint_c === null ? "" : String(product.setpoint_c));
  const [reorder, setReorder] = useState(String(product.reorder_level));
  const [isActive, setIsActive] = useState(product.is_active);
  const { run, pending, error } = useServerAction(updateProduct, onClose);

  return (
    <Dialog open onClose={onClose} title="Edit Product" description={product.sku}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          run({
            id: product.id,
            name,
            setpointC: setpoint === "" ? null : Number(setpoint),
            reorderLevel: Number(reorder) || 0,
            isActive,
          });
        }}
      >
        <Field label="Name">
          <Input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Setpoint (°C)" hint="Sets the category: Frozen at −15 °C or colder, Chiller up to +8 °C.">
          <Input
            type="number"
            step="any"
            min={-100}
            max={100}
            value={setpoint}
            onChange={(event) => setSetpoint(event.target.value)}
          />
        </Field>
        <Field label="Reorder level" hint="Ops are alerted when total stock falls to this. 0 turns the alert off.">
          <Input
            type="number"
            min={0}
            max={1000000}
            step={1}
            value={reorder}
            onChange={(event) => setReorder(event.target.value)}
          />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>
            <span className="font-medium text-card-foreground">Available to order</span>
            <span className="block text-xs text-muted-foreground">
              A switched-off product can no longer be ordered. Existing orders and stock stay as they are.
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
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const canEdit = useCan()("catalog.manage");

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
  const productPage = paginate(assets, page);
  const stockPage = paginate(stockRows, page);

  const stockByProduct = new Map<string, number>();
  for (const b of balances) {
    stockByProduct.set(b.product_id, (stockByProduct.get(b.product_id) ?? 0) + b.quantity);
  }
  const unitsInStock = balances.reduce((sum, b) => sum + b.quantity, 0);
  const outOfStock = products.filter((p) => p.is_active && !stockByProduct.get(p.id)).length;
  const isLow = (product: Product) =>
    product.is_active &&
    product.reorder_level > 0 &&
    (stockByProduct.get(product.id) ?? 0) <= product.reorder_level;
  const lowStock = products.filter(isLow).length;

  return (
    <Page>
      <PageHeader
        title="Products"
        description="Cooling-panel types and the stock held at each location."
        actions={
          <Can permission="catalog.manage">
            <AddAssetDialog />
          </Can>
        }
      />

      <StatGrid>
        <Stat
          label="Products"
          icon={PackageSearch}
          value={formatNumber(products.filter((p) => p.is_active).length)}
        />
        <Stat label="Units in stock" icon={Layers} value={formatNumber(unitsInStock)} />
        <Stat label="Locations stocked" icon={MapPin} value={formatNumber(locations.length)} />
        <Stat
          label="Low stock"
          icon={TrendingDown}
          tone={lowStock ? "amber" : "green"}
          value={formatNumber(lowStock)}
        />
        <Stat
          label="Out of stock"
          icon={PackageX}
          tone={outOfStock ? "red" : "green"}
          value={formatNumber(outOfStock)}
        />
      </StatGrid>

      <Card>
        <CardHeader
          title={tab === "assets" ? "All products" : "Stock by location"}
          description={
            tab === "assets"
              ? `${assets.length} of ${products.length} shown`
              : `${stockRows.length} of ${balances.length} shown · by location`
          }
          actions={
            <>
              {tab === "assets" ? (
                <ExportButton
                  filename="products"
                  headers={["SKU", "Name", "Setpoint (°C)", "Category", "In stock", "Reorder level", "Orderable"]}
                  rows={assets.map((a) => [
                    a.sku,
                    a.name,
                    a.setpoint_c,
                    a.category.label,
                    a.inStock,
                    a.reorder_level,
                    a.is_active ? "Yes" : "No",
                  ])}
                />
              ) : (
                <ExportButton
                  filename="stock-by-location"
                  headers={["SKU", "Product", "Location", "Location name", "Quantity", "Unit"]}
                  rows={stockRows.map((b) => [
                    b.sku,
                    b.product_name,
                    b.location_code,
                    b.location_name,
                    b.quantity,
                    b.unit,
                  ])}
                />
              )}
            <Tabs
              value={tab}
              onChange={(next) => {
                setTab(next);
                setPage(1);
              }}
              options={[
                { value: "assets", label: "Products" },
                { value: "inventory", label: "Stock" },
              ]}
            />
            </>
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
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
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
                    {canEdit && <Th className="text-right">Actions</Th>}
                  </tr>
                </thead>
                <tbody>
                  {productPage.rows.map((asset) => {
                    const showStock = () => {
                      setProductId(asset.id);
                      setLocationId("");
                      setPage(1);
                      setTab("inventory");
                    };
                    return (
                      <OpenRow key={asset.id} title="View stock by location" onOpen={showStock}>
                        <Td>
                          <Cell main={asset.name}>
                            <span className="font-mono">{asset.sku}</span>
                            {!asset.is_active && <Badge tone="gray">Not orderable</Badge>}
                            {isLow(asset) && (
                              <Badge tone="amber">Low · reorder at {formatNumber(asset.reorder_level)}</Badge>
                            )}
                          </Cell>
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
                        {canEdit && (
                          <Td className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setEditing(asset)}>
                              Edit
                            </Button>
                          </Td>
                        )}
                      </OpenRow>
                    );
                  })}
                </tbody>
              </Table>
            )}
            <Pagination
              page={productPage.page}
              pageCount={productPage.pageCount}
              total={assets.length}
              noun={assets.length === 1 ? "product" : "products"}
              onPage={setPage}
            />
          </>
        ) : (
          <>
            <Toolbar>
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
                  {stockPage.rows.map((row) => {
                    const category = categoryOf(row.setpoint_c);
                    return (
                      <tr key={row.id}>
                        <Td>
                          <Cell main={row.product_name}>
                            <span className="font-mono">{row.sku}</span>
                          </Cell>
                        </Td>
                        <Td className="text-center">
                          <Badge tone={category.tone}>{category.label}</Badge>
                        </Td>
                        <Td>
                          <Cell main={row.location_code}>
                            <span>{row.location_name}</span>
                          </Cell>
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
            <Pagination
              page={stockPage.page}
              pageCount={stockPage.pageCount}
              total={stockRows.length}
              noun={stockRows.length === 1 ? "stock record" : "stock records"}
              onPage={setPage}
            />
          </>
        )}
      </Card>
      {editing && <EditProductDialog key={editing.id} product={editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
