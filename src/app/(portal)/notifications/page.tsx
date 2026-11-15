import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { NotificationInbox } from "@/features/notifications/components/notification-inbox";
import { getNotifications } from "@/features/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

async function Inbox() {
  return <NotificationInbox notifications={await getNotifications()} />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Inbox />
    </Suspense>
  );
}
