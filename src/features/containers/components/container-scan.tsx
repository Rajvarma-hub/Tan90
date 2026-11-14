"use client";

import { useRouter } from "next/navigation";
import { ScanInput } from "@/components/ui/scan-input";
import { lookupContainer } from "@/features/containers/actions";
import { useServerAction } from "@/hooks/use-server-action";

// Scan a tag or barcode to jump straight to that container.
export function ContainerScan({ className }: { className?: string }) {
  const router = useRouter();
  const lookup = useServerAction(lookupContainer, (container) =>
    router.push(`/assets/${container.id}`),
  );

  return (
    <div className={className}>
      <ScanInput
        placeholder="Scan another container"
        disabled={lookup.pending}
        onScan={(code) => lookup.run({ code })}
      />
      {lookup.error && (
        <p role="alert" className="mt-1 text-sm text-red-400">
          {lookup.error}
        </p>
      )}
    </div>
  );
}
