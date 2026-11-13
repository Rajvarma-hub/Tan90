import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ExceptionList } from "@/features/exceptions/components/exception-list";
import { getExceptions } from "@/features/exceptions/queries";

export const metadata: Metadata = { title: "Exceptions" };

async function Exceptions() {
  return (
    <div className="p-4">
      <ExceptionList exceptions={await getExceptions()} />
    </div>
  );
}

export default function ExceptionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Exceptions />
    </Suspense>
  );
}
