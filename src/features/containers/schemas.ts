import { z } from "zod";

export const registerContainerSchema = z.object({
  epc: z.string().trim().min(4).max(64),
  typeCode: z.string().min(3).max(16),
  locationId: z.string().min(1).max(64),
});

export const replaceTagSchema = z.object({
  containerId: z.string().min(1).max(64),
  newEpc: z.string().trim().min(4).max(64),
  reason: z.string().trim().max(200).nullable(),
});

export const lookupSchema = z.object({ code: z.string().trim().min(1).max(64) });
