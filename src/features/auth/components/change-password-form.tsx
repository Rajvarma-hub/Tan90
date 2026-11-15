"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { changePassword } from "@/features/auth/actions";
import { changePasswordSchema } from "@/features/auth/schemas";
import { useServerAction } from "@/hooks/use-server-action";

const empty = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordForm() {
  const [values, setValues] = useState(empty);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { run, pending, error, clearError } = useServerAction(changePassword, () => {
    setValues(empty);
    setDone(true);
  });

  const set = (key: keyof typeof empty) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setDone(false);
    setProblem(null);
    clearError();
  };

  return (
    <form
      className="grid max-w-sm gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = changePasswordSchema.safeParse(values);
        if (!parsed.success) {
          setProblem(parsed.error.issues[0]?.message ?? "Check the form");
          return;
        }
        run(values);
      }}
    >
      <Field label="Current password">
        <Input
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          value={values.currentPassword}
          onChange={set("currentPassword")}
        />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input
          type="password"
          autoComplete="new-password"
          required
          maxLength={200}
          value={values.newPassword}
          onChange={set("newPassword")}
        />
      </Field>
      <Field label="Repeat new password">
        <Input
          type="password"
          autoComplete="new-password"
          required
          maxLength={200}
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
        />
      </Field>
      <FormError message={problem ?? error} />
      {done && (
        <p role="status" className="text-sm text-emerald-400">
          Password changed. Your other sessions have been signed out.
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
