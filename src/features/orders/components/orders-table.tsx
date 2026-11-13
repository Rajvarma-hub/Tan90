"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Table, Td, Th } from "@/components/ui/table";
import { NewOrderDialog } from "@/features/orders/components/new-order-dialog";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { orderStatusMeta, orderStatuses } from "@/features/orders/status";
import type { OrderFormOptions, OrderSummary } from "@/features/orders/types";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

const DELIVERED = new Set([
  "DELIVERED",
  "CUSTOMER_CONFIRMED",
  "RETURN_REQUESTED",
  "RETURN_COLLECTED",
  "RETURN_RECEIVED",
  "CLOSED",
]);

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: number;
}) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-card-foreground">
        {formatNumber(value)}
      </span>
    </div>
  );
}

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
  const [pageSize, setPageSize] = useState(10);
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Card>
      <CardHeader
        title="Orders"
        description="Manage and view all orders in the system"
        actions={
          <>
            <Stat icon={Package} label="Total" value={orders.length} />
            <Stat
              icon={Clock}
              label="Pending approval"
              value={orders.filter((o) => o.status === "PENDING_OPS_APPROVAL").length}
            />
            <Stat
              icon={CheckCircle2}
              label="Delivered"
              value={orders.filter((o) => DELIVERED.has(o.status)).length}
            />
            <NewOrderDialog options={options} />
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Input
          type="search"
          placeholder="Search by order, customer, destination…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="Customer"
          value={customerId}
          onChange={(event) => {
            setCustomerId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All Customers</option>
          {options.customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          {orderStatuses.map((value) => (
            <option key={value} value={value}>
              {orderStatusMeta[value].label}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState>No orders match these filters.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order ID</Th>
              <Th>Customer</Th>
              <Th>Freezing Station</Th>
              <Th>Status</Th>
              <Th className="text-right">Assets</Th>
              <Th>Delivery Date</Th>
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
                <Td>
                  {order.stationCode ?? (
                    <span className="inline-flex items-center gap-1.5 text-red-400">
                      <AlertCircle className="size-4" /> Not Assigned
                    </span>
                  )}
                </Td>
                <Td>
                  <OrderStatusBadge status={order.status} />
                </Td>
                <Td className="text-right tabular-nums">
                  <div>{formatNumber(order.totalQuantity)}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </div>
                </Td>
                <Td>
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground">
            Page {currentPage} of {pageCount} · {filtered.length} orders
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <label className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
          Items per page
          <Select
            className="w-20"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </Card>
  );
}
