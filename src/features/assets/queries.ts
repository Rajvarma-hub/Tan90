import "server-only";
import type { Container, ContainerType } from "@/features/containers/types";
import { formatDuration } from "@/lib/format";
import { backend } from "@/server/backend";

type ApiStation = {
  id: string;
  code: string;
  name: string;
  kind: string;
  address: string | null;
  is_active: boolean;
};
type ApiUser = { full_name: string; role: string; location_id: string | null };

export type Asset = Container & {
  // How long ago it was registered, e.g. "30 days".
  registeredAgo: string;
};

export type AssetStation = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  warehouse: boolean;
  active: boolean;
  team: { name: string; role: string }[];
};

export async function getAssetManagement() {
  const [containers, types, stations, users] = await Promise.all([
    backend<Container[]>("/api/containers?include_retired=true"),
    backend<ContainerType[]>("/api/containers/types"),
    backend<ApiStation[]>("/api/stations"),
    backend<ApiUser[]>("/api/users"),
  ]);
  const now = Date.now();

  return {
    assets: containers.map<Asset>((c) => ({
      ...c,
      registeredAgo: formatDuration(c.created_at, now),
    })),
    types,
    stations: stations.map<AssetStation>((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      address: s.address,
      warehouse: s.kind === "WAREHOUSE",
      active: s.is_active,
      team: users
        .filter((u) => u.location_id === s.id)
        .map((u) => ({ name: u.full_name, role: u.role })),
    })),
  };
}
