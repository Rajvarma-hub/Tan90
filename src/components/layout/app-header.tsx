"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, PanelLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { breadcrumbsFor } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function AppHeader({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const crumbs = breadcrumbsFor(pathname);

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
                    {crumb.title}
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
        onClick={() => startRefresh(() => router.refresh())}
      >
        <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
      </Button>
    </header>
  );
}
