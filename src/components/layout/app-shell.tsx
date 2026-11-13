"use client";

import { Suspense, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleSidebar() {
    if (window.matchMedia("(min-width: 48rem)").matches) {
      setCollapsed((value) => !value);
    } else {
      setMobileOpen((open) => !open);
    }
  }

  return (
    <>
      {/* Sidebar and header read the pathname, which is only known at request time on dynamic routes. */}
      <Suspense fallback={null}>
        <AppSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />
      </Suspense>
      {mobileOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={cn(
          "flex min-h-dvh flex-1 flex-col transition-[padding] duration-200 ease-linear print:pl-0",
          collapsed ? "md:pl-12" : "md:pl-64",
        )}
      >
        <Suspense fallback={<div className="h-16 shrink-0 border-b" />}>
          <AppHeader onToggleSidebar={toggleSidebar} />
        </Suspense>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </>
  );
}
