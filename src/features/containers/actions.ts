"use server";

import {
  editContainerSchema,
  lookupSchema,
  registerContainerSchema,
  replaceTagSchema,
  restoreContainerSchema,
  unregisterContainerSchema,
} from "@/features/containers/schemas";
import type { Container } from "@/features/containers/types";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";

export const registerContainer = createAction(registerContainerSchema, async (input) => {
  const container = await backend<Container>("/api/containers", {
    method: "POST",
    body: {
      epc: input.epc,
      container_type_code: input.typeCode,
      location_id: input.locationId,
    },
  });
  return { id: container.id, code: container.container_code };
});

export const replaceTag = createAction(replaceTagSchema, async (input) => {
  await backend(`/api/containers/${encodeURIComponent(input.containerId)}/replace-tag`, {
    method: "POST",
    body: { new_epc: input.newEpc, reason: input.reason },
  });
  return null;
});

/** Resolve a scanned tag ID or barcode label to a container id. */
export const lookupContainer = createAction(lookupSchema, async ({ code }) => {
  const container = await backend<Container>(
    `/api/containers/lookup?code=${encodeURIComponent(code)}`,
  );
  return { id: container.id };
});

const containerPath = (id: string) => `/api/containers/${encodeURIComponent(id)}`;

/** Assign a new tag and/or fix the type or location in one step. Null fields stay as they are. */
export const editContainer = createAction(editContainerSchema, async (input) => {
  if (input.newEpc) {
    await backend(`${containerPath(input.containerId)}/replace-tag`, {
      method: "POST",
      body: { new_epc: input.newEpc, reason: input.reason },
    });
  }
  if (input.typeCode || input.locationId) {
    await backend(containerPath(input.containerId), {
      method: "PATCH",
      body: { container_type_code: input.typeCode, location_id: input.locationId },
    });
  }
  return null;
});

export const unregisterContainer = createAction(unregisterContainerSchema, async (input) => {
  await backend(`${containerPath(input.containerId)}/unregister`, {
    method: "POST",
    body: { reason: input.reason },
  });
  return null;
});

export const restoreContainer = createAction(restoreContainerSchema, async (input) => {
  await backend(`${containerPath(input.containerId)}/restore`, {
    method: "POST",
    body: { epc: input.epc, location_id: input.locationId },
  });
  return null;
});
