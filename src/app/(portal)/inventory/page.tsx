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
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  getMovements,
  getProducts,
  getStationSummaries,
} from "@/features/inventory/queries";
import { formatDateTime, formatNumber, humanize } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory Management" };

type Section = {
  title: string;
  description: string;
  href: Route;
  icon: ComponentType<{ className?: string }>;
  stats: { label: string; value: number }[];
};

function SectionCard({ title, description, href, icon: Icon, stats }: Section) {
  return (
    <li className="flex flex-col rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <h3 className="text-lg font-medium text-card-foreground">{title}</h3>
      </div>
      <p className="mt-3 flex-1 text-sm text-muted-foreground">{description}</p>
      <dl className="mt-5 grid grid-cols-2 divide-x border-t pt-5 text-center">
        {stats.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-card-foreground tabular-nums">
              {formatNumber(value)}
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href={href}
        className={buttonClass({ variant: "outline", className: "mt-6 w-full" })}
      >
        Open {title} <ArrowRight />
      </Link>
    </li>
  );
}

async function Overview() {
  const [products, stations, movements] = await Promise.all([
    getProducts(),
    getStationSummaries(),
    getMovements(),
  ]);

  const sections: Section[] = [
    {
      title: "Asset Inventory",
      description: "Cooling panels by type, with stock per station.",
      href: "/inventory/assets",
      icon: PackageSearch,
      stats: [
        { label: "Asset types", value: products.length },
        {
          label: "Units in stock",
          value: stations.reduce((sum, s) => sum + s.stockUnits, 0),
        },
      ],
    },
    {
      title: "Movements",
      description: "Every inward and outward stock change, plus new entries.",
      href: "/inventory/movements",
      icon: ArrowLeftRight,
      stats: [
        {
          label: "Inward",
          value: movements.filter((m) => m.direction === "INWARD").length,
        },
        {
          label: "Outward",
          value: movements.filter((m) => m.direction === "OUTWARD").length,
        },
      ],
    },
    {
      title: "Freezing Stations",
      description: "Stock, free containers and open orders at each location.",
      href: "/inventory/stations",
      icon: Snowflake,
      stats: [
        { label: "Locations", value: stations.length },
        {
          label: "Containers free",
          value: stations.reduce((sum, s) => sum + s.containersAvailable, 0),
        },
      ],
    },
  ];

  const recent = movements.slice(0, 5);

  return (
    <div className="grid gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Inventory Management</h2>
        <p className="text-sm text-muted-foreground">
          Assets, stock movements and freezing stations at a glance.
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <SectionCard key={section.href} {...section} />
        ))}
      </ul>

      <Card>
        <CardHeader
          title="Recent movements"
          description="The latest stock changes across all locations."
          actions={
            <Link
              href="/inventory/movements"
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              View all <ArrowRight />
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState>No stock movements yet.</EmptyState>
        ) : (
          <ul className="divide-y">
            {recent.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
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
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}
