import type { Route } from "next";
import { Boxes, Package, Warehouse, type LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
  children?: { title: string; href: Route }[];
};

export const mainNav: NavItem[] = [
  { title: "Orders", href: "/orders", icon: Package },
  {
    title: "Inventory Management",
    href: "/inventory",
    icon: Warehouse,
    children: [
      { title: "Asset Inventory", href: "/inventory/assets" },
      { title: "Movements", href: "/inventory/movements" },
      { title: "Freezing Stations", href: "/inventory/stations" },
    ],
  },
  { title: "Asset Management", href: "/assets", icon: Boxes },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Breadcrumb trail for a path: nav titles where known, the raw segment (e.g. an order id) otherwise.
export function breadcrumbsFor(pathname: string): { title: string; href: string }[] {
  const titles = new Map<string, string>(
    mainNav.flatMap((item) => [
      [item.href, item.title] as [string, string],
      ...(item.children ?? []).map(
        (child) => [child.href, child.title] as [string, string],
      ),
    ]),
  );
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    return { title: titles.get(href) ?? decodeURIComponent(segment), href };
  });
}
