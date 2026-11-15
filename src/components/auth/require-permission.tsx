import type { ReactNode } from "react";
import { Page, PageHeader } from "@/components/ui/page";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/server/session";

export async function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  if (await hasPermission(permission)) return children;
  return (
    <Page>
      <PageHeader
        title="No access"
        description="Your role does not include this page. Ask an administrator if you need it."
      />
    </Page>
  );
}
