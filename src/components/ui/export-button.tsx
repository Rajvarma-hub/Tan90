"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, type CsvCell } from "@/lib/csv";

/** Downloads what the table is showing right now, after any search and filters. */
export function ExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
}) {
  return (
    <Button
      variant="outline"
      disabled={rows.length === 0}
      onClick={() => {
        const day = new Date().toISOString().slice(0, 10);
        downloadCsv(`${filename}-${day}.csv`, headers, rows);
      }}
    >
      <Download /> Export CSV
    </Button>
  );
}
