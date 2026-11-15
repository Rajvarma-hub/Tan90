"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { NotificationContent } from "@/features/notifications/components/notification-content";
import {
  announceNotificationsChanged,
  notificationHref,
  type AppNotification,
} from "@/features/notifications/types";
import { useServerAction } from "@/hooks/use-server-action";

export function NotificationInbox({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const markAll = useServerAction(markAllNotificationsRead, announceNotificationsChanged);

  const unread = notifications.filter((item) => !item.read_at).length;
  const shown = unreadOnly ? notifications.filter((item) => !item.read_at) : notifications;
  const { rows, page: currentPage, pageCount } = paginate(shown, page);

  function open(item: AppNotification) {
    void markNotificationRead({ id: item.id }).then(() => {
      router.refresh();
      announceNotificationsChanged();
    });
  }

  const rowClass =
    "block w-full px-5 py-4 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";

  return (
    <Page>
      <PageHeader
        title="Notifications"
        description="Updates about your orders and deliveries, newest first."
        actions={
          <Button
            variant="outline"
            disabled={markAll.pending || unread === 0}
            onClick={() => markAll.run({})}
          >
            Mark all read
          </Button>
        }
      />
      <Card>
        <CardHeader
          title="Inbox"
          description={`${unread} unread of ${notifications.length}`}
          actions={
            <Button
              variant={unreadOnly ? "primary" : "outline"}
              size="sm"
              aria-pressed={unreadOnly}
              onClick={() => {
                setUnreadOnly((value) => !value);
                setPage(1);
              }}
            >
              Unread only
            </Button>
          }
        />
        {rows.length === 0 ? (
          <EmptyState>{unreadOnly ? "You are all caught up." : "Nothing yet."}</EmptyState>
        ) : (
          <ul className="-mx-5 divide-y divide-border/60 sm:-mx-6">
            {rows.map((item) => {
              const href = notificationHref(item);
              return (
                <li key={item.id}>
                  {href ? (
                    <Link href={href as Route} onClick={() => open(item)} className={rowClass}>
                      <NotificationContent notification={item} />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => open(item)} className={rowClass}>
                      <NotificationContent notification={item} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={shown.length}
          noun={shown.length === 1 ? "notification" : "notifications"}
          onPage={setPage}
        />
      </Card>
    </Page>
  );
}
