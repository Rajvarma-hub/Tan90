"use client";

import { useState, type FormEvent } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useUser } from "@/components/auth/user-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createUser, resetUserPassword, updateUser } from "@/features/users/actions";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "@/features/users/schemas";
import type { ManagedUser, UserFormOptions } from "@/features/users/types";
import { useServerAction } from "@/hooks/use-server-action";
import { generatePassword } from "@/lib/password";
import { canManageRole, roleLabels, roles, STATION_ROLES, type Role } from "@/lib/permissions";

const NEW_CUSTOMER = "__new__";

function PasswordField({
  value,
  onChange,
  label = "Password",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <Field
      label={label}
      hint="Give it to them yourself. They can change it on their Account page."
    >
      <div className="flex gap-2">
        <Input
          required
          autoComplete="off"
          spellCheck={false}
          maxLength={72}
          className="flex-1 font-mono"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button variant="outline" onClick={() => onChange(generatePassword())}>
          <RefreshCw /> Generate
        </Button>
      </div>
    </Field>
  );
}

function useAssignableRoles(): Role[] {
  const { role } = useUser();
  return roles.filter((candidate) => canManageRole(role, candidate));
}

export function AddUserDialog({ options }: { options: UserFormOptions }) {
  const assignable = useAssignableRoles();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("DRIVER");
  const [password, setPassword] = useState("");
  const [locationId, setLocationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const { run, pending, error, clearError } = useServerAction(createUser);
  const needsLocation = STATION_ROLES.includes(role);
  const newCustomer = customerId === NEW_CUSTOMER;

  function reset() {
    setEmail("");
    setFullName("");
    setPassword("");
    setLocationId("");
    setCustomerId("");
    setCustomerName("");
    setProblem(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      email,
      fullName,
      role,
      password,
      locationId: needsLocation ? locationId || null : null,
      customerId: role === "CUSTOMER" && customerId && !newCustomer ? customerId : null,
      customerName: role === "CUSTOMER" && newCustomer ? customerName || null : null,
    };
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setProblem(null);
    run(input);
    // The success callback cannot see the password once the form clears, so keep what to show.
    setCreated({ email: parsed.data.email, password });
  }

  return (
    <>
      <Button
        onClick={() => {
          clearError();
          setCreated(null);
          setOpen(true);
        }}
      >
        <Plus /> Add User
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Add User"
        description="Create a sign-in for someone. Customer users belong to a customer company."
      >
        {created && !pending && !error ? (
          <div className="grid gap-4">
            <p role="status" className="text-sm text-emerald-400">
              Created {created.email}. Their first password is{" "}
              <span className="font-mono">{created.password}</span>.
            </p>
            <DialogActions
              onCancel={() => {
                setOpen(false);
                reset();
              }}
              cancelLabel="Done"
            >
              <Button
                onClick={() => {
                  setCreated(null);
                  reset();
                }}
              >
                Add another
              </Button>
            </DialogActions>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  required
                  maxLength={200}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  required
                  type="email"
                  maxLength={320}
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Role">
              <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {assignable.map((value) => (
                  <option key={value} value={value}>
                    {roleLabels[value]}
                  </option>
                ))}
              </Select>
            </Field>
            {needsLocation && (
              <Field label="Location" hint="Their queue and stock are limited to this location.">
                <Select
                  required
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  <option value="">Select location</option>
                  {options.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {role === "CUSTOMER" && (
              <>
                <Field label="Customer">
                  <Select
                    required
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                  >
                    <option value="">Select customer</option>
                    {options.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.label}
                      </option>
                    ))}
                    <option value={NEW_CUSTOMER}>New customer…</option>
                  </Select>
                </Field>
                {newCustomer && (
                  <Field label="New customer name">
                    <Input
                      required
                      maxLength={200}
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                    />
                  </Field>
                )}
              </>
            )}
            <PasswordField value={password} onChange={setPassword} label="First password" />
            <FormError message={problem ?? error} />
            <DialogActions
              onCancel={() => {
                setOpen(false);
                reset();
              }}
            >
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create User"}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function EditUserDialog({
  user,
  options,
  onClose,
}: {
  user: ManagedUser;
  options: UserFormOptions;
  onClose: () => void;
}) {
  const me = useUser();
  const assignable = useAssignableRoles();
  const isSelf = user.id === me.id;
  const isCustomer = user.role === "CUSTOMER";
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<Role>(user.role);
  const [locationId, setLocationId] = useState(user.location_id ?? "");
  const [isActive, setIsActive] = useState(user.is_active);
  const [problem, setProblem] = useState<string | null>(null);
  const { run, pending, error } = useServerAction(updateUser, onClose);
  const needsLocation = STATION_ROLES.includes(role);

  function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      id: user.id,
      fullName,
      role,
      locationId: needsLocation ? locationId || null : null,
      isActive,
    };
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (needsLocation && !locationId) {
      setProblem("Choose a location");
      return;
    }
    setProblem(null);
    run(input);
  }

  return (
    <Dialog open onClose={onClose} title="Edit User" description={user.email}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Full name">
          <Input
            required
            maxLength={200}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>
        <Field
          label="Role"
          hint={
            isSelf
              ? "You cannot change your own role."
              : isCustomer
                ? "A customer account stays a customer."
                : "Changing the role signs them out so the new access applies."
          }
        >
          <Select
            value={role}
            disabled={isSelf || isCustomer}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {(isCustomer || isSelf ? [user.role] : assignable.filter((r) => r !== "CUSTOMER")).map(
              (value) => (
                <option key={value} value={value}>
                  {roleLabels[value]}
                </option>
              ),
            )}
          </Select>
        </Field>
        {needsLocation && (
          <Field label="Location">
            <Select
              required
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Select location</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={isActive}
            disabled={isSelf}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>
            <span className="font-medium text-card-foreground">Active</span>
            <span className="block text-xs text-muted-foreground">
              {isSelf
                ? "You cannot deactivate yourself."
                : "An inactive person cannot sign in, and is signed out right away."}
            </span>
          </span>
        </label>
        <FormError message={problem ?? error} />
        <DialogActions onCancel={onClose}>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: ManagedUser;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { run, pending, error } = useServerAction(resetUserPassword, () => setDone(true));

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ id: user.id, newPassword: password });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the password");
      return;
    }
    setProblem(null);
    run({ id: user.id, newPassword: password });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reset Password"
      description={`Set a new password for ${user.full_name}. They are signed out everywhere and any lock is cleared.`}
    >
      {done ? (
        <div className="grid gap-4">
          <p role="status" className="text-sm text-emerald-400">
            Password reset. Their new password is <span className="font-mono">{password}</span>.
          </p>
          <DialogActions onCancel={onClose} cancelLabel="Done">
            {null}
          </DialogActions>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <PasswordField value={password} onChange={setPassword} label="New password" />
          <FormError message={problem ?? error} />
          <DialogActions onCancel={onClose}>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
