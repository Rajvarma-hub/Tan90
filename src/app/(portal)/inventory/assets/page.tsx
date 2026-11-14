import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AssetInventory } from "@/features/inventory/components/asset-inventory";
import { getBalances, getProducts } from "@/features/inventory/queries";

export const metadata: Metadata = { title: "Products" };

async function Assets() {
  const [products, balances] = await Promise.all([getProducts(), getBalances()]);
  return <AssetInventory products={products} balances={balances} />;
}

export default function AssetInventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Assets />
    </Suspense>
  );
}
