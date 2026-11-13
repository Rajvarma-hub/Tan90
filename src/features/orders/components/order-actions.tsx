"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { runOrderAction } from "@/features/orders/actions";
import type { OrderActionInput } from "@/features/orders/schemas";
import type { OrderActionOptions, OrderDetail } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";

type DialogName =
  | "approve"
  | "cancel"
  | "pack"
  | "dispatch"
  | "confirm"
  | "assign"
  | "inspect"
  | null;

const RECEIPT_STATES = ["RECEIVED", "MISSING", "DAMAGED"] as const;
const CONDITIONS = ["OK", "DAMAGED", "CONTAMINATED"] as const;

/** The next step for this order, with whatever input that step needs. */
export function OrderActions({
  order,
  options,
}: {
  order: OrderDetail;
  options: OrderActionOptions;
}) {
  const [dialog, setDialog] = useState<DialogName>(null);
  const { run, pending, error, clearError } = useServerAction(runOrderAction, () =>
    setDialog(null),
  );
  const orderId = order.id;

  // Dialog form state
  const [stationId, setStationId] = useState(order.station?.id ?? "");
  const [selectedEpcs, setSelectedEpcs] = useState<string[]>([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleRef, setVehicleRef] = useState("");
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [conditions, setConditions] = useState<Record<string, string>>({});

  function open(name: DialogName) {
    clearError();
    setDialog(name);
  }
  const close = () => setDialog(null);
  const act = (input: OrderActionInput) => run(input);

  const toInspect = order.containers.filter(
    (c) => c.status === "IN_TRANSIT_TO_STATION",
  );

  let hint: string;
  let buttons: ReactNode = null;

  switch (order.status) {
    case "PENDING_OPS_APPROVAL":
      hint = "Waiting for Ops to approve and assign a freezing station.";
      buttons = (
        <>
          <Button onClick={() => open("approve")}>Approve Order</Button>
          <Button variant="destructive" onClick={() => open("cancel")}>
            Cancel Order
          </Button>
        </>
      );
      break;
    case "APPROVED":
      hint = `Approved for ${order.station?.code ?? "the station"}. Start packing when the station is ready.`;
      buttons = (
        <>
          <Button
            disabled={pending}
            onClick={() => act({ action: "start_packing", orderId })}
          >
            Start Packing
          </Button>
          <Button variant="destructive" onClick={() => open("cancel")}>
            Cancel Order
          </Button>
        </>
      );
      break;
    case "PACKING":
      hint = "Packing in progress. Scan containers and complete the packing session.";
      buttons = <Button onClick={() => open("pack")}>Pack Containers</Button>;
      break;
    case "PACKED":
      hint = "Packed and ready. Assign a driver and vehicle to dispatch.";
      buttons = <Button onClick={() => open("dispatch")}>Dispatch Order</Button>;
      break;
    case "DISPATCHED":
      hint = "Loaded on the vehicle. Mark it departed when the driver leaves the station.";
      buttons = (
        <Button disabled={pending} onClick={() => act({ action: "depart", orderId })}>
          Mark Departed
        </Button>
      );
      break;
    case "IN_TRANSIT":
      hint = "On the way to the customer.";
      buttons = (
        <Button disabled={pending} onClick={() => act({ action: "arrive", orderId })}>
          Mark Arrived
        </Button>
      );
      break;
    case "ARRIVED":
      hint = "The driver has arrived at the customer site.";
      buttons = (
        <Button disabled={pending} onClick={() => act({ action: "deliver", orderId })}>
          Mark Delivered
        </Button>
      );
      break;
    case "DELIVERED":
      hint = "Delivered. Record what the customer received.";
      buttons = <Button onClick={() => open("confirm")}>Confirm Receipt</Button>;
      break;
    case "CUSTOMER_CONFIRMED":
    case "DISPUTED":
      hint =
        order.status === "DISPUTED"
          ? "The customer reported missing or damaged containers. Request a return for the containers they hold."
          : "Receipt confirmed. Request a return when the customer is done with the containers.";
      buttons = (
        <Button
          disabled={pending}
          onClick={() => act({ action: "request_return", orderId })}
        >
          Request Return
        </Button>
      );
      break;
    case "RETURN_REQUESTED":
      hint = order.return_driver
        ? `${order.return_driver.full_name} is assigned to collect the containers.`
        : "Return requested. Assign a driver for the pickup.";
      buttons = (
        <>
          {order.return_driver && (
            <Button
              disabled={pending}
              onClick={() => act({ action: "collect_return", orderId })}
            >
              Mark Collected
            </Button>
          )}
          <Button
            variant={order.return_driver ? "outline" : "primary"}
            onClick={() => open("assign")}
          >
            {order.return_driver ? "Change Driver" : "Assign Return Driver"}
          </Button>
        </>
      );
      break;
    case "RETURN_COLLECTED":
      hint = "Containers are on the way back to the station.";
      buttons = (
        <Button
          disabled={pending}
          onClick={() => act({ action: "receive_return", orderId })}
        >
          Receive at Station
        </Button>
      );
      break;
    case "RETURN_RECEIVED":
      hint =
        toInspect.length > 0
          ? "Containers are back. Inspect each one to close the order."
          : "Inspection found damaged or contaminated containers, so the order stays open for review.";
      buttons =
        toInspect.length > 0 ? (
          <Button onClick={() => open("inspect")}>Inspect &amp; Close</Button>
        ) : null;
      break;
    case "CLOSED":
      hint = "Order closed. All containers were inspected and returned to stock.";
      break;
    case "CANCELLED":
      hint = "This order was cancelled.";
      break;
  }

  const dialogFooter = (label: string, onSubmit?: () => void) => (
    <>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Back
        </Button>
        <Button
          type={onSubmit ? "button" : "submit"}
          disabled={pending}
          onClick={onSubmit}
        >
          {pending ? "Working…" : label}
        </Button>
      </div>
    </>
  );

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Next step
          </p>
          <p className="mt-0.5 text-sm text-card-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">{buttons}</div>
      </div>
      {!dialog && error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      <Dialog
        open={dialog === "approve"}
        onClose={close}
        title="Approve Order"
        description="Choose the freezing station that will pack and dispatch this order."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            act({ action: "approve", orderId, stationId });
          }}
        >
          <Field label="Freezing station">
            <Select
              required
              value={stationId}
              onChange={(event) => setStationId(event.target.value)}
            >
              <option value="">Select station</option>
              {options.stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.label}
                </option>
              ))}
            </Select>
          </Field>
          {dialogFooter("Approve")}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "cancel"}
        onClose={close}
        title="Cancel Order"
        description={`Cancel ${order.order_number}? This cannot be undone.`}
      >
        <div className="grid gap-4">
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              Keep Order
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => act({ action: "cancel", orderId })}
            >
              {pending ? "Cancelling…" : "Cancel Order"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "pack"}
        onClose={close}
        title="Pack Containers"
        description={`Pick the containers at ${order.station?.code ?? "the station"} to pack. The ordered panels are split evenly across them.`}
      >
        <div className="grid gap-4">
          {order.containers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Already scanned:{" "}
              {order.containers.map((c) => c.container_code).join(", ")}
            </p>
          )}
          {options.availableContainers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No more containers are available at this station.
            </p>
          ) : (
            <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2">
              {options.availableContainers.map((container) => (
                <li key={container.epc}>
                  <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={selectedEpcs.includes(container.epc)}
                      onChange={(event) =>
                        setSelectedEpcs((current) =>
                          event.target.checked
                            ? [...current, container.epc]
                            : current.filter((epc) => epc !== container.epc),
                        )
                      }
                    />
                    <span className="text-card-foreground">{container.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      …{container.epc.slice(-6)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {dialogFooter(
            `Pack ${selectedEpcs.length + order.containers.length} container(s)`,
            () => act({ action: "pack", orderId, epcs: selectedEpcs }),
          )}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "dispatch"}
        onClose={close}
        title="Dispatch Order"
        description={`${order.containers.length} packed container(s) will be loaded. Stock leaves ${order.station?.code ?? "the station"} on dispatch.`}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            act({ action: "dispatch", orderId, driverId, vehicleRef });
          }}
        >
          <Field label="Driver">
            <Select
              required
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">Select driver</option>
              {options.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle number">
            <Input
              required
              maxLength={64}
              placeholder="KA-01-AB-1234"
              value={vehicleRef}
              onChange={(event) => setVehicleRef(event.target.value)}
            />
          </Field>
          {dialogFooter("Dispatch")}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "confirm"}
        onClose={close}
        title="Confirm Receipt"
        description="Record what the customer received. Any missing or damaged container marks the order as disputed."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const idsIn = (state: string) =>
              order.containers
                .map((c) => c.container_id)
                .filter((containerId) => receipt[containerId] === state);
            act({
              action: "confirm_receipt",
              orderId,
              missing: idsIn("MISSING"),
              damaged: idsIn("DAMAGED"),
              notes: notes || null,
            });
          }}
        >
          <ul className="grid gap-2">
            {order.containers.map((container) => (
              <li
                key={container.container_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-card-foreground">
                  {container.container_code}
                  <span className="ml-2 text-muted-foreground">
                    {container.container_type}
                  </span>
                </span>
                <Select
                  className="w-36"
                  aria-label={`Receipt for ${container.container_code}`}
                  value={receipt[container.container_id] ?? "RECEIVED"}
                  onChange={(event) =>
                    setReceipt((current) => ({
                      ...current,
                      [container.container_id]: event.target.value,
                    }))
                  }
                >
                  {RECEIPT_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state.charAt(0) + state.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
          <Field label="Notes">
            <Input
              maxLength={1000}
              placeholder="Optional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          {dialogFooter("Confirm Receipt")}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "assign"}
        onClose={close}
        title="Assign Return Driver"
        description="Choose who collects the containers from the customer."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            act({ action: "assign_return_driver", orderId, driverId });
          }}
        >
          <Field label="Driver">
            <Select
              required
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">Select driver</option>
              {options.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.label}
                </option>
              ))}
            </Select>
          </Field>
          {dialogFooter("Assign Driver")}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "inspect"}
        onClose={close}
        title="Inspect Returned Containers"
        description="The order closes when every container passes. Damaged or contaminated containers keep it open."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            act({
              action: "inspect",
              orderId,
              results: toInspect.map((container) => ({
                containerId: container.container_id,
                condition: (conditions[container.container_id] ??
                  "OK") as (typeof CONDITIONS)[number],
              })),
            });
          }}
        >
          <ul className="grid gap-2">
            {toInspect.map((container) => (
              <li
                key={container.container_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-card-foreground">{container.container_code}</span>
                <Select
                  className="w-40"
                  aria-label={`Condition of ${container.container_code}`}
                  value={conditions[container.container_id] ?? "OK"}
                  onChange={(event) =>
                    setConditions((current) => ({
                      ...current,
                      [container.container_id]: event.target.value,
                    }))
                  }
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition === "OK"
                        ? "OK"
                        : condition.charAt(0) + condition.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
          {dialogFooter("Submit Inspection")}
        </form>
      </Dialog>
    </div>
  );
}
