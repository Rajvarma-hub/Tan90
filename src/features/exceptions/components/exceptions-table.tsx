"use client";

import { Can } from "@/components/auth/user-context";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, ListChecks, TriangleAlert } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { FormError, Input, Select } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { Cell, Dash, rowAccent, Table, TableCaption, Td, Th } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { containerStatusMeta } from "@/features/containers/status";
import { resolveException } from "@/features/exceptions/actions";
import {
  exceptionExplanation,
  exceptionTitle,
  parseDetails,
} from "@/features/exceptions/labels";
import type { ExceptionRow } from "@/features/exceptions/queries";
import { orderStatusMeta } from "@/features/orders/status";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, formatNumber, formatTime, humanize } from "@/lib/format";

type Severity = "CRITICAL" | "WARNING";
type Tab = "OPEN" | "RESOLVED";

const severityMeta: Record<Severity, { label: string; tone: BadgeTone }> = {
  CRITICAL: { label: "Critical", tone: "red" },
  WARNING: { label: "Warning", tone: "amber" },
};

const severityOf = (exception: ExceptionRow): Severity =>
  exception.severity === "CRITICAL" ? "CRITICAL" : "WARNING";

const HOUR = 3_600_000;

// The longer an issue waits the louder its waiting time gets.
const waitingTone = (ms: number) =>
  ms > 72 * HOUR ? "text-red-400" : ms > 24 * HOUR ? "text-amber-400" : "text-card-foreground";

function ExceptionTableRow({
  exception,
  resolved,
  pending,
  onResolve,
}: {
  exception: ExceptionRow;
  resolved: boolean;
  pending: boolean;
  onResolve: () => void;
}) {
  const { container, order } = exception;
  const { epc } = parseDetails(exception.details);
  const severity = severityMeta[severityOf(exception)];

  return (
    <tr className={rowAccent(resolved ? null : severity.tone)}>
      <Td>
        <Cell main={exceptionTitle(exception.kind)} className="max-w-64">
          <span>{exceptionExplanation(exception.kind)}</span>
        </Cell>
      </Td>
      <Td className="text-center">
        <Badge tone={severity.tone}>{severity.label}</Badge>
      </Td>
      <Td>
        {container ? (
          <Cell
            main={
              <Link
                href={`/assets/${container.id}`}
                className="hover:text-primary hover:underline"
              >
                {container.code}
              </Link>
            }
          >
            <span>{container.type}</span>
            <span>Now {containerStatusMeta[container.status]?.label ?? humanize(container.status)}</span>
          </Cell>
        ) : epc ? (
          <Cell main={<span className="font-mono text-xs">{epc}</span>}>
            <span>Tag not registered</span>
          </Cell>
        ) : (
          <Cell main={<Dash />}>
            <span>No container or tag recorded</span>
          </Cell>
        )}
      </Td>
      <Td>
        {order ? (
          <Cell
            main={
              <Link href={`/orders/${order.id}`} className="hover:text-primary hover:underline">
                {order.orderNumber}
              </Link>
            }
          >
            <span>{order.customerName ?? "—"}</span>
            <span>{orderStatusMeta[order.status]?.label ?? humanize(order.status)}</span>
          </Cell>
        ) : (
          <Cell main={<Dash />}>
            <span>Not tied to an order</span>
          </Cell>
        )}
      </Td>
      <Td className="text-center">
        {resolved ? (
          <Cell
            main={formatDate(exception.resolved_at)}
            center
          >
            <span>{formatTime(exception.resolved_at)}</span>
          </Cell>
        ) : (
          <Cell
            main={<span className={waitingTone(exception.raisedMs)}>{exception.raisedAgo}</span>}
            center
          >
            <span>Since {formatDate(exception.created_at)}</span>
          </Cell>
        )}
      </Td>
      {!resolved && (
        <Td className="text-center">
          <Can permission="exceptions.resolve">
            <Button variant="outline" size="sm" className="w-28" disabled={pending} onClick={onResolve}>
              Resolve
            </Button>
          </Can>
        </Td>
      )}
    </tr>
  );
}

