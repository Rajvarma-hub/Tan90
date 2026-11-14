import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { getOrdersPage } from "@/features/orders/queries";

export const metadata: Metadata = { title: "Orders" };

async function Orders() {
  const { orders, options } = await getOrdersPage();
  return <OrdersTable orders={orders} options={options} />;
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders />
    </Suspense>
  );
}
