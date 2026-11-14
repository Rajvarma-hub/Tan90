// details is a small JSON blob such as {"container_id": "con-000004"} or {"epc": "..."}.
export function parseDetails(details: string | null): { containerId?: string; epc?: string } {
  try {
    const parsed = JSON.parse(details ?? "{}") as { container_id?: string; epc?: string };
    return { containerId: parsed.container_id, epc: parsed.epc };
  } catch {
    return {};
  }
}

const titles: Record<string, string> = {
  UNKNOWN_EPC: "Unknown scan",
  MISSING_ON_DELIVERY: "Missing on delivery",
  DAMAGED_ON_DELIVERY: "Damaged on delivery",
  MISSING_AT_STATION: "Missing at station",
};

export const exceptionTitle = (kind: string) =>
  titles[kind] ?? kind.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

// One plain sentence under each issue so the table explains itself.
const explanations: Record<string, string> = {
  UNKNOWN_EPC: "A scanned tag is not linked to any container.",
  MISSING_ON_DELIVERY: "The customer reported this container missing at delivery.",
  DAMAGED_ON_DELIVERY: "The customer reported this container damaged at delivery.",
  MISSING_AT_STATION: "Not found during a stock check at the station.",
};

export const exceptionExplanation = (kind: string) => explanations[kind] ?? "";
