import Link from "next/link";
import { Card, CardHeader, Detail, DetailGrid, EmptyState } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { ContainerStatusBadge } from "@/features/containers/components/container-status-badge";
import { ReplaceTagDialog } from "@/features/containers/components/replace-tag-dialog";
import { containerStatusMeta, whereabouts } from "@/features/containers/status";
import type { ContainerDetail } from "@/features/containers/types";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { OrderStatus } from "@/features/orders/types";
import { formatDate, formatDateTime, humanize } from "@/lib/format";

const statusLabel = (status: string | null) =>
  status ? (containerStatusMeta[status]?.label ?? humanize(status)) : "New";

export function ContainerDetailView({ container }: { container: ContainerDetail }) {
  return (
    <Page>
      <PageHeader
        back={{ href: "/assets", label: "Containers" }}
        title={container.container_code}
        badge={<ContainerStatusBadge status={container.status} />}
        description={container.container_type}
        actions={<ReplaceTagDialog containerId={container.id} />}
      />

      <Card>
        <CardHeader title="Container details" />
        <DetailGrid>
          <Detail label="Tag ID">
            <span className="font-mono text-sm">{container.epc ?? "No tag"}</span>
          </Detail>
          <Detail label="Capacity">{container.capacity_litres} L</Detail>
          <Detail label="Location">
            {[whereabouts(container).primary, whereabouts(container).secondary]
              .filter(Boolean)
              .join(" · ")}
          </Detail>
          <Detail label="Registered">{formatDate(container.created_at)}</Detail>
          <div className="sm:col-span-2">
            <Detail label="Linked order">
              {container.current_order ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/orders/${container.current_order.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {container.current_order.order_number}
                  </Link>
                  <OrderStatusBadge status={container.current_order.status as OrderStatus} />
                  <span className="text-muted-foreground">
                    {container.current_order.customer_name}
                  </span>
                </span>
              ) : (
                "None, free stock"
              )}
            </Detail>
          </div>
        </DetailGrid>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Order history"
            description={`${container.orders.length} ${container.orders.length === 1 ? "order" : "orders"}`}
          />
          {container.orders.length === 0 ? (
            <EmptyState>This container has not been on an order yet.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th className="text-center">Status</Th>
                  <Th className="text-center">Placed</Th>
                </tr>
              </thead>
              <tbody>
                {container.orders.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {order.order_number}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {order.customer_name ?? "—"}
                      </div>
                    </Td>
                    <Td className="text-center">
                      <OrderStatusBadge status={order.status as OrderStatus} />
                    </Td>
                    <Td className="text-center">{formatDate(order.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Movement history" description="Newest first" />
          {container.history.length === 0 ? (
            <EmptyState>No movements recorded.</EmptyState>
          ) : (
            <ol className="grid gap-4">
              {container.history.map((move) => (
                <li key={move.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium text-card-foreground">
                      {statusLabel(move.from_status)} → {statusLabel(move.to_status)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {humanize(move.reason)}
                      {move.to_location && ` · ${move.to_location}`}
                      {move.order_id && (
                        <>
                          {" · "}
                          <Link
                            href={`/orders/${move.order_id}`}
                            className="text-primary hover:underline"
                          >
                            {move.order_number}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(move.occurred_at)}
                      {move.actor_name && ` · ${move.actor_name}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </Page>
  );
}
