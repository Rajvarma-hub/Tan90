import type { BadgeTone } from "@/components/ui/badge";

export const containerStatusMeta: Record<string, { label: string; tone: BadgeTone }> = {
  AVAILABLE: { label: "Available", tone: "green" },
  PACKING: { label: "Packing", tone: "cyan" },
  PACKED: { label: "Packed", tone: "cyan" },
  IN_TRANSIT_TO_CUSTOMER: { label: "In transit to customer", tone: "purple" },
  WITH_CUSTOMER: { label: "With customer", tone: "blue" },
  RETURN_REQUESTED: { label: "Return requested", tone: "orange" },
  IN_TRANSIT_TO_STATION: { label: "Returning to station", tone: "orange" },
  UNDER_INSPECTION: { label: "Under inspection", tone: "amber" },
  DAMAGED: { label: "Damaged", tone: "red" },
  QUARANTINED: { label: "Quarantined", tone: "red" },
  MISSING: { label: "Missing", tone: "red" },
};

const ON_THE_ROAD: Record<string, string> = {
  IN_TRANSIT_TO_CUSTOMER: "On the way to the customer",
  IN_TRANSIT_TO_STATION: "On the way back to the station",
};

/** Where a container physically is: on a vehicle, at a customer site, or at a station. */
export function whereabouts(container: {
  status: string;
  customer_name: string | null;
  location_code: string | null;
  location_name: string | null;
}): { primary: string; secondary: string | null } {
  if (ON_THE_ROAD[container.status]) {
    return { primary: "On vehicle", secondary: ON_THE_ROAD[container.status] };
  }
  if (container.customer_name) {
    return { primary: container.customer_name, secondary: "Customer site" };
  }
  return {
    primary: container.location_code ?? "—",
    secondary: container.location_name,
  };
}

export const containerStatuses = Object.keys(containerStatusMeta);

// Four buckets for the stat row on Containers; damaged and missing are reached through the status filter.
export const containerBuckets: { label: string; statuses: string[] }[] = [
  { label: "In stock", statuses: ["AVAILABLE"] },
  { label: "Out for delivery", statuses: ["PACKING", "PACKED", "IN_TRANSIT_TO_CUSTOMER"] },
  { label: "With customers", statuses: ["WITH_CUSTOMER"] },
  {
    label: "Coming back",
    statuses: ["RETURN_REQUESTED", "IN_TRANSIT_TO_STATION", "UNDER_INSPECTION"],
  },
];
