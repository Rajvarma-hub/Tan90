import "server-only";
import { parseDetails } from "@/features/exceptions/labels";
import type { OrderStatus } from "@/features/orders/types";
import { formatDuration, parseUtc } from "@/lib/format";
import { backend } from "@/server/backend";

export type ExceptionRecord = {
  id: string;
  kind: string;
  severity: string;
  status: "OPEN" | "RESOLVED";
  reference_type: string;
  reference_id: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
};

// An exception with the order and container it concerns, so the list can say "ORD-0010, Disputed".
export type ExceptionRow = ExceptionRecord & {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    customerName: string | null;
  } | null;
  container: { id: string; code: string; type: string; status: string } | null;
  // How long ago it was raised, e.g. "4 days".
  raisedAgo: string;
  raisedMs: number;
};

type ApiOrder = { id: string; order_number: string; status: OrderStatus; customer_id: string };
type ApiCustomer = { id: string; name: string };
type ApiContainer = { id: string; container_code: string; container_type: string; status: string };

// An empty status returns open and resolved exceptions together.
const fetchExceptions = () => backend<ExceptionRecord[]>("/api/exceptions?status=");

export async function getExceptions(): Promise<ExceptionRow[]> {
  const [exceptions, orders, customers, containers] = await Promise.all([
    fetchExceptions(),
    backend<ApiOrder[]>("/api/orders"),
    backend<ApiCustomer[]>("/api/customers"),
    backend<ApiContainer[]>("/api/containers?include_retired=true"),
  ]);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const customerName = new Map(customers.map((customer) => [customer.id, customer.name]));
  const containerById = new Map(containers.map((container) => [container.id, container]));
  const now = Date.now();

  return exceptions.map((exception) => {
    const order =
      exception.reference_type === "ORDER" ? orderById.get(exception.reference_id) : undefined;
    const container = containerById.get(parseDetails(exception.details).containerId ?? "");
    return {
      ...exception,
      raisedAgo: formatDuration(exception.created_at, now),
      raisedMs: now - parseUtc(exception.created_at).getTime(),
      order: order
        ? {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            customerName: customerName.get(order.customer_id) ?? null,
          }
        : null,
      container: container
        ? {
            id: container.id,
            code: container.container_code,
            type: container.container_type,
            status: container.status,
          }
        : null,
    };
  });
}

/** Everything raised against one order, open and resolved. */
export async function getOrderExceptions(orderId: string): Promise<ExceptionRecord[]> {
  const exceptions = await fetchExceptions();
  return exceptions.filter(
    (exception) => exception.reference_type === "ORDER" && exception.reference_id === orderId,
  );
}
