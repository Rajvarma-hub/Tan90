"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { ScanInput } from "@/components/ui/scan-input";
import { replaceTag } from "@/features/containers/actions";
import { useServerAction } from "@/hooks/use-server-action";

export function ReplaceTagDialog({ containerId }: { containerId: string }) {
  const [open, setOpen] = useState(false);
  const [newEpc, setNewEpc] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, error, clearError } = useServerAction(replaceTag, () => {
    setOpen(false);
    setNewEpc("");
    setReason("");
  });

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          clearError();
          setOpen(true);
        }}
      >
        Replace Tag
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Replace Tag"
        description="Use this when a tag is damaged. The old tag stops working and the new one is linked to this container."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({ containerId, newEpc, reason: reason || null });
          }}
        >
          <Field label="New tag ID">
            {newEpc ? (
              <div className="flex items-center gap-2">
                <Input readOnly className="flex-1 font-mono" value={newEpc} />
                <Button variant="outline" onClick={() => setNewEpc("")}>
                  Rescan
                </Button>
              </div>
            ) : (
              <ScanInput onScan={setNewEpc} autoFocus />
            )}
          </Field>
          <Field label="Reason">
            <Input
              maxLength={200}
              placeholder="Optional"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !newEpc}>
              {pending ? "Saving…" : "Replace Tag"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
