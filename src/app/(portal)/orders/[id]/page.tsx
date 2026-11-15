import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getOrderExceptions } from "@/features/exceptions/queries";
import { DeliveryCode } from "@/features/orders/components/delivery-code";
import { OrderDetailView } from "@/features/orders/components/order-detail-view";
import { getOrderActionOptions, getOrderDetail } from "@/features/orders/queries";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Order Details" };

type Props = PageProps<"/orders/[id]">;

async function Order({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, { code }] = await Promise.all([params, searchParams]);
  const [user, order] = await Promise.all([getCurrentUser(), getOrderDetail(id)]);
  const [options, exceptions] = await Promise.all([
    getOrderActionOptions(order, user.role),
    can(user.role, "exceptions.view") ? getOrderExceptions(order.id) : Promise.resolve([]),
  ]);
  const showCode =
    can(user.role, "delivery.show_code") && ["ARRIVED", "DELIVERED"].includes(order.status);
  return (
    <OrderDetailView
      order={order}
      options={options}
      exceptions={exceptions}
      isStaff={can(user.role, "staff.view")}
      deliveryCode={showCode ? <DeliveryCode orderId={order.id} /> : undefined}
      initialCode={typeof code === "string" ? code : undefined}
    />
  );
}

export default function OrderPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}
