import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ExceptionsTable } from "@/features/exceptions/components/exceptions-table";
import { getExceptions } from "@/features/exceptions/queries";

export const metadata: Metadata = { title: "Exceptions" };

async function Exceptions() {
  return <ExceptionsTable exceptions={await getExceptions()} />;
}

export default function ExceptionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Exceptions />
    </Suspense>
  );
}
