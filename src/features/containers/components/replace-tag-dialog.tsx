"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Input } from "@/components/ui/form";
import { TagInput } from "@/components/ui/scan-input";
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
            <TagInput value={newEpc} onChange={setNewEpc} autoFocus />
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
          <DialogActions onCancel={() => setOpen(false)}>
            <Button type="submit" disabled={pending || !newEpc}>
              {pending ? "Saving…" : "Replace Tag"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
