import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ContainerList } from "@/features/containers/components/container-list";
import { getContainersPage } from "@/features/containers/queries";

export const metadata: Metadata = { title: "Containers" };

async function Containers() {
  return <ContainerList {...await getContainersPage()} />;
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Containers />
    </Suspense>
  );
}
