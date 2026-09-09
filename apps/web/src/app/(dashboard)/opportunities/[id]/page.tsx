"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Mail,
  Pencil,
  Phone,
  Trash2,
  TrendingUp,
  User as UserIcon,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StageBadge } from "@/features/opportunities/components/stage-badge";
import { StageHistoryTimeline } from "@/features/opportunities/components/stage-history-timeline";
import { OpportunityDialog } from "@/features/opportunities/components/opportunity-dialog";
import { OpportunityLossDialog } from "@/features/opportunities/components/opportunity-loss-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  opportunityDetailQueryOptions,
  useCloseOpportunityWon,
  useCloseOpportunityLost,
  useDeleteOpportunity,
  useMoveOpportunityStage,
} from "@/features/opportunities/api/queries";
import { defaultPipelineQueryOptions } from "@/features/pipelines/api/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OpportunityDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLossOpen, setIsLossOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: opp, isLoading, error } = useQuery(opportunityDetailQueryOptions(id));
  const { data: pipeline } = useQuery(defaultPipelineQueryOptions());

  const moveStageMutation = useMoveOpportunityStage();
  const closeWonMutation = useCloseOpportunityWon(id);
  const closeLostMutation = useCloseOpportunityLost(id);
  const deleteMutation = useDeleteOpportunity(id);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading opportunity details...
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-destructive font-medium">Opportunity not found or access denied.</p>
        <Button variant="outline" asChild>
          <Link href="/opportunities">Back to Opportunities</Link>
        </Button>
      </div>
    );
  }

  const stages = pipeline?.stages || [];

  const handleStageClick = async (targetStageId: string) => {
    const target = stages.find((s) => s.id === targetStageId);
    if (!target) return;
    if (target.is_lost) {
      setIsLossOpen(true);
      return;
    }
    await moveStageMutation.mutateAsync({
      oppId: opp.id,
      input: { stage_id: targetStageId },
    });
  };

  const handleMarkWon = async () => {
    await closeWonMutation.mutateAsync();
  };

  const handleConfirmLoss = async (lossReason: string, notes?: string) => {
    await closeLostMutation.mutateAsync({ loss_reason: lossReason, notes });
  };

  const handleDelete = () => {
    setIsDeleteOpen(true);
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
    if (!val) return "Not set";
    return new Date(val).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1 pl-1 text-muted-foreground hover:text-foreground">
          <Link href="/opportunities">
            <ArrowLeft className="w-4 h-4" />
            <span>Opportunities</span>
          </Link>
        </Button>
      </div>

      {/* Header Banner */}
      <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{opp.name}</h1>
            <StageBadge
              stageName={opp.stage_name}
              status={opp.status}
              isWon={opp.status === "won"}
              isLost={opp.status === "lost"}
            />
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
            {opp.account_name && (
              <Link
                href={`/accounts/${opp.account_id}`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span>{opp.account_name}</span>
              </Link>
            )}
            {opp.expected_close_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Close: {formatDate(opp.expected_close_date)}</span>
              </div>
            )}
            {opp.owner_name && (
              <div className="flex items-center gap-1.5">
                <UserIcon className="w-4 h-4" />
                <span>Owner: {opp.owner_name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          {opp.status !== "won" && (
            <Button
              onClick={handleMarkWon}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Won</span>
            </Button>
          )}

          {opp.status !== "lost" && (
            <Button
              variant="outline"
              onClick={() => setIsLossOpen(true)}
              className="gap-1.5 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            >
              <XCircle className="w-4 h-4" />
              <span>Mark Lost</span>
            </Button>
          )}

          <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-1.5">
            <Pencil className="w-4 h-4" />
            <span>Edit</span>
          </Button>

          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Visual Pipeline Chevron Progression */}
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {stages.map((stg) => {
              const isCurrent = stg.id === opp.stage_id;
              let badgeBg = "bg-muted text-muted-foreground hover:bg-muted/80";
              if (isCurrent) {
                if (stg.is_won) {
                  badgeBg = "bg-emerald-600 text-white font-semibold ring-2 ring-emerald-400/30";
                } else if (stg.is_lost) {
                  badgeBg = "bg-rose-600 text-white font-semibold ring-2 ring-rose-400/30";
                } else {
                  badgeBg = "bg-primary text-primary-foreground font-semibold ring-2 ring-primary/30";
                }
              }

              return (
                <button
                  key={stg.id}
                  onClick={() => handleStageClick(stg.id)}
                  className={`px-3 py-2 rounded-lg text-xs transition-all text-center flex flex-col items-center justify-center gap-0.5 border border-border/50 ${badgeBg}`}
                >
                  <span className="truncate w-full block font-medium">{stg.name}</span>
                  <span className="text-[10px] opacity-80">{stg.probability}%</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Financial & Deal Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Deal Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(opp.amount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{opp.currency} total contract value</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Weighted Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-primary">
              {formatCurrency(opp.weighted_amount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              At {opp.probability}% win probability
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pipeline & Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold text-foreground truncate">
              {opp.stage_name}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {opp.pipeline_name || "Standard Sales Pipeline"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Details + Stage History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Details & Account Information */}
        <div className="lg:col-span-2 space-y-6">
          {opp.status === "lost" && opp.loss_reason && (
            <Card className="border-rose-500/30 bg-rose-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Closed Lost Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground font-medium">{opp.loss_reason}</p>
                {opp.lost_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Closed on {formatDate(opp.lost_at)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Deal Context & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {opp.notes || "No additional notes provided for this deal."}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Created At</span>
                  <span className="font-medium text-foreground">{formatDate(opp.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Last Updated</span>
                  <span className="font-medium text-foreground">{formatDate(opp.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Associated Stakeholders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Stakeholders & Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-3.5 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground block">Company Account</span>
                  {opp.account_name ? (
                    <Link
                      href={`/accounts/${opp.account_id}`}
                      className="text-sm font-semibold text-primary hover:underline block"
                    >
                      {opp.account_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </div>

                <div className="rounded-lg border p-3.5 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground block">Primary Contact</span>
                  {opp.primary_contact_name ? (
                    <Link
                      href={`/contacts/${opp.primary_contact_id}`}
                      className="text-sm font-semibold text-primary hover:underline block"
                    >
                      {opp.primary_contact_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">None specified</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 col): Stage History Timeline */}
        <div>
          <StageHistoryTimeline history={opp.stage_history || []} />
        </div>
      </div>

      {/* Edit Dialog */}
      <OpportunityDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        opportunity={opp}
      />

      {/* Loss Reason Dialog */}
      <OpportunityLossDialog
        open={isLossOpen}
        onOpenChange={setIsLossOpen}
        opportunityName={opp.name}
        onConfirm={handleConfirmLoss}
      />

      {/* Delete Opportunity Dialog */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Opportunity"
        description={
          <>
            Are you sure you want to delete opportunity{" "}
            <strong className="text-foreground">{opp.name}</strong>? This action cannot
            be undone.
          </>
        }
        confirmText="Delete Opportunity"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          await deleteMutation.mutateAsync();
          router.push("/opportunities");
        }}
      />
    </div>
  );
}
