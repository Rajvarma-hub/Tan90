"use server";

import { recordLocationSchema } from "@/features/deliveries/location";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";

export const recordLocation = createAction(recordLocationSchema, async (input) => {
  await backend(`/api/deliveries/${encodeURIComponent(input.taskId)}/gps`, {
    method: "POST",
    body: {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_m: input.accuracyM,
    },
  });
  return null;
});
