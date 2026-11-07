"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeft } from "lucide-react";
import { isActivePath, mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

export function AppHeader({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const current = mainNav.find((item) => isActivePath(pathname, item.href));

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
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              {siteConfig.shortName}
            </Link>
          </li>
          {current && (
            <>
              <li aria-hidden>
                <ChevronRight className="size-3.5" />
              </li>
              <li aria-current="page" className="text-foreground">
                {current.title}
              </li>
            </>
          )}
        </ol>
      </nav>
    </header>
  );
}
