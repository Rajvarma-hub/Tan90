"use server";

import { z } from "zod";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";

export const resolveException = createAction(
  z.object({ id: z.string().min(1).max(64) }),
  async ({ id }) => {
    await backend(`/api/exceptions/${encodeURIComponent(id)}/resolve`, { method: "POST" });
    return null;
  },
);
