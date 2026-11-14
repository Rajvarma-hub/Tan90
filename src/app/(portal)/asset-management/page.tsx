import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AssetManagement } from "@/features/assets/components/asset-management";
import { getAssetManagement } from "@/features/assets/queries";

export const metadata: Metadata = { title: "Asset Management" };

async function Assets() {
  return <AssetManagement {...await getAssetManagement()} />;
}

export default function AssetManagementPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Assets />
    </Suspense>
  );
}
