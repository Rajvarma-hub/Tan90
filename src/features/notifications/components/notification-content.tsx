import type { AppNotification } from "@/features/notifications/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One notification: unread dot, what happened, and when. Wrap it in a link or button to make it act. */
export function NotificationContent({ notification }: { notification: AppNotification }) {
  const unread = !notification.read_at;
  return (
    <span className="flex items-start gap-3">
      <span
        aria-label={unread ? "Unread" : undefined}
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm",
            unread ? "font-medium text-card-foreground" : "text-muted-foreground",
          )}
        >
          {notification.title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{notification.body}</span>
        <span className="mt-1 block text-xs text-muted-foreground/80">
          {formatDateTime(notification.created_at)}
        </span>
      </span>
    </span>
  );
}
