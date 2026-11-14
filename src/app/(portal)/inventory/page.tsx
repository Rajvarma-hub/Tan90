import { Suspense, type ComponentType } from "react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  PackageSearch,
  Snowflake,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ItemCard, ItemGrid } from "@/components/ui/card";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  getMovements,
  getProducts,
  getStationSummaries,
} from "@/features/inventory/queries";
import { formatDateTime, formatNumber, humanize } from "@/lib/format";

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
        <Stat label="Products" value={formatNumber(products.length)} />
        <Stat label="Units in stock" value={formatNumber(unitsInStock)} />
        <Stat label="Locations" value={formatNumber(stations.length)} />
        <Stat label="Containers free" value={formatNumber(containersFree)} />
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
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {recent.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tone={m.direction === "INWARD" ? "green" : "orange"}>
                    {m.direction === "INWARD" ? "Inward" : "Outward"}
                  </Badge>
                  <span className="truncate text-sm text-card-foreground">
                    {formatNumber(m.quantity)} × {m.product_name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {m.location_code} · {humanize(m.reason)} · {formatDateTime(m.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}
