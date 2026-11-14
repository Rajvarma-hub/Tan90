import Link from "next/link";
import { Card, CardHeader, Detail, DetailGrid, EmptyState } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { ContainerStatusBadge } from "@/features/containers/components/container-status-badge";
import { OrderActions } from "@/features/orders/components/order-actions";
import { PackingPanel } from "@/features/orders/components/packing-panel";
import { OrderProgress } from "@/features/orders/components/order-progress";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { OrderActionOptions, OrderDetail } from "@/features/orders/types";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatSetpoint,
  humanize,
} from "@/lib/format";

export function OrderDetailView({
  order,
  options,
}: {
  order: OrderDetail;
  options: OrderActionOptions;
}) {
  const totalAssets = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Page>
      <PageHeader
        back={{ href: "/orders", label: "Orders" }}
        title={order.order_number}
        badge={<OrderStatusBadge status={order.status} />}
        description={`${order.customer?.name ?? "No customer"} · Placed ${formatDate(order.created_at)}`}
      />

      <OrderProgress status={order.status} />
      {/* Keyed so dialog state resets after each step. */}
      <OrderActions key={order.status} order={order} options={options} />
      {order.status === "PACKING" && <PackingPanel order={order} options={options} />}

      <Card>
        <CardHeader title="Order details" />
        <DetailGrid>
          <Detail label="Total items">{formatNumber(totalAssets)}</Detail>
          <Detail label="Order date">{formatDateTime(order.created_at)}</Detail>
          <Detail label="Expected delivery">
            {formatDateTime(order.expected_delivery_at)}
          </Detail>
          <Detail label="Deliver to">{order.destination ?? "—"}</Detail>
        </DetailGrid>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Customer" />
          <DetailGrid>
            <Detail label="Name">{order.customer?.name ?? "—"}</Detail>
            <Detail label="Phone">{order.customer?.contact_phone ?? "—"}</Detail>
            <Detail label="Email">{order.customer?.contact_email ?? "—"}</Detail>
            <Detail label="Address">{order.customer?.address ?? "—"}</Detail>
          </DetailGrid>
        </Card>
        <Card>
          <CardHeader title="Freezing station" />
          {order.station ? (
            <DetailGrid>
              <Detail label="Code">{order.station.code}</Detail>
              <Detail label="Name">{order.station.name}</Detail>
              <div className="sm:col-span-2">
                <Detail label="Address">{order.station.address ?? "—"}</Detail>
              </div>
            </DetailGrid>
          ) : (
            <EmptyState>Not assigned yet. Ops assigns a station on approval.</EmptyState>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Items" description={`${order.items.length} ordered`} />
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th className="text-center">Setpoint</Th>
              <Th className="text-center">Quantity</Th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <Td>
                  <div className="font-medium">{item.product_name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {item.sku ?? "—"}
                  </div>
                </Td>
                <Td className="text-center tabular-nums">
                  {formatSetpoint(item.setpoint_c)}
                </Td>
                <Td className="text-center font-medium tabular-nums">
                  {formatNumber(item.quantity)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader
          title="Containers"
          description={`${order.containers.length} linked, tracked from packing to return`}
        />
        {order.containers.length === 0 ? (
          <EmptyState>No containers packed yet.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Container</Th>
                <Th className="text-center">Type</Th>
                <Th>Contents</Th>
                <Th className="text-center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {order.containers.map((container) => (
                <tr key={container.container_id}>
                  <Td>
                    <Link
                      href={`/assets/${container.container_id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {container.container_code}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {container.epc ?? "No tag"}
                    </div>
                  </Td>
                  <Td className="text-center">{container.container_type}</Td>
                  <Td>
                    {container.contents.length === 0
                      ? "—"
                      : container.contents
                          .map((line) => `${line.qty} × ${line.sku}`)
                          .join(", ")}
                  </Td>
                  <Td className="text-center">
                    <ContainerStatusBadge status={container.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Delivery" />
          {order.driver ? (
            <DetailGrid>
              <Detail label="Driver">{order.driver.full_name}</Detail>
              <Detail label="Vehicle">{order.vehicle_ref ?? "—"}</Detail>
              <Detail label="Driver email">{order.driver.email}</Detail>
              <Detail label="Return driver">
                {order.return_driver?.full_name ?? "—"}
              </Detail>
            </DetailGrid>
          ) : (
            <EmptyState>No driver assigned yet.</EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader title="Activity" />
          <ol className="grid gap-4">
            {order.history.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-medium text-card-foreground">
                    {humanize(event.action)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      → {humanize(event.to)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.occurred_at)}
                    {event.actor_name && ` · ${event.actor_name}`}
                  </p>
                  {event.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {event.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </Page>
  );
}
