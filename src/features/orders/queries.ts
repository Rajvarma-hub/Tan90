import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { formatDuration } from "@/lib/format";
import { can, type Role } from "@/lib/permissions";
import { backend } from "@/server/backend";
import { getCurrentUser } from "@/server/session";
import type {
  OrderActionOptions,
  OrderDetail,
  OrderFormOptions,
  OrderStatus,
  OrderSummary,
} from "@/features/orders/types";

type ApiOrder = {
  id: string;
  order_number: string;
  customer_id: string;
  station_id: string | null;
  destination: string | null;
  status: OrderStatus;
  expected_delivery_at: string | null;
  created_at: string;
  items: { product_id: string; quantity: number }[];
};
type ApiCustomer = { id: string; name: string };
type ApiStation = { id: string; code: string; name: string; kind: string };
type ApiProduct = { id: string; sku: string; name: string };
type ApiUser = { id: string; full_name: string };
type ApiContainer = {
  container_code: string;
  container_type: string;
  epc: string | null;
};

export async function getOrdersPage(): Promise<{
  orders: OrderSummary[];
  options: OrderFormOptions;
  external: boolean;
}> {
  const user = await getCurrentUser();
  // Staff see the whole operation. Customers and drivers get only their own orders, which the
  // API already limits, and no customer or station lists.
  const isStaff = can(user.role, "staff.view");
  const [orders, customers, stations, products] = await Promise.all([
    backend<ApiOrder[]>("/api/orders"),
    isStaff ? backend<ApiCustomer[]>("/api/customers") : Promise.resolve<ApiCustomer[]>([]),
    isStaff ? backend<ApiStation[]>("/api/stations") : Promise.resolve<ApiStation[]>([]),
    can(user.role, "orders.create")
      ? backend<ApiProduct[]>("/api/products")
      : Promise.resolve<ApiProduct[]>([]),
  ]);
  if (!isStaff && user.customer_id) {
    customers.push({ id: user.customer_id, name: user.customer_name ?? "Your company" });
  }
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const stationCode = new Map(stations.map((s) => [s.id, s.code]));

  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      customerId: order.customer_id,
      customerName: customerName.get(order.customer_id) ?? order.customer_id,
      destination: order.destination,
      stationCode: order.station_id
        ? (stationCode.get(order.station_id) ?? order.station_id)
        : null,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      itemCount: order.items.length,
      expectedDeliveryAt: order.expected_delivery_at,
      createdAt: order.created_at,
    })),
    external: !isStaff,
    options: {
      customers: customers.map((c) => ({ id: c.id, label: c.name })),
      stations: freezingStations(stations),
      products: products.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` })),
    },
  };
}

function freezingStations(stations: ApiStation[]) {
  return stations
    .filter((s) => s.kind === "FREEZING_STATION")
    .map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  try {
    const detail = await backend<OrderDetail>(
      `/api/orders/${encodeURIComponent(orderId)}/detail`,
    );
    return detail.last_location
      ? { ...detail, location_age: formatDuration(detail.last_location.recorded_at, Date.now()) }
      : detail;
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function getOrderActionOptions(
  order: OrderDetail,
  role: Role,
): Promise<OrderActionOptions> {
  // Station and driver lists are for staff who assign work; the API refuses them to others.
  if (!can(role, "staff.view")) {
    return { stations: [], drivers: [], availableContainers: [] };
  }
  const packing = order.status === "PACKING" && order.station;
  const [stations, drivers, containers] = await Promise.all([
    backend<ApiStation[]>("/api/stations?kind=FREEZING_STATION"),
    backend<ApiUser[]>("/api/users?role=DRIVER"),
    packing
      ? backend<ApiContainer[]>(
          `/api/containers?status=AVAILABLE&location_id=${encodeURIComponent(order.station!.id)}`,
        )
      : Promise.resolve([]),
  ]);
  return {
    stations: freezingStations(stations),
    drivers: drivers.map((d) => ({ id: d.id, label: d.full_name })),
    availableContainers: containers
      .filter((c) => c.epc)
      .map((c) => ({
        epc: c.epc!,
        label: `${c.container_code} · ${c.container_type}`,
      })),
  };
}
