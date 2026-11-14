import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getOrderExceptions } from "@/features/exceptions/queries";
import { OrderDetailView } from "@/features/orders/components/order-detail-view";
import { getOrderActionOptions, getOrderDetail } from "@/features/orders/queries";

export const metadata: Metadata = { title: "Order Details" };

type Props = PageProps<"/orders/[id]">;

async function Order({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  const [options, exceptions] = await Promise.all([
    getOrderActionOptions(order),
    getOrderExceptions(order.id),
  ]);
  return <OrderDetailView order={order} options={options} exceptions={exceptions} />;
}

export default function OrderPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} />
    </Suspense>
  );
}
