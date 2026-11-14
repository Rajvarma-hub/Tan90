import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ContainerList } from "@/features/containers/components/container-list";
import { getContainersPage } from "@/features/containers/queries";

export const metadata: Metadata = { title: "Asset Management" };

async function Containers() {
  return (
    <div className="p-4">
      <ContainerList {...await getContainersPage()} />
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Containers />
    </Suspense>
  );
}
