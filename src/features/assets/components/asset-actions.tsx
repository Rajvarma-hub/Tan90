"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { TagInput } from "@/components/ui/scan-input";
import {
  editContainer,
  restoreContainer,
  unregisterContainer,
} from "@/features/containers/actions";
import { EDITABLE_STATUSES } from "@/features/assets/health";
import type { Asset, AssetStation } from "@/features/assets/queries";
import type { ContainerType } from "@/features/containers/types";
import { useServerAction } from "@/hooks/use-server-action";

type Props = { asset: Asset; types: ContainerType[]; stations: AssetStation[] };

// The tag is typed or scanned straight into the field, so it counts without pressing Enter.
function TagField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <TagInput value={value} onChange={onChange} />
    </Field>
  );
}

function EditDialog({ asset, types, stations }: Props) {
  const editable = EDITABLE_STATUSES.includes(asset.status);
  const currentType = types.find((type) => type.name === asset.container_type)?.code ?? "";
  const [open, setOpen] = useState(false);
  const [newEpc, setNewEpc] = useState("");
  const [typeCode, setTypeCode] = useState(currentType);
  const [locationId, setLocationId] = useState(asset.current_location_id ?? "");
  const [reason, setReason] = useState("");
  const { run, pending, error, clearError } = useServerAction(editContainer, () =>
    setOpen(false),
  );

  const typeChanged = typeCode !== currentType;
  const locationChanged = locationId !== (asset.current_location_id ?? "");
  const changed = Boolean(newEpc) || typeChanged || locationChanged;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-24"
        onClick={() => {
          clearError();
          setNewEpc("");
          setTypeCode(currentType);
          setLocationId(asset.current_location_id ?? "");
          setReason("");
          setOpen(true);
        }}
      >
        Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit ${asset.container_code}`}
        description="Assign a different RFID tag, correct the container type, or move it to another location."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({
              containerId: asset.id,
              newEpc: newEpc || null,
              typeCode: typeChanged ? typeCode : null,
              locationId: locationChanged ? locationId : null,
              reason: reason || null,
            });
          }}
        >
          <Field label="Current tag">
            <Input
              readOnly
              className="font-mono"
              value={asset.epc ?? "No tag assigned"}
            />
          </Field>
          <TagField
            label={asset.epc ? "New tag ID" : "Tag ID"}
            hint={
              asset.epc
                ? "Scan a new tag to replace the current one. The old tag stops working."
                : "Scan a tag to assign it to this container."
            }
            value={newEpc}
            onChange={setNewEpc}
          />
          {newEpc && asset.epc && (
            <Field label="Reason for the new tag">
              <Input
                maxLength={200}
                placeholder="Optional, e.g. tag damaged"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Container type">
              <Select
                disabled={!editable}
                value={typeCode}
                onChange={(event) => setTypeCode(event.target.value)}
              >
                {types.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Select
                disabled={!editable}
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!editable && (
            <p className="text-xs text-muted-foreground">
              Type and location can be changed once the container is back in stock. Its tag can
              be replaced any time.
            </p>
          )}
          <FormError message={error} />
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" disabled={pending || !changed}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function UnregisterDialog({ asset }: { asset: Asset }) {
  const allowed = EDITABLE_STATUSES.includes(asset.status);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error, clearError } = useServerAction(unregisterContainer, () =>
    setOpen(false),
  );

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        className="w-24"
        disabled={!allowed}
        title={allowed ? undefined : "On an order. Unregister it once it is back in stock."}
        onClick={() => {
          clearError();
          setReason("");
          setOpen(true);
        }}
      >
        Unregister
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Unregister ${asset.container_code}`}
        description="The container leaves circulation and its tag stops working. It stays in the registry as Unregistered and can be restored with a new tag."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({ containerId: asset.id, reason: reason || null });
          }}
        >
          <Field label="Reason">
            <Input
              maxLength={200}
              placeholder="Optional, e.g. beyond repair"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <FormError message={error} />
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Unregistering…" : "Unregister"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function RestoreDialog({ asset, stations }: Pick<Props, "asset" | "stations">) {
  const [open, setOpen] = useState(false);
  const [epc, setEpc] = useState("");
  const [locationId, setLocationId] = useState(asset.current_location_id ?? "");
  const { run, pending, error, clearError } = useServerAction(restoreContainer, () =>
    setOpen(false),
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-24"
        onClick={() => {
          clearError();
          setEpc("");
          setLocationId(asset.current_location_id ?? "");
          setOpen(true);
        }}
      >
        Restore
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Restore ${asset.container_code}`}
        description="Bring this container back into stock under a new tag."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({
              containerId: asset.id,
              epc,
              locationId: locationId !== asset.current_location_id ? locationId : null,
            });
          }}
        >
          <TagField label="New tag ID" hint="Scan the tag to link." value={epc} onChange={setEpc} />
          <Field label="Location">
            <Select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.code}
                </option>
              ))}
            </Select>
          </Field>
          <FormError message={error} />
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" disabled={pending || !epc}>
              {pending ? "Restoring…" : "Restore"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export function AssetActions({ asset, types, stations }: Props) {
  if (asset.status === "RETIRED") {
    return <RestoreDialog asset={asset} stations={stations} />;
  }
  return (
    <div className="flex items-center justify-center gap-2">
      <EditDialog asset={asset} types={types} stations={stations} />
      <UnregisterDialog asset={asset} />
    </div>
  );
}
