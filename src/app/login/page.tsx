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
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/tan90-logo-white.png"
            alt="Tan90"
            width={248}
            height={320}
            priority
            className="h-auto w-[43px]"
          />
          <div>
            <h1 className="text-xl font-semibold">{siteConfig.name}</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>
        </div>
        <Card>
          <Suspense fallback={<div className="h-52" />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}
