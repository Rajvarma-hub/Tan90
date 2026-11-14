"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { Table, Td, Th } from "@/components/ui/table";
import { NewOrderDialog } from "@/features/orders/components/new-order-dialog";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { orderStatusMeta, orderStatuses } from "@/features/orders/status";
import type { OrderFormOptions, OrderSummary } from "@/features/orders/types";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

const IN_PROGRESS = new Set([
  "APPROVED",
  "PACKING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED",
]);

const DELIVERED = new Set([
  "DELIVERED",
  "CUSTOMER_CONFIRMED",
  "RETURN_REQUESTED",
  "RETURN_COLLECTED",
  "RETURN_RECEIVED",
  "CLOSED",
]);

export function OrdersTable({
  orders,
  options,
}: {
  orders: OrderSummary[];
  options: OrderFormOptions;
}) {
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter(
      (order) =>
        (!customerId || order.customerId === customerId) &&
        (!status || order.status === status) &&
        (!term ||
          [order.orderNumber, order.customerName, order.destination, order.stationCode]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [orders, search, customerId, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Page>
      <PageHeader
        title="Orders"
        description="Track every order from placement to return."
        actions={<NewOrderDialog options={options} />}
      />

      <StatGrid>
        <Stat label="Total orders" value={formatNumber(orders.length)} />
        <Stat
          label="Pending approval"
          value={formatNumber(orders.filter((o) => o.status === "PENDING_OPS_APPROVAL").length)}
        />
        <Stat
          label="In progress"
          value={formatNumber(orders.filter((o) => IN_PROGRESS.has(o.status)).length)}
        />
        <Stat
          label="Delivered"
          value={formatNumber(orders.filter((o) => DELIVERED.has(o.status)).length)}
        />
      </StatGrid>

      <Card>
      <CardHeader
        title="All orders"
        description={`${filtered.length} of ${orders.length} shown`}
      />

      <Toolbar>
        <Input
          type="search"
          className="min-w-56 flex-1"
          placeholder="Search by order, customer, destination…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          className="w-48"
          aria-label="Customer"
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All customers</option>
          {options.customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </Select>
        <Select
          className="w-48"
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {orderStatuses.map((value) => (
            <option key={value} value={value}>
              {orderStatusMeta[value].label}
            </option>
          ))}
        </Select>
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState>No orders match these filters.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th className="text-center">Station</Th>
              <Th className="text-center">Status</Th>
              <Th className="text-center">Items</Th>
              <Th className="text-center">Delivery</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-accent/50">
                <Td>
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </Td>
                <Td>
                  <div className="font-medium">{order.customerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.destination ?? "No destination"}
                  </div>
                </Td>
                <Td className="text-center">
                  {order.stationCode ?? (
                    <span className="inline-flex items-center gap-1.5 text-red-400">
                      <AlertCircle className="size-4" /> Not assigned
                    </span>
                  )}
                </Td>
                <Td className="text-center">
                  <OrderStatusBadge status={order.status} />
                </Td>
                <Td className="text-center tabular-nums">
                  <div>{formatNumber(order.totalQuantity)}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </div>
                </Td>
                <Td className="text-center">
                  <div className="font-medium">
                    {formatDate(order.expectedDeliveryAt)}
                  </div>
                  {order.expectedDeliveryAt && (
                    <div className="text-xs text-muted-foreground">
                      {formatTime(order.expectedDeliveryAt)}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        total={filtered.length}
        noun={filtered.length === 1 ? "order" : "orders"}
        onPage={setPage}
      />
      </Card>
    </Page>
  );
}
