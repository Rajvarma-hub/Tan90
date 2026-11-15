"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, CircleUser, LogOut, PanelLeft, RefreshCw } from "lucide-react";
import { useUser } from "@/components/auth/user-context";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-label";
import { Button } from "@/components/ui/button";
import { breadcrumbsFor } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { signOut } from "@/features/auth/actions";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { announceNotificationsChanged } from "@/features/notifications/types";
import { roleLabels } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function AppHeader({
  onToggleSidebar,
  unreadCount,
}: {
  onToggleSidebar: () => void;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [refreshing, startRefresh] = useTransition();
  const detailLabel = useBreadcrumbLabel();
  const baseCrumbs = breadcrumbsFor(pathname, useSearchParams().get("view"));
  // A detail page under a sub-section (a station) has no path segment of its own.
  const crumbs =
    detailLabel && !baseCrumbs.at(-1)?.dynamic
      ? [...baseCrumbs, { title: detailLabel, href: `${pathname}#${detailLabel}`, dynamic: false }]
      : baseCrumbs;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 print:hidden">
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
        className="-ml-1 inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        <PanelLeft className="size-4" />
      </button>
      <div aria-hidden className="mr-2 w-px self-stretch bg-border" />
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              {siteConfig.shortName}
            </Link>
          </li>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5 sm:gap-2.5">
                <ChevronRight aria-hidden className="size-3.5" />
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {crumb.dynamic ? (detailLabel ?? crumb.title.toUpperCase()) : crumb.title}
                  </span>
                ) : (
                  <Link
                    href={crumb.href as Route}
                    className="transition-colors hover:text-foreground"
                  >
                    {crumb.title}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <Button
        variant="outline"
        size="sm"
        disabled={refreshing}
        onClick={() =>
          startRefresh(() => {
            router.refresh();
            // The bell count comes from the layout, which a refresh does not reliably reload.
            announceNotificationsChanged();
          })
        }
      >
        <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
      </Button>
      <NotificationBell initialCount={unreadCount} />
      <div aria-hidden className="mx-1 w-px self-stretch bg-border" />
      <Link
        href="/account"
        className="hidden min-w-0 rounded-md px-2 py-1 text-right text-xs leading-tight transition-colors hover:bg-accent sm:block"
        aria-label="Your account"
      >
        <p className="truncate font-medium text-foreground">{user.fullName}</p>
        <p className="truncate text-muted-foreground">{roleLabels[user.role]}</p>
      </Link>
      <Link
        href="/account"
        aria-label="Your account"
        className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent sm:hidden"
      >
        <CircleUser className="size-4" />
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm" aria-label="Sign out">
          <LogOut /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      </form>
    </header>
  );
}
