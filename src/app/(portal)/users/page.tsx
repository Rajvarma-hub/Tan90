import { Suspense } from "react";
import type { Metadata } from "next";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { UsersTable } from "@/features/users/components/users-table";
import { getUsersPage } from "@/features/users/queries";

export const metadata: Metadata = { title: "Users" };

async function Users() {
  const { users, options } = await getUsersPage();
  return <UsersTable users={users} options={options} />;
}

export default function UsersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirePermission permission="users.manage">
        <Users />
      </RequirePermission>
    </Suspense>
  );
}
