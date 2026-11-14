import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Stations } from "@/features/inventory/components/stations";
import { getStationSummaries } from "@/features/inventory/queries";

export const metadata: Metadata = { title: "Freezing Stations" };

async function StationList() {
  return (
    <div className="p-4">
      <Stations stations={await getStationSummaries()} />
    </div>
  );
}

export default function StationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StationList />
    </Suspense>
  );
}
