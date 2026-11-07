import { AppShell } from "@/components/layout/app-shell";

export default function PortalLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
