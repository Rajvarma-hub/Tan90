import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { formatDuration } from "@/lib/format";
import { backend } from "@/server/backend";
import type {
  Container,
  ContainerDetail,
  ContainerSummary,
  ContainerType,
} from "@/features/containers/types";

type ApiStation = { id: string; code: string; name: string; kind: string };
type ApiUser = {
  id: string;
  full_name: string;
  role: string;
  location_id: string | null;
  customer_id: string | null;
};
type ApiCustomer = { id: string; name: string };
type ApiOrder = { id: string; driver_id: string | null; return_driver_id: string | null };

export async function getContainersPage() {
  const [containers, summary, types, stations, users, customers, orders] = await Promise.all([
    backend<Container[]>("/api/containers"),
    backend<ContainerSummary>("/api/containers/summary"),
    backend<ContainerType[]>("/api/containers/types"),
    backend<ApiStation[]>("/api/stations"),
    backend<ApiUser[]>("/api/users"),
    backend<ApiCustomer[]>("/api/customers"),
    backend<ApiOrder[]>("/api/orders"),
  ]);
  return {
    containers,
    summary,
    types,
    stations: stations.map((s) => ({ id: s.id, label: s.code })),
    locations: stations.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      warehouse: s.kind === "WAREHOUSE",
      team: users
        .filter((u) => u.location_id === s.id)
        .map((u) => ({ name: u.full_name, role: u.role })),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      contacts: users.filter((u) => u.customer_id === c.id).map((u) => u.full_name),
    })),
    drivers: users
      .filter((u) => u.role === "DRIVER")
      .map((u) => ({ id: u.id, name: u.full_name })),
    orderDrivers: Object.fromEntries(
      orders.map((o) => [o.id, { delivery: o.driver_id, pickup: o.return_driver_id }]),
    ),
  };
}

export async function getContainerDetail(containerId: string): Promise<ContainerDetail> {
  try {
    const detail = await backend<ContainerDetail>(
      `/api/containers/${encodeURIComponent(containerId)}/detail`,
    );
    const last = detail.history[0];
    return {
      ...detail,
      sinceLastMove: last ? formatDuration(last.occurred_at, Date.now()) : null,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
