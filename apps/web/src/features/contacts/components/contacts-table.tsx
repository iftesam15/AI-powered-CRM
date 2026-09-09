"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Contact,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Search,
  Trash2,
  Upload,
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
  contactsQueryOptions,
  useDeleteContact,
} from "@/features/contacts/api/queries";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EditContactDialog } from "@/features/contacts/components/edit-contact-dialog";
import type { CrmContact } from "@/features/contacts/types";
import { useDebounce } from "@/hooks/use-debounce";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export function ContactsTable() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CrmContact | null>(null);
  const [deleting, setDeleting] = useState<CrmContact | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useQuery(
    contactsQueryOptions({
      q: debouncedSearch,
      limit: DEFAULT_PAGE_SIZE,
      offset,
    })
  );

  const deleteMutation = useDeleteContact();

  function changeSearch(value: string) {
    setSearch(value);
    setOffset(0);
  }

  function handleDelete(contact: CrmContact) {
    setDeleting(contact);
  }

  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <PermissionGate permission={PERMISSIONS.importsWrite}>
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href="/imports">
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.exportsRead}>
            <ExportButton entityType="contacts" />
          </PermissionGate>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Primary Account</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-destructive">
                  Failed to load contacts. Please check your connection or try again.
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={Contact}
                    title="No contacts found"
                    description={
                      search
                        ? "No contacts match your current search query."
                        : "You haven't added any contacts yet. Get started by adding your first contact."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="hover:underline text-primary"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {contact.title || "—"}
                  </TableCell>

                  <TableCell>
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        {contact.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {contact.phone ? (
                      <span className="inline-flex items-center">
                        <Phone className="mr-1 h-3 w-3" />
                        {contact.phone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  <TableCell>
                    {contact.account_id ? (
                      <Link href={`/accounts/${contact.account_id}`}>
                        <Badge variant="outline" className="font-normal hover:bg-secondary transition-colors">
                          <Building2 className="mr-1 h-3 w-3 text-muted-foreground" />
                          {contact.account_name || "Account"}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Individual</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(contact.created_at)}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/contacts/${contact.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View details
                          </Link>
                        </DropdownMenuItem>

                        <PermissionGate permission={PERMISSIONS.contactsWrite}>
                          <DropdownMenuItem onClick={() => setEditing(contact)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(contact)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      {/* Pagination Footer */}
      {!isLoading && total > 0 && (
        <PaginationFooter
          total={total}
          limit={DEFAULT_PAGE_SIZE}
          offset={offset}
          onOffsetChange={setOffset}
        />
      )}

      {/* Edit Dialog */}
      <EditContactDialog
        contact={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete Contact"
        description={
          <>
            Are you sure you want to delete contact{" "}
            <strong className="text-foreground">
              {deleting?.first_name} {deleting?.last_name}
            </strong>
            ? This action cannot be undone.
          </>
        }
        confirmText="Delete Contact"
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
