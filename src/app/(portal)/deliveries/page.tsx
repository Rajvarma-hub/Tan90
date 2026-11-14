import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { DriverBoard } from "@/features/deliveries/components/driver-board";
import { getDriverBoard } from "@/features/deliveries/queries";

export const metadata: Metadata = { title: "Deliveries" };

async function Board() {
  return (
    <div className="p-4">
      <DriverBoard {...await getDriverBoard()} />
    </div>
  );
}

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Board />
    </Suspense>
  );
}
