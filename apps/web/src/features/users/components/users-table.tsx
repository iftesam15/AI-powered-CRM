"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, UsersRound } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/features/auth/hooks/use-session";
import { rolesQueryOptions, usersQueryOptions } from "@/features/users/api/queries";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { EditUserDialog } from "@/features/users/components/edit-user-dialog";
import { RoleBadge, UserStatusBadge } from "@/features/users/components/user-badges";
import type { CrmUser, UserListFilters } from "@/features/users/types";
import { useDebounce } from "@/hooks/use-debounce";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";

type RoleFilter = NonNullable<UserListFilters["role"]>;
type StatusFilter = NonNullable<UserListFilters["status"]>;

export function UsersTable() {
  const { user: currentUser } = useSession();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CrmUser | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  /**
   * Any filter change invalidates the current position in the list, so the
   * pager goes back to the first page rather than landing on an empty one.
   * Done in the handlers rather than an effect watching the filters: the reset
   * is caused by the interaction, not by the state settling afterwards.
   */
  function changeSearch(value: string) {
    setSearch(value);
    setOffset(0);
  }

  function changeRole(value: RoleFilter) {
    setRole(value);
    setOffset(0);
  }

  function changeStatus(value: StatusFilter) {
    setStatus(value);
    setOffset(0);
  }

  function clearFilters() {
    setSearch("");
    setRole("all");
    setStatus("all");
    setOffset(0);
  }

  const roles = useQuery(rolesQueryOptions);
  const users = useQuery(
    usersQueryOptions({
      q: debouncedSearch,
      role,
      status,
      limit: DEFAULT_PAGE_SIZE,
      offset,
    }),
  );

  const roleOptions = roles.data ?? [];
  const hasFilters = debouncedSearch.trim() !== "" || role !== "all" || status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search name or email"
            className="pl-8"
            aria-label="Search users"
          />
        </div>

        <Select value={role} onValueChange={(value) => changeRole(value as RoleFilter)}>
          <SelectTrigger className="w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => changeStatus(value as StatusFilter)}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>

        <PermissionGate permission={PERMISSIONS.usersWrite}>
          <div className="ml-auto">
            <CreateUserDialog roles={roleOptions} />
          </div>
        </PermissionGate>
      </div>

      {users.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Could not load users"
          description={users.error.message}
          action={
            <Button variant="outline" size="sm" onClick={() => void users.refetch()}>
              Try again
            </Button>
          }
        />
      ) : users.isPending ? (
        <UsersTableSkeleton />
      ) : users.data.items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={hasFilters ? "No users match those filters" : "No users yet"}
          description={
            hasFilters
              ? "Try a different search term, role or status."
              : "Add the first colleague to this organisation."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* `aria-busy` while a filter change is in flight: the previous page
              stays on screen (placeholderData) rather than flashing a skeleton,
              so the state change has to be announced rather than seen. */}
          <div
            className="rounded-lg border"
            aria-busy={users.isFetching}
            data-pending={users.isFetching ? "" : undefined}
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.items.map((user) => (
                  <TableRow key={user.id} className={user.isActive ? undefined : "opacity-65"}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.fullName}
                          {user.id === currentUser.id ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              You
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                        <span className="mt-1 sm:hidden">
                          <RoleBadge role={user.role} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {user.lastLoginAt ? (
                        formatDateTime(user.lastLoginAt)
                      ) : (
                        <span title={`Added ${formatDate(user.createdAt)}`}>Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge isActive={user.isActive} isLocked={user.isLocked} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PermissionGate permission={PERMISSIONS.usersWrite}>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(user)}>
                          Edit
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationFooter
            total={users.data.total}
            limit={users.data.limit}
            offset={users.data.offset}
            onOffsetChange={setOffset}
            unit="users"
          />
        </>
      )}

      <EditUserDialog
        user={editing}
        roles={roleOptions}
        currentUserId={currentUser.id}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-lg border">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="hidden h-5 w-28 sm:block" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
