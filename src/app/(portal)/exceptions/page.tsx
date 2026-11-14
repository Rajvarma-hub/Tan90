import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ExceptionList } from "@/features/exceptions/components/exception-list";
import { getExceptions } from "@/features/exceptions/queries";

export const metadata: Metadata = { title: "Exceptions" };

async function Exceptions() {
  return <ExceptionList exceptions={await getExceptions()} />;
}

export default function ExceptionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Exceptions />
    </Suspense>
  );
}
