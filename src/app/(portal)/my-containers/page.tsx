import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Cell, Table, Td, Th } from "@/components/ui/table";
import { ContainerStatusBadge } from "@/features/containers/components/container-status-badge";
import { getMyContainers } from "@/features/containers/queries";

export const metadata: Metadata = { title: "My containers" };

async function MyContainers() {
  const containers = await getMyContainers();
  return (
    <Page>
      <PageHeader
        title="My containers"
        description="Containers currently with you. Request their return from the order they came on."
      />
      <Card>
        <CardHeader title="With you" description={`${containers.length} in your custody`} />
        {containers.length === 0 ? (
          <EmptyState>No containers with you right now.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Container</Th>
                <Th className="text-center">Type</Th>
                <Th>Order</Th>
                <Th className="text-center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <tr key={container.id}>
                  <Td>
                    <Cell main={container.container_code}>
                      <span className="font-mono">{container.epc ?? "No tag"}</span>
                    </Cell>
                  </Td>
                  <Td className="text-center">{container.container_type}</Td>
                  <Td>
                    {container.current_order ? (
                      <Link
                        href={`/orders/${container.current_order.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {container.current_order.order_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-center">
                    <ContainerStatusBadge status={container.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Page>
  );
}

export default function MyContainersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission permission="containers.mine">
        <MyContainers />
      </RequirePermission>
    </Suspense>
  );
}
