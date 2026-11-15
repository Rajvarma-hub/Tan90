"use client";

import { useActionState } from "react";
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
        <Input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          maxLength={320}
        />
      </Field>
      <Field label="Password">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
        />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
