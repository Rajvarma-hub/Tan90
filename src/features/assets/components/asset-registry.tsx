"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { BadgeCell, Cell, rowAccent, Table, Td, Th } from "@/components/ui/table";
import { AssetActions } from "@/features/assets/components/asset-actions";
import { HealthBadge } from "@/features/assets/components/health";
import {
  healthMeta,
  healthOf,
  healthOrder,
  matchesHealth,
  needsAttention,
  type HealthFilter,
} from "@/features/assets/health";
import type { Asset, AssetStation } from "@/features/assets/queries";
import {
  AT_LOCATION,
  containerStatusMeta,
  whereabouts,
} from "@/features/containers/status";
import type { ContainerType } from "@/features/containers/types";
import { formatDate, parseUtc } from "@/lib/format";
import { cn } from "@/lib/utils";

// Where the container physically is, as a line under its assigned location.
function presence(asset: Asset): string {
  if (asset.status === "RETIRED") return "Out of circulation";
  if (asset.status === "MISSING") return "Whereabouts unknown";
  if (AT_LOCATION.includes(asset.status)) return "On site";
  return whereabouts(asset).primary;
}

export function AssetRegistry({
  assets,
  types,
  stations,
  health,
  onHealth,
  fixedLocation = false,
}: {
  assets: Asset[];
  types: ContainerType[];
  stations: AssetStation[];
  health: HealthFilter;
  onHealth: (health: HealthFilter) => void;
  // On a station's own page every row shares the location, so its column and filter are hidden.
  fixedLocation?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState<"" | "tagged" | "untagged">("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Newest registrations first; the code breaks ties so a batch registered together stays in order.
    return assets
      .filter((asset) => {
        return (
          matchesHealth(asset.status, health) &&
          (!locationId || asset.current_location_id === locationId) &&
          (!type || asset.container_type === type) &&
          (!tag || (tag === "tagged" ? Boolean(asset.epc) : !asset.epc)) &&
          (!term ||
            [asset.container_code, asset.epc, asset.container_type, asset.location_code]
              .join(" ")
              .toLowerCase()
              .includes(term))
        );
      })
      .sort(
        (a, b) =>
          parseUtc(b.created_at).getTime() - parseUtc(a.created_at).getTime() ||
          b.container_code.localeCompare(a.container_code),
      );
  }, [assets, search, health, locationId, type, tag]);

  const { rows, page: currentPage, pageCount } = paginate(filtered, page);
  const hasFilters = Boolean(search || health || locationId || type || tag);

  return (
    <>
      <Toolbar>
        <Input
          type="search"
          className="min-w-56 flex-1"
          placeholder="Search code, tag or type"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          className="w-48"
          aria-label="Health"
          value={health}
          onChange={(event) => {
            onHealth(event.target.value as HealthFilter);
            setPage(1);
          }}
        >
          <option value="">All health</option>
          <option value="attention">Needs attention</option>
          {healthOrder.map((value) => (
            <option key={value} value={value}>
              {healthMeta[value].label}
            </option>
          ))}
        </Select>
        {!fixedLocation && (
          <Select
            className="w-48"
            aria-label="Location"
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All locations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.code}
              </option>
            ))}
          </Select>
        )}
        <Select
          className="w-48"
          aria-label="Type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {types.map((value) => (
            <option key={value.code} value={value.name}>
              {value.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          aria-label="Tag"
          value={tag}
          onChange={(event) => {
            setTag(event.target.value as "" | "tagged" | "untagged");
            setPage(1);
          }}
        >
          <option value="">Any tag</option>
          <option value="tagged">Tagged</option>
          <option value="untagged">No tag</option>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setLocationId("");
              setType("");
              setTag("");
              onHealth("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState>No assets match these filters.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Container and type</Th>
              <Th>RFID tag</Th>
              <Th>Registered</Th>
              <Th className="text-center">Health and status</Th>
              {!fixedLocation && <Th>Assigned location</Th>}
              <Th className="text-center">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => {
              const retired = asset.status === "RETIRED";
              const assetHealth = healthOf(asset.status);
              return (
                <tr
                  key={asset.id}
                  className={cn(
                    retired && "opacity-70",
                    rowAccent(needsAttention(assetHealth) ? healthMeta[assetHealth].tone : null),
                  )}
                >
                  <Td>
                    <Cell
                      main={
                        <Link
                          href={`/assets/${asset.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {asset.container_code}
                        </Link>
                      }
                    >
                      <span>{asset.container_type}</span>
                    </Cell>
                  </Td>
                  <Td>
                    {asset.epc ? (
                      <span className="font-mono text-xs text-muted-foreground">{asset.epc}</span>
                    ) : (
                      <Badge tone={retired ? "gray" : "amber"}>
                        {retired ? "Tag removed" : "No tag"}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Cell main={formatDate(asset.created_at)}>
                      <span>{asset.registeredAgo} ago</span>
                    </Cell>
                  </Td>
                  <Td className="text-center">
                    <BadgeCell
                      badge={<HealthBadge health={assetHealth} />}
                      note={
                        !retired &&
                        containerStatusMeta[asset.status]?.label !== healthMeta[assetHealth].label
                          ? containerStatusMeta[asset.status]?.label
                          : null
                      }
                    />
                  </Td>
                  {!fixedLocation && (
                    <Td>
                      <Cell main={asset.location_code ?? "—"}>
                        <span>{presence(asset)}</span>
                      </Cell>
                    </Td>
                  )}
                  <Td className="text-center">
                    <AssetActions asset={asset} types={types} stations={stations} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        total={filtered.length}
        noun={filtered.length === 1 ? "asset" : "assets"}
        onPage={setPage}
      />
    </>
  );
}
