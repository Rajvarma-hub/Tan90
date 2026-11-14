"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Select } from "@/components/ui/form";
import { TagInput } from "@/components/ui/scan-input";
import { registerContainer } from "@/features/containers/actions";
import type { ContainerType } from "@/features/containers/types";
import type { Option } from "@/features/orders/types";
import { useServerAction } from "@/hooks/use-server-action";

export function RegisterDialog({
  types,
  stations,
}: {
  types: ContainerType[];
  stations: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [epc, setEpc] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [locationId, setLocationId] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const { run, pending, error, clearError } = useServerAction(
    registerContainer,
    (container) => {
      // Stay open so several containers can be registered in a row.
      setCreated(container.code);
      setEpc("");
    },
  );

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setCreated(null);
          setOpen(true);
        }}
      >
        <Plus /> Register Container
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Register Container"
        description="Scan the new container's tag, then pick its type and where it is. The container code is generated."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setCreated(null);
            run({ epc, typeCode, locationId });
          }}
        >
          <Field label="Tag ID">
            <TagInput value={epc} onChange={setEpc} autoFocus />
          </Field>
          <Field label="Container type">
            <Select
              required
              value={typeCode}
              onChange={(event) => setTypeCode(event.target.value)}
            >
              <option value="">Select type</option>
              {types.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <Select
              required
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Select location</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.label}
                </option>
              ))}
            </Select>
          </Field>
          {created && (
            <p role="status" className="text-sm text-emerald-400">
              Registered {created}. Scan the next tag to add another.
            </p>
          )}
          <FormError message={error} />
          <DialogActions onCancel={() => setOpen(false)} cancelLabel="Done">
            <Button type="submit" disabled={pending || !epc}>
              {pending ? "Registering…" : "Register"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
