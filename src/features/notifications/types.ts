export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  reference_type: string | null;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** Tells the bell to look again after something marked notifications read. */
export const NOTIFICATIONS_CHANGED = "tan90:notifications-changed";

export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

/** Where a notification leads, or null when it is only information. */
export function notificationHref(
  notification: Pick<AppNotification, "reference_type" | "reference_id">,
): string | null {
  if (notification.reference_type === "order" && notification.reference_id) {
    return `/orders/${encodeURIComponent(notification.reference_id)}`;
  }
  return null;
}
