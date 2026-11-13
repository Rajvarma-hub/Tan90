"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <title>Something went wrong</title>
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <Button onClick={() => retry()}>Try again</Button>
      </body>
    </html>
  );
}
