"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { Tabs } from "@/components/ui/tabs";
import { containerStatusMeta } from "@/features/containers/status";
import { resolveException } from "@/features/exceptions/actions";
import {
  exceptionExplanation,
  exceptionTitle,
  parseDetails,
} from "@/features/exceptions/labels";
import type { ExceptionRow } from "@/features/exceptions/queries";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, formatNumber, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Severity = "CRITICAL" | "WARNING";

const severityMeta: Record<
  Severity,
  { label: string; icon: typeof CircleAlert; icon_tone: string; edge: string }
> = {
  CRITICAL: {
    label: "Critical",
    icon: CircleAlert,
    icon_tone: "bg-red-500/10 text-red-400",
    edge: "border-l-red-500",
  },
  WARNING: {
    label: "Warning",
    icon: TriangleAlert,
    icon_tone: "bg-amber-500/10 text-amber-400",
    edge: "border-l-amber-500",
  },
};

const severityOf = (exception: ExceptionRow): Severity =>
  exception.severity === "CRITICAL" ? "CRITICAL" : "WARNING";

// Icon, issue, order, waiting time and action share these columns on wide screens.
const ROW_GRID = "lg:grid lg:grid-cols-[2.5rem_minmax(0,1.3fr)_minmax(0,1.1fr)_7.5rem_6.5rem]";

const HOUR = 3_600_000;

// The longer an issue waits the louder its waiting time gets.
const waitingTone = (ms: number) =>
  ms > 72 * HOUR ? "text-red-400" : ms > 24 * HOUR ? "text-amber-400" : "text-card-foreground";

