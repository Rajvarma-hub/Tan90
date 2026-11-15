"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { announceNotificationsChanged } from "@/features/notifications/types";

const REFRESH_EVERY_MS = 30_000;

/**
 * Keeps the page and the bell current without anyone pressing Refresh. It waits while the tab is
 * hidden, while a dialog is open and while someone is typing, so it never gets in the way.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const focused = document.activeElement?.tagName;
      if (focused === "INPUT" || focused === "TEXTAREA" || focused === "SELECT") return;
      router.refresh();
      announceNotificationsChanged();
    }, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
