import "server-only";
import { backend } from "@/server/backend";

export type ExceptionRecord = {
  id: string;
  kind: string;
  severity: string;
  status: "OPEN" | "RESOLVED";
  reference_type: string;
  reference_id: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
};

// An empty status returns open and resolved exceptions together.
export const getExceptions = () => backend<ExceptionRecord[]>("/api/exceptions?status=");
