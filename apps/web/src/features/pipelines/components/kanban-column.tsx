"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OpportunityCard } from "./opportunity-card";
import type { CrmPipelineStage } from "@/features/pipelines/types";
import type { CrmOpportunity } from "@/features/opportunities/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: CrmPipelineStage;
  opportunities: CrmOpportunity[];
  onAddDeal?: (stageId: string) => void;
  onEditDeal?: (opp: CrmOpportunity) => void;
  onMarkWon?: (opp: CrmOpportunity) => void;
  onMarkLost?: (opp: CrmOpportunity) => void;
  onDeleteDeal?: (opp: CrmOpportunity) => void;
}

export function KanbanColumn({
  stage,
  opportunities,
  onAddDeal,
  onEditDeal,
  onMarkWon,
  onMarkLost,
  onDeleteDeal,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: "Column",
      stage,
    },
  });

  const totalValue = opportunities.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStageTheme = () => {
    if (stage.is_won) {
      return {
        dotColor: "bg-emerald-500",
        borderActive: "border-emerald-500/50 ring-emerald-500/20",
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    }
    if (stage.is_lost) {
      return {
        dotColor: "bg-rose-500",
        borderActive: "border-rose-500/50 ring-rose-500/20",
        badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      };
    }
    return {
      dotColor: "bg-primary",
      borderActive: "border-primary/50 ring-primary/20",
      badgeBg: "bg-muted text-muted-foreground",
    };
  };

  const theme = getStageTheme();
  const oppIds = opportunities.map((o) => o.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[300px] shrink-0 rounded-xl border bg-muted/20 pb-3 transition-colors",
        isOver && "ring-2 ring-offset-1 bg-muted/40",
        isOver && theme.borderActive
      )}
    >
      {/* Column Header */}
      <div className="p-3 pb-2 border-b border-border/40 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("w-2 h-2 rounded-full shrink-0", theme.dotColor)} />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
              {stage.name}
            </h3>
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.2 rounded-full",
                theme.badgeBg
              )}
            >
              {opportunities.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-muted-foreground">
              {stage.probability}%
            </span>
            {onAddDeal && !stage.is_won && !stage.is_lost && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => onAddDeal(stage.id)}
                title={`Add deal to ${stage.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Column Total Value */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>Stage total</span>
          <span className="font-semibold text-foreground">{formatMoney(totalValue)}</span>
        </div>
      </div>

      {/* Droppable Card List */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[140px]">
        <SortableContext items={oppIds} strategy={verticalListSortingStrategy}>
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onEdit={onEditDeal}
              onMarkWon={onMarkWon}
              onMarkLost={onMarkLost}
              onDelete={onDeleteDeal}
            />
          ))}
        </SortableContext>

        {opportunities.length === 0 && (
          <div className="h-28 flex flex-col items-center justify-center border border-dashed rounded-lg border-border/60 text-muted-foreground/60 text-xs">
            <span>No deals</span>
          </div>
        )}
      </div>
    </div>
  );
}