function ExceptionRowItem({
  exception,
  pending,
  onResolve,
}: {
  exception: ExceptionRow;
  pending: boolean;
  onResolve: () => void;
}) {
  const { container, order } = exception;
  const { epc } = parseDetails(exception.details);
  const resolved = exception.status === "RESOLVED";
  const severity = severityMeta[severityOf(exception)];
  const Icon = resolved ? CircleCheck : severity.icon;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 border-l-4 px-5 py-3.5",
        ROW_GRID,
        resolved ? "border-l-transparent" : severity.edge,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          resolved ? "bg-emerald-500/10 text-emerald-400" : severity.icon_tone,
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-card-foreground">
          <span title={exceptionExplanation(exception.kind)}>
            {exceptionTitle(exception.kind)}
          </span>
          {resolved && (
            <Badge tone={severityOf(exception) === "CRITICAL" ? "red" : "amber"}>
              {severity.label}
            </Badge>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {container ? (
            <>
              <Link
                href={`/assets/${container.id}`}
                className="font-medium text-card-foreground hover:text-primary hover:underline"
              >
                {container.code}
              </Link>
              <span>
                {container.type} · now{" "}
                {containerStatusMeta[container.status]?.label ?? humanize(container.status)}
              </span>
            </>
          ) : epc ? (
            <>
              <span className="font-mono text-xs text-card-foreground">{epc}</span>
              <span>tag not registered</span>
            </>
          ) : (
            <span>No container or tag recorded</span>
          )}
        </p>
      </div>

      <div className="min-w-0 flex-1 basis-48 lg:flex-none">
        {order ? (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <Link
                href={`/orders/${order.id}`}
                className="font-medium text-primary hover:underline"
              >
                {order.orderNumber}
              </Link>
              <OrderStatusBadge status={order.status} />
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {order.customerName ?? "—"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not tied to an order</p>
        )}
      </div>

      <div className="w-30 shrink-0">
        {resolved ? (
          <>
            <p className="text-sm font-medium text-emerald-400">Resolved</p>
            <p className="text-xs text-muted-foreground">{formatDate(exception.resolved_at)}</p>
          </>
        ) : (
          <>
            <p className={cn("text-sm font-semibold", waitingTone(exception.raisedMs))}>
              {exception.raisedAgo}
            </p>
            <p className="text-xs text-muted-foreground">since {formatDate(exception.created_at)}</p>
          </>
        )}
      </div>

      <div className="flex w-26 shrink-0 justify-end">
        {!resolved && (
          <Button variant="outline" size="sm" disabled={pending} onClick={onResolve}>
            Resolve
          </Button>
        )}
      </div>
    </li>
  );
}

function ColumnHeads({ resolved }: { resolved: boolean }) {
  return (
    <div
      className={cn(
        "hidden gap-x-4 border-b border-border/60 bg-muted/40 py-2 pr-5 pl-6 text-xs font-medium tracking-wide text-muted-foreground uppercase",
        ROW_GRID,
      )}
    >
      <span />
      <span>Issue and container</span>
      <span>Related order</span>
      <span>{resolved ? "Resolved" : "Waiting"}</span>
      <span />
    </div>
  );
}

export function ExceptionList({ exceptions }: { exceptions: ExceptionRow[] }) {
  const [tab, setTab] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [severity, setSeverity] = useState<Severity | "">("");
  const { run, pending, error } = useServerAction(resolveException);

  const open = exceptions.filter((e) => e.status === "OPEN");
  const critical = open.filter((e) => severityOf(e) === "CRITICAL");
  const warnings = open.filter((e) => severityOf(e) === "WARNING");
  const ordersAffected = new Set(open.flatMap((e) => (e.order ? [e.order.id] : []))).size;
  const resolvedCount = exceptions.length - open.length;

  const inTab = exceptions.filter((e) => e.status === tab);
  const filtered =
    tab === "OPEN" && severity ? inTab.filter((e) => severityOf(e) === severity) : inTab;
  // Open: whoever has waited longest first. Resolved: most recently closed first.
  const shown = [...filtered].sort((a, b) =>
    tab === "OPEN"
      ? b.raisedMs - a.raisedMs
      : (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""),
  );
  const groups: { key: string; title: string | null; items: ExceptionRow[] }[] =
    tab === "OPEN"
      ? (["CRITICAL", "WARNING"] as const)
          .map((key) => ({
            key,
            title: severityMeta[key].label,
            items: shown.filter((e) => severityOf(e) === key),
          }))
          .filter((group) => group.items.length > 0)
      : [{ key: "resolved", title: null, items: shown }];

  const kinds = [...new Set(exceptions.map((e) => e.kind))];

  const showTab = (next: "OPEN" | "RESOLVED", nextSeverity: Severity | "" = "") => {
    setTab(next);
    setSeverity(nextSeverity);
  };

  return (
    <Page>
      <PageHeader
        title="Exceptions"
        description="Problems that need a decision: unknown scans, and containers reported missing or damaged."
      />

      <StatGrid>
        <Stat
          label="Critical"
          tone={critical.length ? "red" : undefined}
          value={formatNumber(critical.length)}
          active={tab === "OPEN" && severity === "CRITICAL"}
          onClick={() => showTab("OPEN", severity === "CRITICAL" ? "" : "CRITICAL")}
        />
        <Stat
          label="Warnings"
          tone={warnings.length ? "amber" : undefined}
          value={formatNumber(warnings.length)}
          active={tab === "OPEN" && severity === "WARNING"}
          onClick={() => showTab("OPEN", severity === "WARNING" ? "" : "WARNING")}
        />
        <Stat
          label="All open"
          value={formatNumber(open.length)}
          active={tab === "OPEN" && severity === ""}
          onClick={() => showTab("OPEN")}
        />
        <Stat
          label="Resolved"
          tone="green"
          value={formatNumber(resolvedCount)}
          active={tab === "RESOLVED"}
          onClick={() => showTab("RESOLVED")}
        />
      </StatGrid>

      <Card>
        <CardHeader
          title={tab === "OPEN" ? "Open exceptions" : "Resolved exceptions"}
          description={
            tab === "OPEN"
              ? `${shown.length} ${shown.length === 1 ? "issue" : "issues"} · ${ordersAffected} ${ordersAffected === 1 ? "order" : "orders"} affected · longest waiting first`
              : `${shown.length} resolved · most recent first`
          }
          actions={
            <Tabs
              value={tab}
              onChange={(next) => showTab(next)}
              options={[
                { value: "OPEN", label: "Open" },
                { value: "RESOLVED", label: "Resolved" },
              ]}
            />
          }
        />
        <details className="mb-4 text-sm">
          <summary className="w-fit cursor-pointer text-muted-foreground hover:text-card-foreground">
            What do these mean?
          </summary>
          <dl className="mt-2 grid gap-1.5 rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="grid gap-1 sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium text-card-foreground">Critical</dt>
              <dd className="text-muted-foreground">A container is missing. Stock may be lost.</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium text-card-foreground">Warning</dt>
              <dd className="text-muted-foreground">
                A container is damaged or a tag was scanned that nobody has registered.
              </dd>
            </div>
            {kinds.map((kind) => (
              <div key={kind} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
                <dt className="font-medium text-card-foreground">{exceptionTitle(kind)}</dt>
                <dd className="text-muted-foreground">{exceptionExplanation(kind)}</dd>
              </div>
            ))}
          </dl>
        </details>
        {error && (
          <div className="mb-4">
            <FormError message={error} />
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState>
            {tab === "OPEN" ? "Nothing needs attention." : "No resolved exceptions yet."}
          </EmptyState>
        ) : (
          <div className="grid gap-6">
            {groups.map((group) => (
              <section key={group.key}>
                {group.title && (
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    {group.title}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                      {group.items.length}
                    </span>
                  </h3>
                )}
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <ColumnHeads resolved={tab === "RESOLVED"} />
                  <ul className="divide-y divide-border/60">
                    {group.items.map((exception) => (
                      <ExceptionRowItem
                        key={exception.id}
                        exception={exception}
                        pending={pending}
                        onResolve={() => run({ id: exception.id })}
                      />
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
