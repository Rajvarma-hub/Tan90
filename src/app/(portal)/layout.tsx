import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getUnreadCount } from "@/features/notifications/queries";
import { getCurrentUser } from "@/server/session";

async function SignedInShell({ children }: { children: ReactNode }) {
  const [user, unreadCount] = await Promise.all([getCurrentUser(), getUnreadCount()]);
  return (
    <AppShell
      user={{ id: user.id, fullName: user.full_name, email: user.email, role: user.role }}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}

export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}
