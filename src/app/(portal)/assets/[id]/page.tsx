import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ContainerDetailView } from "@/features/containers/components/container-detail-view";
import { getContainerDetail } from "@/features/containers/queries";

export const metadata: Metadata = { title: "Container" };

type Props = PageProps<"/assets/[id]">;

async function ContainerPageContent({ params }: Pick<Props, "params">) {
  const { id } = await params;
  return <ContainerDetailView container={await getContainerDetail(id)} />;
}

export default function ContainerPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContainerPageContent params={params} />
    </Suspense>
  );
}
