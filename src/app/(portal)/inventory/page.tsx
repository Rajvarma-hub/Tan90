import { Suspense, type ComponentType } from "react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Box,
  Layers,
  PackageSearch,
  Snowflake,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ItemCard, ItemGrid } from "@/components/ui/card";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { BadgeCell, Cell, Table, Td, Th } from "@/components/ui/table";
import {
  getMovements,
  getProducts,
  getStationSummaries,
} from "@/features/inventory/queries";
import { formatDate, formatNumber, formatTime, humanize } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory" };

type Section = {
  title: string;
  description: string;
  href: Route;
  icon: ComponentType<{ className?: string }>;
};

function SectionCard({ title, description, href, icon }: Section) {
  return (
    <ItemCard
      icon={icon}
      title={title}
      footer={
        <Link href={href} className={buttonClass({ variant: "outline", className: "w-full" })}>
          Open <ArrowRight />
        </Link>
      }
    >
      {description}
    </ItemCard>
  );
}

async function Overview() {
  const [products, stations, movements] = await Promise.all([
    getProducts(),
    getStationSummaries(),
    getMovements(),
  ]);

  const inward = movements.filter((m) => m.direction === "INWARD").length;
  const unitsInStock = stations.reduce((sum, s) => sum + s.stockUnits, 0);
  const containersFree = stations.reduce((sum, s) => sum + s.containersAvailable, 0);

  const sections: Section[] = [
    {
      title: "Products",
      description: "Cooling-panel types and the stock held at each location.",
      href: "/inventory/assets",
      icon: PackageSearch,
    },
    {
      title: "Stock Movements",
      description: `${formatNumber(movements.length)} stock changes: ${formatNumber(inward)} inward, ${formatNumber(movements.length - inward)} outward.`,
      href: "/inventory/movements",
      icon: ArrowLeftRight,
    },
    {
      title: "Locations",
      description: "Freezing stations and warehouses: stock, free containers and open orders.",
      href: "/inventory/stations",
      icon: Snowflake,
    },
  ];

  const recent = movements.slice(0, 5);

  return (
    <Page>
      <PageHeader
        title="Inventory"
        description="Products, stock movements and locations at a glance."
      />

      <StatGrid>
        <Stat label="Products" icon={PackageSearch} value={formatNumber(products.length)} href="/inventory/assets" />
        <Stat label="Units in stock" icon={Layers} value={formatNumber(unitsInStock)} href="/inventory/assets" />
        <Stat label="Locations" icon={Warehouse} value={formatNumber(stations.length)} href="/inventory/stations" />
        <Stat label="Containers free" icon={Box} tone="green" value={formatNumber(containersFree)} href="/inventory/stations" />
      </StatGrid>

      <ItemGrid>
        {sections.map((section) => (
          <SectionCard key={section.href} {...section} />
        ))}
      </ItemGrid>

      <Card>
        <CardHeader
          title="Recent movements"
          description="The latest stock changes across all locations."
          actions={
            <Link
              href="/inventory/movements"
              className={buttonClass({ variant: "outline", size: "sm" })}
            >
              View all <ArrowRight />
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState>No stock movements yet.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Product</Th>
                <Th className="text-center">Movement</Th>
                <Th className="text-center">Quantity</Th>
                <Th>Location</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => {
                const inward = m.direction === "INWARD";
                return (
                  <tr key={m.id}>
                    <Td>
                      <Cell main={formatDate(m.occurred_at)}>
                        <span>{formatTime(m.occurred_at)}</span>
                      </Cell>
                    </Td>
                    <Td>
                      <Cell main={m.product_name}>
                        <span className="font-mono">{m.sku}</span>
                      </Cell>
                    </Td>
                    <Td className="text-center">
                      <BadgeCell
                        badge={<Badge tone={inward ? "green" : "blue"}>{inward ? "Inward" : "Outward"}</Badge>}
                        note={humanize(m.reason)}
                      />
                    </Td>
                    <Td className="text-center">
                      <Cell
                        main={
                          <span>
                            {inward ? "+" : "−"}
                            {formatNumber(m.quantity)}
                          </span>
                        }
                        center
                      >
                        <span>units</span>
                      </Cell>
                    </Td>
                    <Td>
                      <Cell main={m.location_code}>
                        {m.actor_name && <span>{m.actor_name}</span>}
                      </Cell>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission permission="staff.view">
        <Overview />
      </RequirePermission>
    </Suspense>
  );
}
