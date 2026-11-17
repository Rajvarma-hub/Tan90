import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNextPath } from "@/lib/session-token";

export const metadata: Metadata = { title: "Sign in" };

const notices: Record<string, string> = {
  expired: "Your session has ended. Sign in again to continue.",
  forbidden: "This account type cannot use the portal.",
};

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, reason } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  const notice = typeof reason === "string" ? (notices[reason] ?? null) : null;
  return <LoginForm next={nextPath} notice={notice} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,oklch(0.6576_0.1208_252.083/0.18),transparent_70%),radial-gradient(40rem_30rem_at_90%_110%,oklch(0.6576_0.1208_252.083/0.08),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <div className="relative grid w-full max-w-md gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl border bg-card shadow-lg shadow-primary/10 ring-1 ring-primary/20">
            <Image
              src="/brand/tan90-logo-white.png"
              alt="Tan90"
              width={248}
              height={320}
              priority
              className="h-auto w-[30px]"
            />
          </span>
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">
              {siteConfig.name}
            </h1>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>
        </div>
        <Card className="border-border/80 shadow-2xl shadow-black/40 sm:p-8">
          <Suspense fallback={<div className="h-52" />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </Card>
        <p className="text-center text-xs text-muted-foreground/70">
          {siteConfig.name} · Secure portal access
        </p>
      </div>
    </main>
  );
}
