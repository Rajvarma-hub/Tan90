"use client";

import { Can } from "@/components/auth/user-context";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Package, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { Input, Select } from "@/components/ui/form";
import { OpenRow } from "@/components/ui/open-row";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { Cell, rowAccent, Table, Td, Th } from "@/components/ui/table";
import { NewOrderDialog } from "@/features/orders/components/new-order-dialog";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { DELIVERED, IN_PROGRESS, orderStatusMeta, orderStatuses } from "@/features/orders/status";
import type { OrderFormOptions, OrderSummary } from "@/features/orders/types";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

type Group = "" | "pending" | "progress" | "delivered";

const inGroup: Record<Exclude<Group, "">, (status: string) => boolean> = {
  pending: (status) => status === "PENDING_OPS_APPROVAL",
  progress: (status) => IN_PROGRESS.has(status),
  delivered: (status) => DELIVERED.has(status),
};

export function OrdersTable({
  orders,
  options,
  external,
}: {
  orders: OrderSummary[];
  options: OrderFormOptions;
  // A customer or driver: sees only their own orders, without station or customer filters.
  external: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("");
  const [group, setGroup] = useState<Group>("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter(
      (order) =>
        (!customerId || order.customerId === customerId) &&
        (!status || order.status === status) &&
        (!group || inGroup[group](order.status)) &&
        (!term ||
          [order.orderNumber, order.customerName, order.destination, order.stationCode]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [orders, search, customerId, status, group]);

  const { rows, page: currentPage, pageCount } = paginate(filtered, page);
  const hasFilters = Boolean(search || customerId || status || group);

  const stat = (label: string, key: Group, icon: LucideIcon, tone: BadgeTone) => {
    const count = key ? orders.filter((o) => inGroup[key](o.status)).length : orders.length;
    return (
      <Stat
        label={label}
        icon={icon}
        tone={tone === "amber" && count === 0 ? "blue" : tone}
        value={formatNumber(count)}
        active={key !== "" && group === key}
        onClick={() => {
          setGroup(group === key ? "" : key);
          setStatus("");
          setPage(1);
        }}
      />
    );
  };

  return (
    <Page>
      <PageHeader
        title="Orders"
        description={
          external
            ? "Your orders, from placement to return."
            : "Track every order from placement to return."
        }
        actions={
          <>
            <ExportButton
              filename="orders"
              headers={["Order", "Customer", "Destination", "Station", "Status", "Quantity", "Products", "Placed", "Expected delivery"]}
              rows={filtered.map((o) => [
                o.orderNumber,
                o.customerName,
                o.destination,
                o.stationCode,
                orderStatusMeta[o.status].label,
                o.totalQuantity,
                o.itemCount,
                o.createdAt,
                o.expectedDeliveryAt,
              ])}
            />
            <Can permission="orders.create">
              <NewOrderDialog options={options} ownCompany={external} />
            </Can>
          </>
        }
      />

      <StatGrid>
        {stat("Total orders", "", Package, "blue")}
        {stat("Pending approval", "pending", Clock, "amber")}
        {stat("In progress", "progress", Truck, "blue")}
        {stat("Delivered", "delivered", PackageCheck, "green")}
      </StatGrid>

      <Card>
      <CardHeader
        title="All orders"
        description={`${filtered.length} of ${orders.length} shown · newest first`}
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
        {!external && (
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
        )}
        <Select
          className="w-48"
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setGroup("");
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
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setCustomerId("");
              setStatus("");
              setGroup("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState>No orders match these filters.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>{external ? "Destination" : "Customer and destination"}</Th>
              {!external && <Th className="text-center">Station</Th>}
              <Th className="text-center">Status</Th>
              <Th className="text-center">Quantity</Th>
              <Th className="text-center">Expected delivery</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <OpenRow
                key={order.id}
                onOpen={() => router.push(`/orders/${order.id}`)}
                className={rowAccent(order.status === "DISPUTED" ? "red" : null)}
              >
                <Td>
                  <Cell
                    main={
                      <Link
                        href={`/orders/${order.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    }
                  >
                    <span>Placed {formatDate(order.createdAt)}</span>
                  </Cell>
                </Td>
                <Td>
                  {external ? (
                    (order.destination ?? "No destination")
                  ) : (
                    <Cell main={order.customerName}>
                      <span>{order.destination ?? "No destination"}</span>
                    </Cell>
                  )}
                </Td>
                {!external && (
                  <Td className="text-center">
                    {order.stationCode ?? (
                      <span className="inline-flex items-center gap-1.5 text-red-400">
                        <AlertCircle className="size-4" /> Not assigned
                      </span>
                    )}
                  </Td>
                )}
                <Td className="text-center">
                  <OrderStatusBadge status={order.status} />
                </Td>
                <Td className="text-center">
                  <Cell main={formatNumber(order.totalQuantity)} center>
                    <span>
                      {order.itemCount} {order.itemCount === 1 ? "product" : "products"}
                    </span>
                  </Cell>
                </Td>
                <Td className="text-center">
                  <Cell main={formatDate(order.expectedDeliveryAt)} center>
                    {order.expectedDeliveryAt && <span>{formatTime(order.expectedDeliveryAt)}</span>}
                  </Cell>
                </Td>
              </OpenRow>
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
