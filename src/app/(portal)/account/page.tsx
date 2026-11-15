import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardHeader, Detail, DetailGrid } from "@/components/ui/card";
import { Page, PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { roleLabels } from "@/lib/permissions";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Account" };

async function Account() {
  const user = await getCurrentUser();
  return (
    <Page>
      <PageHeader title="Account" description="Your sign-in details and password." />
      <Card>
        <CardHeader title="Profile" />
        <DetailGrid>
          <Detail label="Name">{user.full_name}</Detail>
          <Detail label="Email">{user.email}</Detail>
          <Detail label="Role">{roleLabels[user.role]}</Detail>
        </DetailGrid>
      </Card>
      <Card>
        <CardHeader
          title="Change password"
          description="Changing it signs you out everywhere else."
        />
        <ChangePasswordForm />
      </Card>
    </Page>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Account />
    </Suspense>
  );
}
