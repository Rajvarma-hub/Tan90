import type { Route } from "next";
import {
  Boxes,
  Container,
  Package,
  ScanBarcode,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavChild = { title: string; href: Route };

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
  children?: NavChild[];
  // Shown only to roles with this permission.
  permission?: Permission;
};

// Sub-sections of Containers are views of one page, selected with ?view=.
const containerNavChildren: NavChild[] = [
  { title: "All containers", href: "/assets" },
  { title: "By location", href: "/assets?view=locations" },
  { title: "Customers", href: "/assets?view=customers" },
  { title: "Drivers", href: "/assets?view=drivers" },
  { title: "Needs attention", href: "/assets?view=attention" },
];

export const mainNav: NavItem[] = [
  { title: "Orders", href: "/orders", icon: Package },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Warehouse,
    permission: "staff.view",
    children: [
      { title: "Products", href: "/inventory/assets" },
      { title: "Stock Movements", href: "/inventory/movements" },
      { title: "Locations", href: "/inventory/stations" },
    ],
  },
  {
    title: "Containers",
    href: "/assets",
    icon: Boxes,
    permission: "staff.view",
    children: containerNavChildren,
  },
  { title: "My containers", href: "/my-containers", icon: Container, permission: "containers.mine" },
  {
    title: "Asset Management",
    href: "/asset-management",
    icon: ScanBarcode,
    permission: "staff.view",
    children: [
      { title: "Registry", href: "/asset-management" },
      { title: "By station", href: "/asset-management?view=stations" },
    ],
  },
  { title: "Deliveries", href: "/deliveries", icon: Truck, permission: "deliveries.view" },
  { title: "Exceptions", href: "/exceptions", icon: TriangleAlert, permission: "exceptions.view" },
  { title: "Users", href: "/users", icon: Users, permission: "users.manage" },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Active state of a sub-item, which may differ from its siblings only by its ?view= query. */
export function isChildActive(
  pathname: string,
  view: string | null,
  child: NavChild,
  siblings: NavChild[],
) {
  const [path, query] = child.href.split("?");
  const childView = new URLSearchParams(query ?? "").get("view");
  if (childView !== null) return pathname === path && view === childView;
  const hasViewSiblings = siblings.some(
    (sibling) => sibling.href.startsWith(`${path}?`),
  );
  return hasViewSiblings ? pathname === path && view === null : isActivePath(pathname, path);
}

// Breadcrumb trail for a path: nav titles where known, the raw segment (e.g. an order id) otherwise.
// A ?view= sub-section adds a final crumb.
export function breadcrumbsFor(
  pathname: string,
  view: string | null = null,
): { title: string; href: string; dynamic: boolean }[] {
  const titles = new Map<string, string>([
    ["/account", "Account"],
    ["/notifications", "Notifications"],
  ]);
  for (const item of mainNav) {
    titles.set(item.href, item.title);
    for (const child of item.children ?? []) {
      if (!child.href.includes("?") && !titles.has(child.href)) {
        titles.set(child.href, child.title);
      }
    }
  }
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    return {
      title: titles.get(href) ?? decodeURIComponent(segment),
      href,
      dynamic: !titles.has(href),
    };
  });

  const subSection = mainNav
    .flatMap((item) => item.children ?? [])
    .find((child) => view && child.href === `${pathname}?view=${view}`);
  if (subSection) {
    crumbs.push({ title: subSection.title, href: subSection.href, dynamic: false });
  }
  return crumbs;
}
