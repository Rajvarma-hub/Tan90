import type { Route } from "next";

export const containerViews = ["all", "locations", "customers", "drivers", "attention"] as const;
export type ContainerView = (typeof containerViews)[number];

export const containerViewMeta: Record<ContainerView, { tab: string; title: string; description: string }> = {
  all: {
    tab: "All",
    title: "All containers",
    description: "Every container, tracked by RFID tag and barcode label.",
  },
  locations: {
    tab: "Locations",
    title: "Containers by location",
    description: "Where every container physically is, and who works there.",
  },
  customers: {
    tab: "Customers",
    title: "Containers with customers",
    description: "How many containers each customer holds right now.",
  },
  drivers: {
    tab: "Drivers",
    title: "Containers on the road",
    description: "How many containers each driver is carrying.",
  },
  attention: {
    tab: "Attention",
    title: "Containers needing attention",
    description: "Damaged, quarantined and missing containers.",
  },
};

export function parseView(value: string | null): ContainerView {
  return containerViews.find((view) => view === value) ?? "all";
}

export const viewHref = (view: ContainerView) =>
  (view === "all" ? "/assets" : `/assets?view=${view}`) as Route;
