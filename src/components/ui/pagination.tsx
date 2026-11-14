"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 10;

export function Pagination({
  page,
  pageCount,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        Showing {from}–{to} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft /> Previous
        </Button>
        <span>
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
