"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ScrollText } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { Button } from "@/components/ui/button";
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
import {
  auditActionsQueryOptions,
  auditQueryOptions,
} from "@/features/audit/api/queries";
import { AuditChanges } from "@/features/audit/components/audit-changes";
import { actionGroup, actionLabel, isNotable } from "@/features/audit/types";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";

const ALL = "all";

export function AuditLog() {
  const [action, setAction] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);

  // Changing the filter resets the page, in the handler rather than an effect
  // watching `action` — the reset is caused by the interaction itself.
  function changeAction(value: string) {
    setAction(value);
    setOffset(0);
  }

  const actions = useQuery(auditActionsQueryOptions);
  const entries = useQuery(
    auditQueryOptions({
      action: action === ALL ? undefined : action,
      limit: DEFAULT_PAGE_SIZE,
      offset,
    }),
  );

  // Grouped so "Authentication" and "User" actions are not one flat list of
  // eleven similar-looking strings.
  const grouped = new Map<string, string[]>();
  for (const name of actions.data ?? []) {
    const group = actionGroup(name);
    grouped.set(group, [...(grouped.get(group) ?? []), name]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={action} onValueChange={changeAction}>
          <SelectTrigger className="w-60" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {[...grouped.entries()].map(([group, names]) => (
              <SelectGroupItems key={group} group={group} names={names} />
            ))}
          </SelectContent>
        </Select>

        {action !== ALL ? (
          <Button variant="ghost" size="sm" onClick={() => changeAction(ALL)}>
            Clear filter
          </Button>
        ) : null}
      </div>

      {entries.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Could not load the audit log"
          description={entries.error.message}
          action={
            <Button variant="outline" size="sm" onClick={() => void entries.refetch()}>
              Try again
            </Button>
          }
        />
      ) : entries.isPending ? (
        <AuditSkeleton />
      ) : entries.data.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={action === ALL ? "Nothing recorded yet" : "No entries for that action"}
          description={
            action === ALL
              ? "Sign-ins, role changes and account changes appear here as they happen."
              : "Try a different action, or clear the filter to see everything."
          }
        />
      ) : (
        <>
          <div className="rounded-lg border" aria-busy={entries.isFetching}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-48">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Actor</TableHead>
                  <TableHead className="hidden xl:table-cell w-0">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.data.items.map((entry) => (
                  <TableRow key={entry.id} className="align-top">
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-sm",
                            isNotable(entry.action)
                              ? "font-medium text-foreground"
                              : "text-foreground/90",
                          )}
                        >
                          {entry.summary || actionLabel(entry.action)}
                        </span>
                        <code className="text-[11px] text-muted-foreground">
                          {entry.action}
                        </code>
                        <span className="text-xs text-muted-foreground md:hidden">
                          {entry.actorEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {entry.actorEmail}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <AuditChanges changes={entry.changes} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationFooter
            total={entries.data.total}
            limit={entries.data.limit}
            offset={entries.data.offset}
            onOffsetChange={setOffset}
            unit="entries"
          />
        </>
      )}
    </div>
  );
}

/**
 * Radix's Select does not accept a fragment of items, so the group heading and
 * its options are emitted as a flat run instead.
 */
function SelectGroupItems({ group, names }: { group: string; names: string[] }) {
  return (
    <>
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</div>
      {names.map((name) => (
        <SelectItem key={name} value={name}>
          {actionLabel(name)}
        </SelectItem>
      ))}
    </>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-lg border">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-36" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-4 w-44 md:block" />
        </div>
      ))}
    </div>
  );
}
