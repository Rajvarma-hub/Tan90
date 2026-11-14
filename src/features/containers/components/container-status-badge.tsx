import { Badge } from "@/components/ui/badge";
import { containerStatusMeta } from "@/features/containers/status";
import { humanize } from "@/lib/format";

export function ContainerStatusBadge({ status }: { status: string }) {
  const meta = containerStatusMeta[status];
  return <Badge tone={meta?.tone ?? "gray"}>{meta?.label ?? humanize(status)}</Badge>;
}