export function ExceptionsTable({ exceptions }: { exceptions: ExceptionRow[] }) {
  const [tab, setTab] = useState<Tab>("OPEN");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { run, pending, error } = useServerAction(resolveException);

  const open = exceptions.filter((e) => e.status === "OPEN");
  const critical = open.filter((e) => severityOf(e) === "CRITICAL").length;
  const ordersAffected = new Set(open.flatMap((e) => (e.order ? [e.order.id] : []))).size;
  const resolvedCount = exceptions.length - open.length;
  const kinds = useMemo(() => [...new Set(exceptions.map((e) => e.kind))], [exceptions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exceptions
      .filter(
        (e) =>
          e.status === tab &&
          (tab !== "OPEN" || !severity || severityOf(e) === severity) &&
          (!kind || e.kind === kind) &&
          (!term ||
            [
              exceptionTitle(e.kind),
              e.container?.code,
              e.container?.type,
              parseDetails(e.details).epc,
              e.order?.orderNumber,
              e.order?.customerName,
            ]
              .join(" ")
              .toLowerCase()
              .includes(term)),
      )
      .sort((a, b) =>
        tab === "OPEN"
          ? Number(severityOf(b) === "CRITICAL") - Number(severityOf(a) === "CRITICAL") ||
            b.raisedMs - a.raisedMs
          : (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""),
      );
  }, [exceptions, tab, severity, kind, search]);

  const { rows, page: currentPage, pageCount } = paginate(filtered, page);
  const hasFilters = Boolean(search || kind || (tab === "OPEN" && severity));

  const showTab = (next: Tab, nextSeverity: Severity | "" = "") => {
    setTab(next);
    setSeverity(nextSeverity);
    setPage(1);
  };
  const toggleSeverity = (value: Severity) =>
    showTab("OPEN", tab === "OPEN" && severity === value ? "" : value);

  return (
    <Page>
      <PageHeader
        title="Exceptions"
        description="Problems that need a decision: unknown scans, and containers reported missing or damaged."
      />

      <StatGrid>
        <Stat
          label="Critical"
          icon={CircleAlert}
          tone={critical ? "red" : "green"}
          value={formatNumber(critical)}
          active={tab === "OPEN" && severity === "CRITICAL"}
          onClick={() => toggleSeverity("CRITICAL")}
        />
        <Stat
          label="Warnings"
          icon={TriangleAlert}
          tone={open.length - critical ? "amber" : "green"}
          value={formatNumber(open.length - critical)}
          active={tab === "OPEN" && severity === "WARNING"}
          onClick={() => toggleSeverity("WARNING")}
        />
        <Stat
          label="All open"
          icon={ListChecks}
          tone="blue"
          value={formatNumber(open.length)}
          active={tab === "OPEN" && severity === ""}
          onClick={() => showTab("OPEN")}
        />
        <Stat
          label="Resolved"
          icon={CircleCheck}
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
              ? `${filtered.length} ${filtered.length === 1 ? "issue" : "issues"} · ${ordersAffected} ${ordersAffected === 1 ? "order" : "orders"} affected`
              : `${filtered.length} resolved`
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
        <TableCaption>
          {tab === "OPEN"
            ? "Critical issues come first, then the longest waiting. Critical means stock may be lost; a warning needs a check."
            : "Most recently resolved first."}
        </TableCaption>

        <Toolbar>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search issue, container, tag, order or customer…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-48"
            aria-label="Issue"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All issues</option>
            {kinds.map((value) => (
              <option key={value} value={value}>
                {exceptionTitle(value)}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setKind("");
                setSeverity("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>
        {error && (
          <div className="mb-4">
            <FormError message={error} />
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState>
            {hasFilters
              ? "No exceptions match these filters."
              : tab === "OPEN"
                ? "Nothing needs attention."
                : "No resolved exceptions yet."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Issue</Th>
                <Th className="text-center">Severity</Th>
                <Th>Container or tag</Th>
                <Th>Related order</Th>
                <Th className="text-center">{tab === "OPEN" ? "Waiting" : "Resolved"}</Th>
                {tab === "OPEN" && <Th className="text-center">Action</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((exception) => (
                <ExceptionTableRow
                  key={exception.id}
                  exception={exception}
                  resolved={tab === "RESOLVED"}
                  pending={pending}
                  onResolve={() => run({ id: exception.id })}
                />
              ))}
            </tbody>
          </Table>
        )}

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={filtered.length}
          noun={filtered.length === 1 ? "exception" : "exceptions"}
          onPage={setPage}
        />
      </Card>
    </Page>
  );
}
