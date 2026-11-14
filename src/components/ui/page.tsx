import type { Route } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CrumbLabel } from "@/components/layout/breadcrumb-label";
import { cn } from "@/lib/utils";

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  badge,
  back,
  actions,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  back?: { href: Route; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {back && <CrumbLabel label={title} />}
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
      {children}
    </div>
  );
}

// Clickable when `onClick` is given; `active` marks the selected filter.
export function Stat({
  label,
  value,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  active?: boolean;
  // Colours the number so a stat that needs attention stands out.
  tone?: "red" | "amber" | "green";
  onClick?: () => void;
}) {
  const className = cn(
    "flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center",
    onClick && "transition-colors hover:bg-accent",
    active && "border-primary ring-1 ring-primary",
  );
  const content = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold text-card-foreground",
          tone === "red" && "text-red-400",
          tone === "amber" && "text-amber-400",
          tone === "green" && "text-emerald-400",
        )}
      >
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" aria-pressed={active} onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}
