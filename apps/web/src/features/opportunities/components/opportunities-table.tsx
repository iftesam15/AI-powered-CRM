"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StageBadge } from "./stage-badge";
import { OpportunityLossDialog } from "./opportunity-loss-dialog";
import { OpportunityDialog } from "./opportunity-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  opportunitiesQueryOptions,
  useCloseOpportunityWon,
  useCloseOpportunityLost,
  useDeleteOpportunity,
} from "@/features/opportunities/api/queries";
import { defaultPipelineQueryOptions } from "@/features/pipelines/api/queries";
import type { CrmOpportunity } from "@/features/opportunities/types";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ExportButton } from "@/features/exports/components/export-button";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";

export function OpportunitiesTable() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState("created_at");
  const [sortDesc, setSortDesc] = useState(true);

  // Modals state
  const [editOpp, setEditOpp] = useState<CrmOpportunity | null>(null);
  const [lossTargetOpp, setLossTargetOpp] = useState<CrmOpportunity | null>(null);
  const [deletingOpp, setDeletingOpp] = useState<CrmOpportunity | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: pipeline } = useQuery(defaultPipelineQueryOptions());
  const stages = pipeline?.stages || [];

  const { data, isLoading } = useQuery(
    opportunitiesQueryOptions({
      q: search,
      stage_id: stageFilter === "all" ? undefined : stageFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      sort: sortField,
      desc: sortDesc,
      limit: DEFAULT_PAGE_SIZE,
      offset: page * DEFAULT_PAGE_SIZE,
    })
  );

  const closeWonMutation = useCloseOpportunityWon("");
  const closeLostMutation = useCloseOpportunityLost(lossTargetOpp?.id || "");
  const deleteMutation = useDeleteOpportunity("");

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const handleMarkWon = async (opp: CrmOpportunity) => {
    await closeWonMutation.mutateAsync({ oppId: opp.id, notes: "Marked won via list actions" });
  };

  const handleConfirmLoss = async (lossReason: string, notes?: string) => {
    if (!lossTargetOpp) return;
    await closeLostMutation.mutateAsync({ oppId: lossTargetOpp.id, loss_reason: lossReason, notes });
    setLossTargetOpp(null);
  };

  const formatCurrency = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatDate = (val: string | null) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-8 h-9"
            />
          </div>

          <Select
            value={stageFilter}
            onValueChange={(val) => {
              setStageFilter(val);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open Deals</SelectItem>
              <SelectItem value="won">Closed Won</SelectItem>
              <SelectItem value="lost">Closed Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <PermissionGate permission={PERMISSIONS.exportsRead}>
            <ExportButton entityType="opportunities" className="h-9" />
          </PermissionGate>

          <Button onClick={() => setIsCreateOpen(true)} className="h-9 gap-1.5 w-full sm:w-auto">
            <TrendingUp className="w-4 h-4" />
            <span>New Opportunity</span>
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[280px]">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 text-xs font-semibold uppercase hover:text-foreground"
                >
                  Opportunity Name
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort("amount")}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase hover:text-foreground ml-auto"
                >
                  Deal Value
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </TableHead>
              <TableHead className="text-right">Forecast (Wtd)</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("expected_close_date")}
                  className="flex items-center gap-1 text-xs font-semibold uppercase hover:text-foreground"
                >
                  Target Close
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Loading opportunities...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <TrendingUp className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-muted-foreground">No opportunities found.</p>
                    <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                      Create your first deal
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((opp) => (
                <TableRow key={opp.id} className="group">
                  <TableCell className="font-medium">
                    <Link
                      href={`/opportunities/${opp.id}`}
                      className="text-foreground hover:text-primary transition-colors block leading-snug"
                    >
                      {opp.name}
                    </Link>
                    {opp.notes && (
                      <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {opp.notes}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    {opp.account_name ? (
                      <Link
                        href={`/accounts/${opp.account_id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{opp.account_name}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <StageBadge
                      stageName={opp.stage_name}
                      status={opp.status}
                      isWon={opp.status === "won"}
                      isLost={opp.status === "lost"}
                    />
                  </TableCell>

                  <TableCell className="text-right font-medium text-foreground">
                    {formatCurrency(opp.amount)}
                  </TableCell>

                  <TableCell className="text-right text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatCurrency(opp.weighted_amount)}</span>
                    <span className="text-[11px] block text-muted-foreground">({opp.probability}%)</span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(opp.expected_close_date)}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-xs">Deal Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/opportunities/${opp.id}`}>
                            <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditOpp(opp)}>
                          <Pencil className="w-4 h-4 mr-2 text-muted-foreground" />
                          Edit Deal
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {opp.status !== "won" && (
                          <DropdownMenuItem
                            onClick={() => handleMarkWon(opp)}
                            className="text-emerald-600 dark:text-emerald-400"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                            Mark Won
                          </DropdownMenuItem>
                        )}

                        {opp.status !== "lost" && (
                          <DropdownMenuItem
                            onClick={() => setLossTargetOpp(opp)}
                            className="text-rose-600 dark:text-rose-400"
                          >
                            <XCircle className="w-4 h-4 mr-2 text-rose-500" />
                            Mark Lost...
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => setDeletingOpp(opp)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2 text-destructive" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-medium text-foreground">{items.length}</span> of{" "}
              <span className="font-medium text-foreground">{total}</span> opportunities
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page - 1)}
                disabled={page <= 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span>
                Page {page + 1} of {Math.max(1, totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(page + 1)}
                disabled={page + 1 >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <OpportunityDialog
        open={Boolean(editOpp)}
        onOpenChange={(open) => !open && setEditOpp(null)}
        opportunity={editOpp}
      />

      {/* Create Dialog */}
      <OpportunityDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {/* Loss Reason Dialog */}
      <OpportunityLossDialog
        open={Boolean(lossTargetOpp)}
        onOpenChange={(open) => !open && setLossTargetOpp(null)}
        opportunityName={lossTargetOpp?.name}
        onConfirm={handleConfirmLoss}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingOpp)}
        onOpenChange={(open) => !open && setDeletingOpp(null)}
        title="Delete Opportunity"
        description={
          <>
            Are you sure you want to delete opportunity{" "}
            <strong className="text-foreground">{deletingOpp?.name}</strong>? This action
            cannot be undone.
          </>
        }
        confirmText="Delete Opportunity"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deletingOpp) {
            await deleteMutation.mutateAsync(deletingOpp.id);
            setDeletingOpp(null);
          }
        }}
      />
    </div>
  );
}
