"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, DollarSign, Target, TrendingUp } from "lucide-react";

import { pipelineSummaryQueryOptions } from "@/features/opportunities/api/queries";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineMetricsBarProps {
  pipelineId?: string;
}

export function PipelineMetricsBar({ pipelineId }: PipelineMetricsBarProps) {
  const { data: summary, isLoading } = useQuery(pipelineSummaryQueryOptions(pipelineId));

  const formatMoney = (amountStr: string | number) => {
    const num = Number(amountStr) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border rounded-xl bg-card/60 backdrop-blur-sm space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const wonValue = Number(summary?.won_value || 0);
  const totalValue = Number(summary?.total_pipeline_value || 0);
  const weightedValue = Number(summary?.weighted_pipeline_value || 0);
  const openDealsCount = summary?.stages
    ?.filter((s) => !s.is_won && !s.is_lost)
    .reduce((acc, s) => acc + s.count, 0) || 0;
  const wonDealsCount = summary?.stages
    ?.filter((s) => s.is_won)
    .reduce((acc, s) => acc + s.count, 0) || 0;

  const totalClosed = wonDealsCount + (summary?.stages?.find((s) => s.is_lost)?.count || 0);
  const winRate = totalClosed > 0 ? Math.round((wonDealsCount / totalClosed) * 100) : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* 1. Total Pipeline */}
      <div className="p-4 border rounded-xl bg-card hover:border-primary/40 transition-colors shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Open Pipeline</span>
          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
          {formatMoney(totalValue)}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {openDealsCount} active {openDealsCount === 1 ? "deal" : "deals"} in pipeline
        </p>
      </div>

      {/* 2. Weighted Forecast */}
      <div className="p-4 border rounded-xl bg-card hover:border-primary/40 transition-colors shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Weighted Forecast</span>
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
          {formatMoney(weightedValue)}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">Probability-adjusted revenue</p>
      </div>

      {/* 3. Closed Won */}
      <div className="p-4 border rounded-xl bg-card hover:border-emerald-500/40 transition-colors shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Closed Won</span>
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
          {formatMoney(wonValue)}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {wonDealsCount} won {wonDealsCount === 1 ? "deal" : "deals"}
        </p>
      </div>

      {/* 4. Win Rate / Open Deals */}
      <div className="p-4 border rounded-xl bg-card hover:border-primary/40 transition-colors shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Win Rate</span>
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
            <Target className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
          {winRate !== null ? `${winRate}%` : "—"}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {totalClosed > 0 ? `Across ${totalClosed} closed deals` : "Awaiting initial deal closures"}
        </p>
      </div>
    </div>
  );
}
