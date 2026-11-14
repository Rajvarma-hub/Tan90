"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

// `collapsed` only applies from the md breakpoint; mobile always shows the full sidebar as an overlay.
export function AppSidebar({
  collapsed,
  mobileOpen,
  onNavigate,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[translate,visibility,width] duration-200 ease-linear md:visible md:translate-x-0 print:hidden",
        mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full",
        collapsed && "md:w-12",
      )}
    >
      <div className="flex shrink-0 flex-col gap-2 p-2">
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            "flex flex-col items-center gap-2 rounded-md px-2 py-3 text-center transition-colors hover:bg-sidebar-accent",
            collapsed && "md:p-0",
          )}
        >
          <Image
            src="/brand/tan90-logo-white.png"
            alt="Tan90"
            width={248}
            height={320}
            loading="eager"
            className={cn("h-auto w-[43px]", collapsed && "md:hidden")}
          />
          <Image
            src="/brand/favicon-dark.png"
            alt="Tan90"
            width={64}
            height={64}
            loading="eager"
            className={cn("hidden size-full", collapsed && "md:block")}
          />
          <div
            className={cn(
              "grid w-full text-sm leading-tight",
              collapsed && "md:hidden",
            )}
          >
            <span className="truncate font-semibold">{siteConfig.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {siteConfig.tagline}
            </span>
          </div>
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-x-hidden overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {mainNav.map(({ title, href, icon: Icon, children }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={collapsed ? title : undefined}
                  aria-current={pathname === href ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md p-2 text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    collapsed && "md:w-8",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "md:sr-only")}>
                    {title}
                  </span>
                </Link>
                {children && active && (
                  <ul
                    className={cn(
                      "mt-1 ml-3.5 flex flex-col gap-1 border-l pl-2.5",
                      collapsed && "md:hidden",
                    )}
                  >
                    {children.map((child) => {
                      const childActive = isActivePath(pathname, child.href);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onNavigate}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "flex h-7 items-center rounded-md px-2 text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                              childActive &&
                                "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                            )}
                          >
                            <span className="truncate">{child.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
