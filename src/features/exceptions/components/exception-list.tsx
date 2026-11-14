"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Page, PageHeader, Stat, StatGrid } from "@/components/ui/page";
import { Table, Td, Th } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { resolveException } from "@/features/exceptions/actions";
import type { ExceptionRecord } from "@/features/exceptions/queries";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDateTime, formatNumber, humanize } from "@/lib/format";

// details is a small JSON blob such as {"container_id": "con-000004"} or {"epc": "..."}.
function parseDetails(details: string | null): { containerId?: string; epc?: string } {
  try {
    const parsed = JSON.parse(details ?? "{}") as { container_id?: string; epc?: string };
    return { containerId: parsed.container_id, epc: parsed.epc };
  } catch {
    return {};
  }
}

export function ExceptionList({ exceptions }: { exceptions: ExceptionRecord[] }) {
  const [tab, setTab] = useState<"OPEN" | "RESOLVED">("OPEN");
  const { run, pending, error } = useServerAction(resolveException);
  const rows = exceptions.filter((exception) => exception.status === tab);
  const open = exceptions.filter((e) => e.status === "OPEN");
  const critical = open.filter((e) => e.severity === "CRITICAL").length;

  return (
    <Page>
      <PageHeader
        title="Exceptions"
        description="Unknown scans and containers reported missing or damaged."
      />

      <StatGrid>
        <Stat label="Open" value={formatNumber(open.length)} />
        <Stat label="Critical" value={formatNumber(critical)} />
        <Stat label="Warnings" value={formatNumber(open.length - critical)} />
        <Stat label="Resolved" value={formatNumber(exceptions.length - open.length)} />
      </StatGrid>

      <Card>
        <CardHeader
          title={tab === "OPEN" ? "Open exceptions" : "Resolved exceptions"}
          description={`${rows.length} ${rows.length === 1 ? "exception" : "exceptions"}`}
          actions={
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "OPEN", label: "Open" },
                { value: "RESOLVED", label: "Resolved" },
              ]}
            />
          }
        />
        {error && (
          <div className="mb-4">
            <FormError message={error} />
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState>
            {tab === "OPEN" ? "Nothing needs attention." : "No resolved exceptions yet."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Issue</Th>
                <Th className="text-center">Severity</Th>
                <Th>Subject</Th>
                <Th>Order</Th>
                <Th>Raised</Th>
                <Th className="text-center">{tab === "OPEN" ? "Action" : "Resolved"}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((exception) => {
                const { containerId, epc } = parseDetails(exception.details);
                return (
                  <tr key={exception.id}>
                    <Td className="font-medium">
                      {exception.kind === "UNKNOWN_EPC"
                        ? "Unknown scan"
                        : humanize(exception.kind)}
                    </Td>
                    <Td className="text-center">
                      <Badge tone={exception.severity === "CRITICAL" ? "red" : "amber"}>
                        {humanize(exception.severity)}
                      </Badge>
                    </Td>
                    <Td>
                      {containerId ? (
                        <Link
                          href={`/assets/${containerId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {containerId.toUpperCase()}
                        </Link>
                      ) : epc ? (
                        <span className="font-mono text-xs">{epc}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      {exception.reference_type === "ORDER" ? (
                        <Link
                          href={`/orders/${exception.reference_id}`}
                          className="text-primary hover:underline"
                        >
                          View order
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>{formatDateTime(exception.created_at)}</Td>
                    <Td className="text-center">
                      {exception.status === "OPEN" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => run({ id: exception.id })}
                        >
                          Resolve
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(exception.resolved_at)}
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  );
}
