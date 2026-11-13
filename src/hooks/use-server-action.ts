"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

// Runs a Server Action, tracks pending/error state and refreshes the page data on success.
export function useServerAction<TInput, TOutput>(
  action: (input: TInput) => Promise<ActionResult<TOutput>>,
  onSuccess?: (data: TOutput) => void,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(input: TInput) {
    setError(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onSuccess?.(result.data);
      router.refresh();
    });
  }

  return { run, pending, error, clearError: () => setError(null) };
}
