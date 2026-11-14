"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createOrder } from "@/features/orders/actions";
import type { OrderFormOptions } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";

type Line = { key: number; productId: string; quantity: string };

export function NewOrderDialog({ options }: { options: OrderFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [stationId, setStationId] = useState("");
  const [destination, setDestination] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { key: 0, productId: "", quantity: "1" },
  ]);

  const { run, pending, error, clearError } = useServerAction(
    createOrder,
    (order) => {
      setOpen(false);
      router.push(`/orders/${order.id}`);
    },
  );

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    run({
      customerId,
      stationId: stationId || null,
      destination: destination || null,
      expectedDeliveryAt: expectedDeliveryAt || null,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
      })),
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setOpen(true);
        }}
      >
        <Plus /> New Order
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New Order"
        description="Place an order on behalf of a customer. It goes to Ops for approval."
        wide
      >
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <Select
                required
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Select customer</option>
                {options.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Freezing station" hint="Optional. Ops assigns it on approval.">
              <Select
                value={stationId}
                onChange={(event) => setStationId(event.target.value)}
              >
                <option value="">Not assigned</option>
                {options.stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deliver to">
              <Input
                value={destination}
                maxLength={500}
                placeholder="Warehouse or dark store"
                onChange={(event) => setDestination(event.target.value)}
              />
            </Field>
            <Field label="Expected delivery">
              <Input
                type="datetime-local"
                value={expectedDeliveryAt}
                onChange={(event) => setExpectedDeliveryAt(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-card-foreground">Items</span>
            {lines.map((line) => (
              <div key={line.key} className="flex gap-2">
                <Select
                  required
                  className="flex-1"
                  aria-label="Asset"
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(line.key, { productId: event.target.value })
                  }
                >
                  <option value="">Select asset</option>
                  {options.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.label}
                    </option>
                  ))}
                </Select>
                <Input
                  required
                  type="number"
                  min={1}
                  max={10000}
                  aria-label="Quantity"
                  className="w-28"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.key, { quantity: event.target.value })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove item"
                  className="mt-0.5 text-red-400"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.key !== line.key),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    key: Math.max(...current.map((line) => line.key)) + 1,
                    productId: "",
                    quantity: "1",
                  },
                ])
              }
            >
              <Plus /> Add item
            </Button>
          </div>

          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Order"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
