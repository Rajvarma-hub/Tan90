import type { BadgeTone } from "@/components/ui/badge";

export const containerStatusMeta: Record<string, { label: string; tone: BadgeTone }> = {
  AVAILABLE: { label: "Available", tone: "green" },
  PACKING: { label: "Packing", tone: "blue" },
  PACKED: { label: "Packed", tone: "blue" },
  IN_TRANSIT_TO_CUSTOMER: { label: "In transit to customer", tone: "blue" },
  WITH_CUSTOMER: { label: "With customer", tone: "blue" },
  RETURN_REQUESTED: { label: "Return requested", tone: "amber" },
  IN_TRANSIT_TO_STATION: { label: "Returning to station", tone: "blue" },
  UNDER_INSPECTION: { label: "Under inspection", tone: "amber" },
  DAMAGED: { label: "Damaged", tone: "red" },
  QUARANTINED: { label: "Quarantined", tone: "amber" },
  MISSING: { label: "Missing", tone: "red" },
  RETIRED: { label: "Unregistered", tone: "gray" },
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

export const containerStatuses = Object.keys(containerStatusMeta).filter(
  (status) => status !== "RETIRED",
);

// Statuses in which a container is physically sitting at its location.
export const AT_LOCATION = [
  "AVAILABLE",
  "PACKING",
  "PACKED",
  "UNDER_INSPECTION",
  "DAMAGED",
  "QUARANTINED",
];
export const ON_VEHICLE = ["IN_TRANSIT_TO_CUSTOMER", "IN_TRANSIT_TO_STATION"];
export const AT_CUSTOMER = ["WITH_CUSTOMER", "RETURN_REQUESTED"];
export const NEEDS_ATTENTION = ["DAMAGED", "QUARANTINED", "MISSING"];

// The journey a container repeats: out to a customer and back into stock.
export const lifecycleSteps: { label: string; statuses: string[] }[] = [
  { label: "In stock", statuses: ["AVAILABLE"] },
  { label: "Packing", statuses: ["PACKING"] },
  { label: "Packed", statuses: ["PACKED"] },
  { label: "On the road", statuses: ["IN_TRANSIT_TO_CUSTOMER"] },
  { label: "With customer", statuses: ["WITH_CUSTOMER"] },
  { label: "Return requested", statuses: ["RETURN_REQUESTED"] },
  { label: "Returning", statuses: ["IN_TRANSIT_TO_STATION"] },
  { label: "Inspection", statuses: ["UNDER_INSPECTION"] },
];

/** Index of the current lifecycle step, or -1 for damaged, quarantined and missing containers. */
export function lifecycleIndex(status: string): number {
  return lifecycleSteps.findIndex((step) => step.statuses.includes(status));
}

/** Where a container went in one history entry; the station is stale once it is on a vehicle or at a customer. */
export function moveWhere(move: {
  to_status: string;
  from_location: string | null;
  to_location: string | null;
}): string | null {
  if (ON_VEHICLE.includes(move.to_status)) return "On vehicle";
  if (AT_CUSTOMER.includes(move.to_status)) return "Customer site";
  if (!move.to_location) return null;
  return move.from_location && move.from_location !== move.to_location
    ? `${move.from_location} → ${move.to_location}`
    : move.to_location;
}

export const attentionNotes: Record<string, string> = {
  DAMAGED: "Reported damaged. It is out of circulation until it is inspected or repaired.",
  QUARANTINED: "Quarantined after inspection. It cannot be packed until it is cleared.",
  MISSING: "Reported missing. Its last known location is shown below.",
};

// Five buckets for the stat row on Containers; every status falls into exactly one, so they add up to the total.
export const containerBuckets: { label: string; statuses: string[] }[] = [
  { label: "In stock", statuses: ["AVAILABLE"] },
  { label: "Out for delivery", statuses: ["PACKING", "PACKED", "IN_TRANSIT_TO_CUSTOMER"] },
  { label: "With customers", statuses: AT_CUSTOMER },
  { label: "Coming back", statuses: ["IN_TRANSIT_TO_STATION", "UNDER_INSPECTION"] },
  { label: "Needs attention", statuses: NEEDS_ATTENTION },
];
