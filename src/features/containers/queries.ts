import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { backend } from "@/server/backend";
import type {
  Container,
  ContainerDetail,
  ContainerSummary,
  ContainerType,
} from "@/features/containers/types";

type ApiStation = { id: string; code: string; name: string };

export async function getContainersPage() {
  const [containers, summary, types, stations] = await Promise.all([
    backend<Container[]>("/api/containers"),
    backend<ContainerSummary>("/api/containers/summary"),
    backend<ContainerType[]>("/api/containers/types"),
    backend<ApiStation[]>("/api/stations"),
  ]);
  return {
    containers,
    summary,
    types,
    stations: stations.map((s) => ({ id: s.id, label: s.code })),
  };
}

export async function getContainerDetail(containerId: string): Promise<ContainerDetail> {
  try {
    return await backend<ContainerDetail>(
      `/api/containers/${encodeURIComponent(containerId)}/detail`,
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
