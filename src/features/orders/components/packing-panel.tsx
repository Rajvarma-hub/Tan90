"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { FormError, Input } from "@/components/ui/form";
import { ScanInput } from "@/components/ui/scan-input";
import { Table, Td, Th } from "@/components/ui/table";
import { runOrderAction, scanIntoPacking } from "@/features/orders/actions";
import type { OrderActionOptions, OrderDetail } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";
import { cn } from "@/lib/utils";

type Quantities = Record<string, Record<string, string>>; // containerId -> sku -> qty

/**
 * Packing station for an order in PACKING: scan containers onto the order,
 * record what goes into each one, then complete the session.
 */
export function PackingPanel({
  order,
  options,
}: {
  order: OrderDetail;
  options: OrderActionOptions;
}) {
  const router = useRouter();
  const orderId = order.id;
  const items = order.items.map((item) => ({
    sku: item.sku ?? item.product_id,
    name: item.product_name,
    ordered: item.quantity,
  }));

  const [quantities, setQuantities] = useState<Quantities>(() =>
    Object.fromEntries(
      order.containers.map((container) => [
        container.container_id,
        Object.fromEntries(
          container.contents.map((line) => [line.sku, String(line.qty)]),
        ),
      ]),
    ),
  );
  const [scanMessage, setScanMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [scanning, startScan] = useTransition();
  const action = useServerAction(runOrderAction);

  const qty = (containerId: string, sku: string) =>
    Number(quantities[containerId]?.[sku] ?? 0) || 0;
  const packed = (sku: string) =>
    order.containers.reduce((sum, c) => sum + qty(c.container_id, sku), 0);
  const noneEmpty = order.containers.every((c) =>
    items.some((item) => qty(c.container_id, item.sku) > 0),
  );
  const allPacked =
    noneEmpty && items.every((item) => packed(item.sku) === item.ordered);

  function scan(code: string) {
    startScan(async () => {
      const result = await scanIntoPacking({ orderId, code });
      if (!result.ok) {
        setScanMessage({ ok: false, text: result.error.message });
        return;
      }
      setScanMessage({
        ok: result.data.outcome === "added",
        text: result.data.message,
      });
      if (result.data.outcome === "added") router.refresh();
    });
  }

  function splitEvenly() {
    const count = order.containers.length;
    if (count === 0) return;
    setQuantities(
      Object.fromEntries(
        order.containers.map((container, index) => [
          container.container_id,
          Object.fromEntries(
            items.map((item) => [
              item.sku,
              String(
                Math.floor(item.ordered / count) + (index < item.ordered % count ? 1 : 0),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  return (
    <Card className="border-primary/40">
      <CardHeader
        title="Packing"
        description={`Scan containers at ${order.station?.code ?? "the station"} to link them to this order, then record what goes into each.`}
      />

      <div className="grid gap-2">
        <ScanInput onScan={scan} disabled={scanning} autoFocus />
        {scanMessage && (
          <p
            role="status"
            className={cn("text-sm", scanMessage.ok ? "text-emerald-400" : "text-red-400")}
          >
            {scanMessage.text}
          </p>
        )}
        {options.availableContainers.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-card-foreground">
              No scanner? Pick from {options.availableContainers.length} free containers
              at this station
            </summary>
            <ul className="mt-2 flex flex-wrap gap-2">
              {options.availableContainers.map((container) => (
                <li key={container.epc}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={scanning}
                    onClick={() => scan(container.epc)}
                  >
                    + {container.label}
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="mt-5">
        {order.containers.length === 0 ? (
          <EmptyState>No containers scanned yet.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Container</Th>
                {items.map((item) => (
                  <Th key={item.sku} className="text-right">
                    {item.sku}
                  </Th>
                ))}
                <Th />
              </tr>
            </thead>
            <tbody>
              {order.containers.map((container) => (
                <tr key={container.container_id}>
                  <Td>
                    <Link
                      href={`/assets/${container.container_id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {container.container_code}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {container.container_type}
                    </div>
                  </Td>
                  {items.map((item) => (
                    <Td key={item.sku} className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={item.ordered}
                        aria-label={`${item.sku} in ${container.container_code}`}
                        className="w-20 text-right"
                        value={quantities[container.container_id]?.[item.sku] ?? ""}
                        placeholder="0"
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [container.container_id]: {
                              ...current[container.container_id],
                              [item.sku]: event.target.value,
                            },
                          }))
                        }
                      />
                    </Td>
                  ))}
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${container.container_code}`}
                      className="text-red-400"
                      disabled={action.pending}
                      onClick={() =>
                        action.run({
                          action: "remove_container",
                          orderId,
                          containerId: container.container_id,
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="border-b-0 text-sm text-muted-foreground">
                  Packed / ordered
                </Td>
                {items.map((item) => {
                  const done = packed(item.sku);
                  return (
                    <Td
                      key={item.sku}
                      className={cn(
                        "border-b-0 text-right font-medium tabular-nums",
                        done === item.ordered ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {done} / {item.ordered}
                    </Td>
                  );
                })}
                <Td className="border-b-0" />
              </tr>
            </tbody>
          </Table>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        <FormError message={action.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={order.containers.length === 0}
            onClick={splitEvenly}
          >
            Split Evenly
          </Button>
          <Button
            disabled={action.pending || order.containers.length === 0 || !allPacked}
            title={
              allPacked
                ? undefined
                : "Pack exactly what was ordered and leave no container empty"
            }
            onClick={() =>
              action.run({
                action: "complete_packing",
                orderId,
                contents: order.containers.map((container) => ({
                  containerId: container.container_id,
                  lines: items.map((item) => ({
                    sku: item.sku,
                    qty: qty(container.container_id, item.sku),
                  })),
                })),
              })
            }
          >
            {action.pending ? "Working…" : "Complete Packing"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
