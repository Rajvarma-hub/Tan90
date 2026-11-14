import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, Detail, EmptyState } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { ContainerStatusBadge } from "@/features/containers/components/container-status-badge";
import { OrderActions } from "@/features/orders/components/order-actions";
import { PackingPanel } from "@/features/orders/components/packing-panel";
import { OrderProgress } from "@/features/orders/components/order-progress";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { OrderActionOptions, OrderDetail } from "@/features/orders/types";
import {
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
    <div className="flex flex-col gap-4 p-4">
      <Link
        href="/orders"
        className="inline-flex items-center gap-2 self-start text-sm font-medium text-card-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Back to Orders
      </Link>

      <OrderProgress status={order.status} />
      {/* Keyed so dialog state resets after each step. */}
      <OrderActions key={order.status} order={order} options={options} />
      {order.status === "PACKING" && <PackingPanel order={order} options={options} />}

      <Card>
        <CardHeader title="Basic Information" />
        <dl className="grid gap-5 sm:grid-cols-2">
          <Detail label="Order ID">{order.order_number}</Detail>
          <Detail label="Status">
            <OrderStatusBadge status={order.status} />
          </Detail>
          <Detail label="Total Assets">{formatNumber(totalAssets)}</Detail>
          <Detail label="Order Date">{formatDateTime(order.created_at)}</Detail>
          <Detail label="Expected Delivery">
            {formatDateTime(order.expected_delivery_at)}
          </Detail>
          <Detail label="Deliver To">{order.destination ?? "—"}</Detail>
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Customer Information" />
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Customer Name">{order.customer?.name ?? "—"}</Detail>
            <Detail label="Contact Phone">
              {order.customer?.contact_phone ?? "—"}
            </Detail>
            <Detail label="Contact Email">
              {order.customer?.contact_email ?? "—"}
            </Detail>
            <Detail label="Address">{order.customer?.address ?? "—"}</Detail>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Freezing Station Information" />
          {order.station ? (
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Station">{order.station.code}</Detail>
              <Detail label="Name">{order.station.name}</Detail>
              <div className="sm:col-span-2">
                <Detail label="Full Address">{order.station.address ?? "—"}</Detail>
              </div>
            </dl>
          ) : (
            <EmptyState>Not assigned yet. Ops assigns a station on approval.</EmptyState>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={`Ordered Items (${order.items.length})`} />
        <Table>
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th>SKU</Th>
              <Th className="text-center">Setpoint</Th>
              <Th className="text-center">Quantity</Th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <Td>{item.product_name}</Td>
                <Td className="font-mono text-xs">{item.sku ?? "—"}</Td>
                <Td className="text-center tabular-nums">
                  {formatSetpoint(item.setpoint_c)}
                </Td>
                <Td className="text-center tabular-nums">
                  {formatNumber(item.quantity)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader
          title={`Containers (${order.containers.length})`}
          description="Containers linked to this order. Each one is tracked from packing to return."
        />
        {order.containers.length === 0 ? (
          <EmptyState>No containers packed yet.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Container</Th>
                <Th>Type</Th>
                <Th>Contents</Th>
                <Th>Status</Th>
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
                  <Td>{container.container_type}</Td>
                  <Td>
                    {container.contents.length === 0
                      ? "—"
                      : container.contents
                          .map((line) => `${line.qty} × ${line.sku}`)
                          .join(", ")}
                  </Td>
                  <Td>
                    <ContainerStatusBadge status={container.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Delivery Information" />
          {order.driver ? (
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Driver Name">{order.driver.full_name}</Detail>
              <Detail label="Vehicle Number">{order.vehicle_ref ?? "—"}</Detail>
              <Detail label="Driver Email">{order.driver.email}</Detail>
              <Detail label="Return Driver">
                {order.return_driver?.full_name ?? "—"}
              </Detail>
            </dl>
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
    </div>
  );
}
