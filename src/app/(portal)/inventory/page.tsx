import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, PackageSearch, Snowflake } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Inventory Management" };

const sections: {
  title: string;
  description: string;
  href: Route;
  icon: typeof Snowflake;
}[] = [
  {
    title: "Asset Inventory",
    description: "Manage and track all cooling panels by type and location.",
    href: "/inventory/assets",
    icon: PackageSearch,
  },
  {
    title: "Movements",
    description: "See every inward and outward stock movement, and record new ones.",
    href: "/inventory/movements",
    icon: ArrowLeftRight,
  },
  {
    title: "Freezing Stations",
    description: "Monitor stock, containers and open orders at every station.",
    href: "/inventory/stations",
    icon: Snowflake,
  },
];

export default function InventoryPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader
          title="Inventory Management Overview"
          description="Manage all assets, stock movements, and freezing stations."
        />
        <ul className="grid gap-4 md:grid-cols-2">
          {sections.map(({ title, description, href, icon: Icon }) => (
            <li key={href} className="rounded-xl border bg-background/30 p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-medium text-card-foreground">{title}</h3>
                <Icon className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              <Link
                href={href}
                className={buttonClass({ variant: "outline", className: "mt-5" })}
              >
                Go to {title} <ArrowRight />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
