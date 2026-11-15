"use client";

import { Can } from "@/components/auth/user-context";
import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowRight,
  Boxes,
  ScanSearch,
  ShieldCheck,
  Snowflake,
  TriangleAlert,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ItemCard, ItemGrid } from "@/components/ui/card";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { AssetRegistry } from "@/features/assets/components/asset-registry";
import { HealthBar } from "@/features/assets/components/health";
import {
  healthCounts,
  healthMeta,
  healthOf,
  healthOrder,
  needsAttention,
  type HealthFilter,
} from "@/features/assets/health";
import type { Asset, AssetStation } from "@/features/assets/queries";
import { RegisterDialog } from "@/features/containers/components/register-dialog";
import { AT_LOCATION } from "@/features/containers/status";
import type { ContainerType } from "@/features/containers/types";
import { formatNumber, humanize } from "@/lib/format";

type View = "registry" | "stations";

const viewHref = (view: View, station?: string) =>
  (view === "registry"
    ? "/asset-management"
    : `/asset-management?view=stations${station ? `&station=${station}` : ""}`) as Route;

// Counts shown on the stat cards, for any group of assets.
function summarize(list: Asset[]) {
  const active = list.filter((asset) => healthOf(asset.status) !== "retired");
  const counts = healthCounts(list);
  return {
    counts,
    total: active.length,
    onSite: active.filter((asset) => AT_LOCATION.includes(asset.status)).length,
    attention: healthOrder.filter(needsAttention).reduce((sum, h) => sum + counts[h], 0),
  };
}

function StationCards({ assets, stations }: { assets: Asset[]; stations: AssetStation[] }) {
  return (
    <ItemGrid>
      {stations.map((station) => {
        const mine = summarize(assets.filter((asset) => asset.current_location_id === station.id));
        return (
          <ItemCard
            key={station.id}
            icon={station.warehouse ? Warehouse : Snowflake}
            title={station.code}
            subtitle={station.name}
            badge={
              <Badge tone={station.active ? "green" : "gray"}>
                {station.active ? "Online" : "Offline"}
              </Badge>
            }
            stats={[
              { label: "Assets", value: formatNumber(mine.total) },
              { label: "On site", value: formatNumber(mine.onSite) },
              {
                label: "Needs attention",
                value: (
                  <span className={mine.attention ? "text-red-400" : undefined}>
                    {mine.attention}
                  </span>
                ),
              },
            ]}
            footer={
              <Link
                href={viewHref("stations", station.id)}
                className={buttonClass({ variant: "outline", className: "w-full" })}
              >
                Open {station.warehouse ? "warehouse" : "station"} <ArrowRight />
              </Link>
            }
          >
            <HealthBar counts={mine.counts} />
          </ItemCard>
        );
      })}
    </ItemGrid>
  );
}

export function AssetManagement({
  assets,
  types,
  stations,
}: {
  assets: Asset[];
  types: ContainerType[];
  stations: AssetStation[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const view: View = params.get("view") === "stations" ? "stations" : "registry";
  const station = view === "stations" ? stations.find((s) => s.id === params.get("station")) : undefined;
  const [health, setHealth] = useState<HealthFilter>("");

  const scope = station
    ? assets.filter((asset) => asset.current_location_id === station.id)
    : assets;
  const totals = summarize(scope);
  const stationOptions = stations.map((s) => ({ id: s.id, label: s.code }));

  const showHealth = (next: HealthFilter) => {
    setHealth(next);
    if (!station) router.push(viewHref("registry"));
  };
  const stat = (
    label: string,
    value: number,
    filter: HealthFilter,
    icon: LucideIcon,
    tone: BadgeTone,
    unfiltered = false,
  ) => (
    <Stat
      label={label}
      icon={icon}
      tone={tone}
      value={formatNumber(value)}
      active={!unfiltered && health === filter}
      onClick={() => showHealth(unfiltered || health === filter ? "" : filter)}
    />
  );

  return (
    <Page>
      <PageHeader
        back={station ? { href: viewHref("stations"), label: "Stations" } : undefined}
        title={station ? station.code : "Asset Management"}
        description={
          station
            ? [station.name, station.address].filter(Boolean).join(" · ")
            : "Every container: when it was registered, how healthy it is, and which tag it carries."
        }
        badge={
          station && (
            <Badge tone={station.active ? "green" : "gray"}>
              {station.active ? "Online" : "Offline"}
            </Badge>
          )
        }
        actions={
          <Can permission="containers.register">
            <RegisterDialog types={types} stations={stationOptions} />
          </Can>
        }
      />

      <StatGrid>
        {stat(station ? "Assets here" : "Total assets", totals.total, "", Boxes, "blue", true)}
        {stat("Healthy", totals.counts.healthy, "healthy", ShieldCheck, healthMeta.healthy.tone)}
        {stat("Under inspection", totals.counts.inspection, "inspection", ScanSearch, healthMeta.inspection.tone)}
        {stat("Needs attention", totals.attention, "attention", TriangleAlert, totals.attention ? "red" : "green")}
        {stat("Unregistered", totals.counts.retired, "retired", Archive, healthMeta.retired.tone)}
      </StatGrid>

      {station && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Health"
              description={`${totals.onSite} of ${totals.total} assets are on site; the rest are out for delivery, with customers or missing.`}
            />
            <HealthBar counts={totals.counts} />
          </Card>
          <Card>
            <CardHeader title="Team" description={`${station.team.length} people`} />
            {station.team.length === 0 ? (
              <EmptyState>No staff assigned.</EmptyState>
            ) : (
              <ul className="grid gap-2 text-sm">
                {station.team.map((member) => (
                  <li key={member.name} className="flex items-center justify-between gap-3">
                    <span className="truncate text-card-foreground">{member.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {humanize(member.role)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          title={
            station
              ? `Assets at ${station.code}`
              : view === "registry"
                ? "Registry"
                : "Assets by location"
          }
          description={
            station
              ? "Containers assigned to this location, including those currently out."
              : view === "registry"
                ? "Newest first. Edit a container's tag, type or location, or unregister it."
                : "How many containers each location has and how healthy they are."
          }
          actions={
            station ? undefined : (
              <Tabs
                value={view}
                onChange={(next) => router.push(viewHref(next))}
                options={[
                  { value: "registry", label: "Registry" },
                  { value: "stations", label: "By station" },
                ]}
              />
            )
          }
        />
        {view === "stations" && !station ? (
          <StationCards assets={assets} stations={stations} />
        ) : (
          <AssetRegistry
            assets={scope}
            types={types}
            stations={stations}
            health={health}
            onHealth={setHealth}
            fixedLocation={Boolean(station)}
          />
        )}
      </Card>
    </Page>
  );
}
