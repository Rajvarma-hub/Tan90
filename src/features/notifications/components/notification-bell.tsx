"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadRecentNotifications,
  loadUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import { NotificationContent } from "@/features/notifications/components/notification-content";
import {
  NOTIFICATIONS_CHANGED,
  announceNotificationsChanged,
  notificationHref,
  type AppNotification,
} from "@/features/notifications/types";

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(initialCount);
  const [seenInitial, setSeenInitial] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  // The server sends a fresh count whenever the page data is refreshed.
  if (seenInitial !== initialCount) {
    setSeenInitial(initialCount);
    setCount(initialCount);
  }

  // Layouts are not fetched again when someone moves between pages, so ask for the count here:
  // on every page change, and when another part of the portal marks notifications read.
  useEffect(() => {
    let current = true;
    const refresh = () =>
      void loadUnreadCount({}).then((result) => {
        if (current && result.ok) setCount(result.data);
      });
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      current = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setFailed(false);
    startTransition(async () => {
      const [recent, unread] = await Promise.all([loadRecentNotifications({}), loadUnreadCount({})]);
      if (recent.ok) setItems(recent.data);
      else setFailed(true);
      if (unread.ok) setCount(unread.data);
    });
  }

  function read(notification: AppNotification) {
    setOpen(false);
    if (notification.read_at) return;
    setCount((value) => Math.max(0, value - 1));
    void markNotificationRead({ id: notification.id }).then(() => {
      router.refresh();
      announceNotificationsChanged();
    });
  }

  function readAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead({});
      if (!result.ok) return;
      setCount(0);
      setItems((current) =>
        current?.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })) ?? null,
      );
      router.refresh();
      announceNotificationsChanged();
    });
  }

  return (
    <div ref={root} className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
        className="relative"
      >
        <Bell />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-full right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold text-card-foreground">Notifications</h2>
            <Button variant="ghost" size="sm" disabled={pending || count === 0} onClick={readAll}>
              Mark all read
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {failed ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Could not load notifications.
              </p>
            ) : items === null ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((item) => {
                  const href = notificationHref(item);
                  const rowClass =
                    "block w-full px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";
                  return (
                    <li key={item.id}>
                      {href ? (
                        <Link href={href as Route} onClick={() => read(item)} className={rowClass}>
                          <NotificationContent notification={item} />
                        </Link>
                      ) : (
                        <button type="button" onClick={() => read(item)} className={rowClass}>
                          <NotificationContent notification={item} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border/60 px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm text-primary hover:underline"
            >
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
