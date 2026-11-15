export type CsvCell = string | number | boolean | null | undefined;

// A spreadsheet runs a cell that starts with one of these as a formula, so mark it as text.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/** Saves a table as a CSV file. The byte order mark makes Excel read accented text correctly. */
export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const blob = new Blob(["\uFEFF", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
