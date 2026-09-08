"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

import { PermissionGate } from "@/components/shared/permission-gate";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { routes } from "@/config/routes";
import { leadsQueryOptions, useDeleteLead } from "@/features/leads/api/queries";
import { ConvertLeadDialog } from "@/features/leads/components/convert-lead-dialog";
import { EditLeadDialog } from "@/features/leads/components/edit-lead-dialog";
import { LeadStatusBadge } from "@/features/leads/components/LeadStatusBadge";
import type { CrmLead } from "@/features/leads/types";

export function LeadsTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageOffset, setPageOffset] = useState(0);
  const [sortField, setSortField] = useState("created_at");
  const [sortDesc, setSortDesc] = useState(true);

  // Modal states
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [convertingLead, setConvertingLead] = useState<CrmLead | null>(null);

  const deleteMutation = useDeleteLead();

  const leadsQuery = useQuery(
    leadsQueryOptions({
      q: search,
      status: statusFilter === "all" ? undefined : statusFilter,
      sort: sortField,
      desc: sortDesc,
      limit: DEFAULT_PAGE_SIZE,
      offset: pageOffset,
    })
  );

  const data = leadsQuery.data;
  const leads = data?.items ?? [];
  const total = data?.total ?? 0;

  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE) || 1;
  const currentPage = Math.floor(pageOffset / DEFAULT_PAGE_SIZE) + 1;

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, email, company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageOffset(0);
            }}
            className="pl-9"
          />
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPageOffset(0);
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="contacted">Contacted</TabsTrigger>
            <TabsTrigger value="qualified">Qualified</TabsTrigger>
            <TabsTrigger value="converted">Converted</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table Container */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("last_name")}>
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead>Company & Title</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("created_at")}>
                <div className="flex items-center gap-1">
                  Created
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leadsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Loading leads...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No leads found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link
                      href={routes.lead(lead.id)}
                      className="hover:underline text-foreground font-semibold flex items-center gap-1.5"
                    >
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {lead.company_name || "—"}
                      </span>
                      <span className="text-muted-foreground">{lead.title || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs gap-0.5">
                      {lead.email && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {lead.email}
                        </span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {lead.phone}
                        </span>
                      )}
                      {!lead.email && !lead.phone && <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">
                    {lead.source || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={routes.lead(lead.id)}>View details</Link>
                        </DropdownMenuItem>

                        {!lead.is_converted && (
                          <PermissionGate permission={PERMISSIONS.leadsWrite}>
                            <DropdownMenuItem
                              className="text-purple-400 font-medium focus:text-purple-300"
                              onClick={() => setConvertingLead(lead)}
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              Convert Lead
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </PermissionGate>
                        )}

                        <PermissionGate permission={PERMISSIONS.leadsWrite}>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteMutation.mutate(lead.id)}
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
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          Showing {leads.length > 0 ? pageOffset + 1 : 0} to {Math.min(pageOffset + DEFAULT_PAGE_SIZE, total)} of {total} leads
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageOffset === 0}
            onClick={() => setPageOffset(Math.max(0, pageOffset - DEFAULT_PAGE_SIZE))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPageOffset(pageOffset + DEFAULT_PAGE_SIZE)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Modals */}
      <EditLeadDialog
        lead={editingLead}
        open={Boolean(editingLead)}
        onOpenChange={(open) => !open && setEditingLead(null)}
      />

      <ConvertLeadDialog
        lead={convertingLead}
        open={Boolean(convertingLead)}
        onOpenChange={(open) => !open && setConvertingLead(null)}
      />
    </div>
  );
}
