"use client";

import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { KanbanColumn } from "./kanban-column";
import { OpportunityCard } from "./opportunity-card";
import { OpportunityDialog } from "@/features/opportunities/components/opportunity-dialog";
import { OpportunityLossDialog } from "@/features/opportunities/components/opportunity-loss-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { defaultPipelineQueryOptions } from "@/features/pipelines/api/queries";
import {
  opportunitiesQueryOptions,
  useCloseOpportunityLost,
  useCloseOpportunityWon,
  useDeleteOpportunity,
  useMoveOpportunityStage,
} from "@/features/opportunities/api/queries";
import type { CrmOpportunity } from "@/features/opportunities/types";

export function KanbanBoard() {
  const { data: pipeline, isLoading: isPipelineLoading } = useQuery(defaultPipelineQueryOptions());
  const { data: oppsData, isLoading: isOppsLoading } = useQuery(
    opportunitiesQueryOptions({ limit: 100 })
  );

  const moveStageMutation = useMoveOpportunityStage();
  const closeWonMutation = useCloseOpportunityWon();
  const closeLostMutation = useCloseOpportunityLost();
  const deleteMutation = useDeleteOpportunity();

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>();
  const [editingOpp, setEditingOpp] = useState<CrmOpportunity | null>(null);
  const [lossTargetOpp, setLossTargetOpp] = useState<CrmOpportunity | null>(null);
  const [deletingOpp, setDeletingOpp] = useState<CrmOpportunity | null>(null);

  // Drag State
  const [activeOpportunity, setActiveOpportunity] = useState<CrmOpportunity | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const stages = [...(pipeline?.stages || [])].sort((a, b) => a.display_order - b.display_order);
  const opportunities = oppsData?.items || [];

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const opp = opportunities.find((o) => o.id === active.id);
    if (opp) {
      setActiveOpportunity(opp);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOpportunity(null);

    if (!over) return;

    const activeId = String(active.id);
    const draggedOpp = opportunities.find((o) => o.id === activeId);
    if (!draggedOpp) return;

    let targetStageId: string | null = null;

    // Check if dropped directly on a column
    const overStage = stages.find((s) => s.id === over.id);
    if (overStage) {
      targetStageId = overStage.id;
    } else {
      // Dropped on another opportunity card
      const overOpp = opportunities.find((o) => o.id === over.id);
      if (overOpp) {
        targetStageId = overOpp.stage_id;
      }
    }

    if (!targetStageId || targetStageId === draggedOpp.stage_id) {
      return;
    }

    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    // Handle Closed Lost transition (requires mandatory loss reason)
    if (targetStage.is_lost) {
      setLossTargetOpp(draggedOpp);
      return;
    }

    // Handle Closed Won transition
    if (targetStage.is_won) {
      await closeWonMutation.mutateAsync({ oppId: draggedOpp.id, notes: "Moved to Closed Won on Kanban" });
      return;
    }

    // Standard stage move
    await moveStageMutation.mutateAsync({
      oppId: draggedOpp.id,
      input: { stage_id: targetStageId },
    });
  };

  const handleConfirmLoss = async (lossReason: string, notes?: string) => {
    if (!lossTargetOpp) return;
    await closeLostMutation.mutateAsync({
      oppId: lossTargetOpp.id,
      loss_reason: lossReason,
      notes,
    });
    setLossTargetOpp(null);
  };

  const handleAddDealInStage = (stageId: string) => {
    setSelectedStageId(stageId);
    setEditingOpp(null);
    setIsCreateOpen(true);
  };

  const handleEditDeal = (opp: CrmOpportunity) => {
    setEditingOpp(opp);
    setIsCreateOpen(true);
  };

  const handleMarkWon = async (opp: CrmOpportunity) => {
    await closeWonMutation.mutateAsync({ oppId: opp.id, notes: "Marked won via card menu" });
  };

  const handleMarkLost = (opp: CrmOpportunity) => {
    setLossTargetOpp(opp);
  };

  const handleDeleteDeal = (opp: CrmOpportunity) => {
    setDeletingOpp(opp);
  };

  if (isPipelineLoading || isOppsLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading sales pipeline...</span>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start min-h-[calc(100vh-260px)]">
          {stages.map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stage_id === stage.id);
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                opportunities={stageOpps}
                onAddDeal={handleAddDealInStage}
                onEditDeal={handleEditDeal}
                onMarkWon={handleMarkWon}
                onMarkLost={handleMarkLost}
                onDeleteDeal={handleDeleteDeal}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeOpportunity ? (
            <OpportunityCard opportunity={activeOpportunity} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Opportunity Create / Edit Dialog */}
      {isCreateOpen && (
        <OpportunityDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          opportunity={editingOpp}
          defaultStageId={selectedStageId}
        />
      )}

      {/* Opportunity Loss Dialog */}
      {lossTargetOpp && (
        <OpportunityLossDialog
          open={Boolean(lossTargetOpp)}
          onOpenChange={(open) => !open && setLossTargetOpp(null)}
          opportunityName={lossTargetOpp.name}
          onConfirm={handleConfirmLoss}
          isSubmitting={closeLostMutation.isPending}
        />
      )}

      {/* Delete Opportunity Dialog */}
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
    </>
  );
}
