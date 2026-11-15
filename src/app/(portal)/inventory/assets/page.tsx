import { Suspense } from "react";
import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AssetInventory } from "@/features/inventory/components/asset-inventory";
import { getBalances, getProducts } from "@/features/inventory/queries";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Products" };

async function Assets() {
  const user = await getCurrentUser();
  const [products, balances] = await Promise.all([
    getProducts(can(user.role, "catalog.manage")),
    getBalances(),
  ]);
  return <AssetInventory products={products} balances={balances} />;
}

export default function AssetInventoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission permission="staff.view">
        <Assets />
      </RequirePermission>
    </Suspense>
  );
}
