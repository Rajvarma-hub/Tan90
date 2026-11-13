import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Movements } from "@/features/inventory/components/movements";
import { getMovements, getProducts, getStations } from "@/features/inventory/queries";

export const metadata: Metadata = { title: "Movements" };

async function MovementList() {
  const [movements, products, stations] = await Promise.all([
    getMovements(),
    getProducts(),
    getStations(),
  ]);
  return <Movements movements={movements} products={products} stations={stations} />;
}

export default function MovementsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MovementList />
    </Suspense>
  );
}
