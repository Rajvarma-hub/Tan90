import type { Route } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))]">
      {children}
    </div>
  );
}

const statTones: Record<BadgeTone, { border: string; chip: string; value: string }> = {
  gray: { border: "border-border", chip: "bg-muted text-muted-foreground", value: "text-card-foreground" },
  blue: { border: "border-border", chip: "bg-primary/15 text-primary", value: "text-card-foreground" },
  green: { border: "border-border", chip: "bg-primary/15 text-primary", value: "text-card-foreground" },
  amber: {
    border: "border-amber-500/30",
    chip: "bg-amber-500/15 text-amber-400",
    value: "text-amber-400",
  },
  red: {
    border: "border-red-500/30",
    chip: "bg-red-500/15 text-red-400",
    value: "text-red-400",
  },
};

// Blue is the one accent. Amber and red are the only colours that change a card, and only for a number that needs attention.
// A link when `href` is given, a filter button when `onClick` is; `active` marks the selected filter.
export function Stat({
  label,
  value,
  icon: Icon,
  tone = "blue",
  active,
  href,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: BadgeTone;
  active?: boolean;
  href?: Route;
  onClick?: () => void;
}) {
  const style = statTones[tone];
  const className = cn(
    "flex items-center gap-3.5 rounded-xl border bg-card p-4 text-left",
    active ? "border-primary ring-1 ring-primary" : style.border,
    (onClick || href) && "transition-colors hover:bg-accent",
  );
  const content = (
    <>
      <span
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", style.chip)}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("mt-0.5 block text-2xl font-semibold tabular-nums", style.value)}>
          {value}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
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
