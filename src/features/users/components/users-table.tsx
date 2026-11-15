"use client";

import { useMemo, useState } from "react";
import { Briefcase, Lock, Truck, Users } from "lucide-react";
import { useUser } from "@/components/auth/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { Input, Select } from "@/components/ui/form";
import { OpenRow } from "@/components/ui/open-row";
import { Page, PageHeader, Stat, StatGrid, Toolbar } from "@/components/ui/page";
import { paginate, Pagination } from "@/components/ui/pagination";
import { BadgeCell, Cell, Dash, rowAccent, Table, Td, Th } from "@/components/ui/table";
import { unlockUser } from "@/features/users/actions";
import {
  AddUserDialog,
  EditUserDialog,
  ResetPasswordDialog,
} from "@/features/users/components/user-dialogs";
import type { ManagedUser, UserFormOptions } from "@/features/users/types";
import { useServerAction } from "@/hooks/use-server-action";
import { formatDate, formatNumber } from "@/lib/format";
import { canManageRole, roleLabels, roles, STAFF_ROLES } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Fixed column widths keep the table the same shape on every page.
type Group = "" | "staff" | "drivers" | "customers";
type StatusFilter = "" | "active" | "inactive" | "locked";

const inGroup: Record<Exclude<Group, "">, (user: ManagedUser) => boolean> = {
  staff: (user) => STAFF_ROLES.includes(user.role),
  drivers: (user) => user.role === "DRIVER",
  customers: (user) => user.role === "CUSTOMER",
};

function statusOf(user: ManagedUser): Exclude<StatusFilter, ""> {
  if (!user.is_active) return "inactive";
  return user.locked ? "locked" : "active";
}

function WorksAt({ user }: { user: ManagedUser }) {
  if (user.customer_name) {
    return <span className="block truncate font-medium">{user.customer_name}</span>;
  }
  if (user.location_code) {
    return (
      <Cell main={user.location_code}>
        <span className="block truncate">{user.location_name}</span>
      </Cell>
    );
  }
  return <Dash />;
}

export function UsersTable({
  users,
  options,
}: {
  users: ManagedUser[];
  options: UserFormOptions;
}) {
  const me = useUser();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<Group>("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const unlock = useServerAction(unlockUser);
  const hasFilters = Boolean(search || group || role || status);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(
      (user) =>
        (!group || inGroup[group](user)) &&
        (!role || user.role === role) &&
        (!status || statusOf(user) === status) &&
        (!term ||
          [user.full_name, user.email, user.customer_name, user.location_code, roleLabels[user.role]]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    );
  }, [users, search, group, role, status]);
  const { rows, page: currentPage, pageCount } = paginate(filtered, page);

  const lockedCount = users.filter((user) => statusOf(user) === "locked").length;
  const stat = (label: string, key: Group, icon: typeof Users, count: number) => (
    <Stat
      label={label}
      icon={icon}
      value={formatNumber(count)}
      active={key !== "" && group === key}
      onClick={() => {
        setGroup(group === key ? "" : key);
        setPage(1);
      }}
    />
  );

  return (
    <Page>
      <PageHeader
        title="Users"
        description="Everyone who can sign in: staff, drivers and customers."
        actions={
          <>
            <ExportButton
              filename="users"
              headers={["Name", "Email", "Role", "Works at", "Added", "Status"]}
              rows={filtered.map((u) => [
                u.full_name,
                u.email,
                roleLabels[u.role],
                u.customer_name ?? u.location_code,
                u.created_at,
                statusOf(u),
              ])}
            />
            <AddUserDialog options={options} />
          </>
        }
      />

      <StatGrid>
        {stat("All people", "", Users, users.length)}
        {stat("Staff", "staff", Briefcase, users.filter(inGroup.staff).length)}
        {stat("Drivers", "drivers", Truck, users.filter(inGroup.drivers).length)}
        {stat("Customer users", "customers", Users, users.filter(inGroup.customers).length)}
        <Stat
          label="Locked out"
          icon={Lock}
          tone={lockedCount > 0 ? "amber" : "blue"}
          value={formatNumber(lockedCount)}
          active={status === "locked"}
          onClick={() => {
            setStatus(status === "locked" ? "" : "locked");
            setPage(1);
          }}
        />
      </StatGrid>

      <Card>
        <CardHeader
          title="All users"
          description={`${filtered.length} of ${users.length} shown · active people first`}
        />

        <Toolbar>
          <Input
            type="search"
            className="min-w-56 flex-1"
            placeholder="Search name, email, customer, location…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-56"
            aria-label="Role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {roles.map((value) => (
              <option key={value} value={value}>
                {roleLabels[value]}
              </option>
            ))}
          </Select>
          <Select
            className="w-44"
            aria-label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="locked">Locked out</option>
            <option value="inactive">Inactive</option>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setGroup("");
                setRole("");
                setStatus("");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>

        {rows.length === 0 ? (
          <EmptyState>No users match these filters.</EmptyState>
        ) : (
          <Table className="min-w-[1190px] table-fixed">
            <colgroup>
              <col className="w-[250px]" />
              <col className="w-[210px]" />
              <col className="w-[170px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[320px]" />
            </colgroup>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th className="text-center">Role</Th>
                <Th>Works at</Th>
                <Th className="text-center">Added</Th>
                <Th className="text-center">Status</Th>
                <Th className="text-center">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const manageable = canManageRole(me.role, user.role);
                const state = statusOf(user);
                return (
                  <OpenRow
                    key={user.id}
                    disabled={!manageable}
                    onOpen={() => setEditing(user)}
                    className={cn(
                      state === "inactive" && "opacity-70",
                      rowAccent(state === "locked" ? "amber" : null),
                    )}
                  >
                    <Td>
                      <Cell main={<span className="block truncate">{user.full_name}</span>}>
                        <span className="block truncate">{user.email}</span>
                      </Cell>
                    </Td>
                    <Td className="text-center">
                      <span className="font-medium whitespace-nowrap">{roleLabels[user.role]}</span>
                    </Td>
                    <Td>
                      <WorksAt user={user} />
                    </Td>
                    <Td className="text-center">
                      <span className="whitespace-nowrap">{formatDate(user.created_at)}</span>
                    </Td>
                    <Td className="text-center">
                      {state === "inactive" ? (
                        <BadgeCell badge={<Badge tone="gray">Inactive</Badge>} />
                      ) : state === "locked" ? (
                        <BadgeCell badge={<Badge tone="amber">Locked out</Badge>} />
                      ) : (
                        <BadgeCell badge={<Badge tone="green">Active</Badge>} />
                      )}
                    </Td>
                    <Td className="text-center">
                      {manageable ? (
                        <div className="flex items-center justify-center gap-2">
                          {state === "locked" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-24"
                              disabled={unlock.pending}
                              onClick={() => unlock.run({ id: user.id })}
                            >
                              Unlock
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-24"
                            onClick={() => setEditing(user)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-24"
                            onClick={() => setResetting(user)}
                          >
                            Reset
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Super admin only</span>
                      )}
                    </Td>
                  </OpenRow>
                );
              })}
            </tbody>
          </Table>
        )}
        {unlock.error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {unlock.error}
          </p>
        )}

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          total={filtered.length}
          noun={filtered.length === 1 ? "user" : "users"}
          onPage={setPage}
        />
      </Card>

      {editing && (
        <EditUserDialog
          key={editing.id}
          user={editing}
          options={options}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && (
        <ResetPasswordDialog
          key={resetting.id}
          user={resetting}
          onClose={() => setResetting(null)}
        />
      )}
    </Page>
  );
}
