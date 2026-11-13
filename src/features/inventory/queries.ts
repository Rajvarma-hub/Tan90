import "server-only";
import { backend } from "@/server/backend";
import type {
  Product,
  Station,
  StationSummary,
  StockBalance,
  StockMovement,
} from "@/features/inventory/types";

export const getBalances = () => backend<StockBalance[]>("/api/inventory");

export const getProducts = () => backend<Product[]>("/api/products");

export const getStations = () => backend<Station[]>("/api/stations");

export const getMovements = () =>
  backend<StockMovement[]>("/api/inventory/movements?limit=500");

const OPEN_ORDER_STATUSES = new Set([
  "APPROVED",
  "PACKING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "ARRIVED",
]);

export async function getStationSummaries(): Promise<StationSummary[]> {
  const [stations, balances, containers, orders] = await Promise.all([
    getStations(),
    getBalances(),
    backend<{ status: string; current_location_id: string | null }[]>(
      "/api/containers",
    ),
    backend<{ status: string; station_id: string | null }[]>("/api/orders"),
  ]);

  return stations.map((station) => {
    const here = containers.filter((c) => c.current_location_id === station.id);
    return {
      ...station,
      stockUnits: balances
        .filter((b) => b.location_id === station.id)
        .reduce((sum, b) => sum + b.quantity, 0),
      containersTotal: here.length,
      containersAvailable: here.filter((c) => c.status === "AVAILABLE").length,
      openOrders: orders.filter(
        (o) => o.station_id === station.id && OPEN_ORDER_STATUSES.has(o.status),
      ).length,
    };
  });
}
