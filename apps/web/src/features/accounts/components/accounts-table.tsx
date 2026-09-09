"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ExternalLink,
  Eye,
  Globe,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ExportButton } from "@/features/exports/components/export-button";

import { EmptyState } from "@/components/shared/empty-state";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  accountsQueryOptions,
  useDeleteAccount,
} from "@/features/accounts/api/queries";
import { EditAccountDialog } from "@/features/accounts/components/edit-account-dialog";
import type { CrmAccount } from "@/features/accounts/types";
import { useDebounce } from "@/hooks/use-debounce";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export function AccountsTable() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CrmAccount | null>(null);
  const [deleting, setDeleting] = useState<CrmAccount | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useQuery(
    accountsQueryOptions({
      q: debouncedSearch,
      industry: industry === "all" ? undefined : industry,
      limit: DEFAULT_PAGE_SIZE,
      offset,
    })
  );

  const deleteMutation = useDeleteAccount();

  function changeSearch(value: string) {
    setSearch(value);
    setOffset(0);
  }

  function changeIndustry(value: string) {
    setIndustry(value);
    setOffset(0);
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={industry} onValueChange={changeIndustry}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              <SelectItem value="Logistics & Supply Chain">Logistics</SelectItem>
              <SelectItem value="Freight Forwarding">Freight Forwarding</SelectItem>
              <SelectItem value="Maritime Shipping">Maritime</SelectItem>
              <SelectItem value="Retail & E-commerce">Retail</SelectItem>
              <SelectItem value="Technology & Software">Technology</SelectItem>
            </SelectContent>
          </Select>
          <PermissionGate permission={PERMISSIONS.exportsRead}>
            <ExportButton entityType="accounts" />
          </PermissionGate>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-destructive">
                  Failed to load accounts. Please try again.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48">
                  <EmptyState
                    icon={Building2}
                    title="No accounts found"
                    description={
                      debouncedSearch || industry !== "all"
                        ? "Try clearing or updating your filters."
                        : "Add your first account to get started tracking companies."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/accounts/${account.id}`}
                      className="hover:underline text-foreground hover:text-primary transition-colors"
                    >
                      {account.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {account.industry ? (
                      <Badge variant="outline">{account.industry}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.size || "—"}
                  </TableCell>
                  <TableCell>
                    {account.website ? (
                      <a
                        href={account.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs text-primary hover:underline"
                      >
                        <Globe className="mr-1 h-3 w-3" />
                        {account.website.replace(/^https?:\/\//, "")}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(account.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/accounts/${account.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <PermissionGate permission={PERMISSIONS.accountsWrite}>
                          <DropdownMenuItem onClick={() => setEditing(account)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(account)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Account
                          </DropdownMenuItem>
                        </PermissionGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationFooter
        total={total}
        limit={DEFAULT_PAGE_SIZE}
        offset={offset}
        onOffsetChange={setOffset}
      />

      <EditAccountDialog
        account={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete Account"
        description={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{deleting?.name}</strong>? This action
            cannot be undone and all associated contacts and records may be affected.
          </>
        }
        confirmText="Delete Account"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deleting) {
            await deleteMutation.mutateAsync(deleting.id);
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}
