"use client";

import { useActionState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { signIn, type SignInState } from "@/features/auth/actions";

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {notice && !state.error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {notice}
        </p>
      )}
      <Field label="Email">
        <div className="relative">
          <Mail
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            autoFocus
            required
            maxLength={320}
            className="h-10 w-full pl-9"
          />
        </div>
      </Field>
      <Field label="Password">
        <div className="relative">
          <Lock
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            maxLength={200}
            className="h-10 w-full pl-9"
          />
        </div>
      </Field>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? (
          <>
            <Loader2 aria-hidden className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
