import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

// The negative margins let the divider run edge to edge inside the card padding.
export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="-mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 pb-4 sm:-mx-6 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Label/value pair used in the detail cards.
export function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm break-words text-card-foreground">{children}</dd>
    </div>
  );
}

export function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{children}</dl>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function ItemGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{children}</ul>;
}

/**
 * The one card shape used for stations, deliveries and section links:
 * icon + title + badge, a free body, an optional three-column stat row, an optional footer.
 */
export function ItemCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  stats,
  footer,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  stats?: { label: string; value: ReactNode }[];
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="min-w-0">
      <article className="flex h-full flex-col rounded-xl border bg-background/40">
        <header className="flex items-start gap-3 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-card-foreground">{title}</h3>
            {subtitle && (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {badge}
        </header>
        <div className="flex-1 px-5 pb-5 text-sm text-muted-foreground">{children}</div>
        {stats && (
          <dl className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 text-center">
            {stats.map(({ label, value }) => (
              <div key={label} className="min-w-0 px-3 py-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 truncate text-base font-semibold text-card-foreground tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {footer && <footer className="border-t border-border/60 p-4">{footer}</footer>}
      </article>
    </li>
  );
}
