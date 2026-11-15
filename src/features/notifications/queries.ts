import "server-only";
import { unstable_rethrow } from "next/navigation";
import { backend } from "@/server/backend";
import type { AppNotification } from "@/features/notifications/types";

export function getNotifications(limit = 100) {
  return backend<AppNotification[]>(`/api/notifications?limit=${limit}`);
}

/** The bell must never take a page down, so a failure counts as nothing new. */
export async function getUnreadCount(): Promise<number> {
  try {
    return (await backend<{ count: number }>("/api/notifications/unread-count")).count;
  } catch (error) {
    unstable_rethrow(error); // a redirect to sign-in must still happen
    return 0;
  }
}
