// Suspense fallback shown while a portal page loads: same header, stat row and card as every page.
export function PageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-16 animate-pulse rounded-xl bg-card/60" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}
