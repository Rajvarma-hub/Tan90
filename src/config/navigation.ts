import type { Route } from "next";
import { Boxes, Package, Warehouse, type LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { title: "Orders", href: "/orders", icon: Package },
  { title: "Inventory Management", href: "/inventory", icon: Warehouse },
  { title: "Asset Management", href: "/assets", icon: Boxes },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
