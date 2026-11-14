// Suspense fallback shown while a portal page loads its data from the backend.
export function PageSkeleton() {
  return (
    <div className="p-4" aria-busy="true" aria-label="Loading">
      <div className="h-64 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}
