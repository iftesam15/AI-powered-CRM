"use client";

import React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmOpportunity } from "@/features/opportunities/types";
import { cn } from "@/lib/utils";

interface OpportunityCardProps {
  opportunity: CrmOpportunity;
  isOverlay?: boolean;
  onEdit?: (opp: CrmOpportunity) => void;
  onMarkWon?: (opp: CrmOpportunity) => void;
  onMarkLost?: (opp: CrmOpportunity) => void;
  onDelete?: (opp: CrmOpportunity) => void;
}

export function OpportunityCard({
  opportunity,
  isOverlay = false,
  onEdit,
  onMarkWon,
  onMarkLost,
  onDelete,
}: OpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: opportunity.id,
    data: {
      type: "Opportunity",
      opportunity,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatAmount = (val: string | number, curr: string = "USD") => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr || "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const isWon = opportunity.status === "won";
  const isLost = opportunity.status === "lost";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-xs transition-all",
        "hover:border-primary/50 hover:shadow-sm",
        isDragging && "opacity-30 border-dashed border-primary",
        isOverlay && "rotate-2 shadow-xl border-primary scale-102 cursor-grabbing bg-card/95 backdrop-blur-sm z-50",
        isWon && "border-emerald-500/30 bg-emerald-500/5",
        isLost && "border-rose-500/30 bg-rose-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-0.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded focus-visible:outline-hidden"
            aria-label="Drag opportunity"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            <Link
              href={`/opportunities/${opportunity.id}`}
              className="text-xs font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 group-hover:underline"
            >
              {opportunity.name}
            </Link>

            {opportunity.account_name && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{opportunity.account_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card Actions Menu */}
        {!isOverlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity p-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuItem asChild>
                <Link href={`/opportunities/${opportunity.id}`} className="flex items-center">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(opportunity)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Deal
                </DropdownMenuItem>
              )}
              {!isWon && !isLost && onMarkWon && (
                <DropdownMenuItem
                  onClick={() => onMarkWon(opportunity)}
                  className="text-emerald-600 focus:text-emerald-600"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                  Mark as Won
                </DropdownMenuItem>
              )}
              {!isWon && !isLost && onMarkLost && (
                <DropdownMenuItem
                  onClick={() => onMarkLost(opportunity)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="w-3.5 h-3.5 mr-2" />
                  Mark as Lost...
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(opportunity)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete Deal
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Amount & Probability Row */}
      <div className="mt-2 flex items-baseline justify-between gap-1 pt-1 border-t border-border/40">
        <span className="text-xs font-bold text-foreground">
          {formatAmount(opportunity.amount, opportunity.currency)}
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 font-medium"
        >
          {opportunity.probability ?? 0}%
        </Badge>
      </div>

      {/* Footer metadata: Close date & Days in Stage */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        {opportunity.expected_close_date ? (
          <div className="flex items-center gap-1" title="Expected Close">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(opportunity.expected_close_date)}</span>
          </div>
        ) : (
          <span />
        )}

        {opportunity.days_in_current_stage !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 font-mono",
              opportunity.days_in_current_stage > 30 && "text-amber-500 font-semibold"
            )}
            title="Days in current stage"
          >
            <Clock className="w-3 h-3" />
            <span>{opportunity.days_in_current_stage}d in stage</span>
          </div>
        )}
      </div>
    </div>
  );
}
