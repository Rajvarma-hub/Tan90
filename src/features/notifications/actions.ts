"use server";

import { z } from "zod";
import { createAction } from "@/server/action";
import { backend } from "@/server/backend";
import { getNotifications } from "@/features/notifications/queries";

export const loadRecentNotifications = createAction(z.object({}), () => getNotifications(8));

export const loadUnreadCount = createAction(z.object({}), async () =>
  (await backend<{ count: number }>("/api/notifications/unread-count")).count,
);

export const markNotificationRead = createAction(
  z.object({ id: z.string().min(1).max(64) }),
  async ({ id }) => {
    await backend(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
    return null;
  },
);

export const markAllNotificationsRead = createAction(z.object({}), async () => {
  await backend("/api/notifications/read-all", { method: "POST" });
  return null;
});
