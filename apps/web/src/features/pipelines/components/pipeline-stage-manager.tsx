"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GitCommit,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStageDialog } from "./pipeline-stage-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  defaultPipelineQueryOptions,
  useDeleteStage,
  useReorderStages,
} from "@/features/pipelines/api/queries";
import type { CrmPipelineStage } from "@/features/pipelines/types";

export function PipelineStageManager() {
  const { data: pipeline, isLoading } = useQuery(defaultPipelineQueryOptions());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<CrmPipelineStage | null>(null);
  const [deletingStage, setDeletingStage] = useState<CrmPipelineStage | null>(null);

  const pipelineId = pipeline?.id || "";
  const reorderMutation = useReorderStages(pipelineId);
  const deleteMutation = useDeleteStage(pipelineId);

  const stages = [...(pipeline?.stages || [])].sort((a, b) => a.display_order - b.display_order);

  const handleOpenCreate = () => {
    setEditingStage(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (stage: CrmPipelineStage) => {
    setEditingStage(stage);
    setIsDialogOpen(true);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const [moved] = newStages.splice(index, 1);
    newStages.splice(targetIndex, 0, moved);

    const reorderedPayload = newStages.map((s, idx) => ({
      id: s.id,
      display_order: idx + 1,
    }));

    await reorderMutation.mutateAsync(reorderedPayload);
  };

  const handleDelete = (stage: CrmPipelineStage) => {
    setDeletingStage(stage);
  };

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">Loading pipeline configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Configured Deal Stages</h3>
          <p className="text-xs text-muted-foreground">
            Pipeline: <span className="font-medium text-foreground">{pipeline?.name || "Standard Sales Pipeline"}</span> ({stages.length} stages)
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-1.5 h-9">
          <Plus className="w-4 h-4" />
          Add Stage
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Order</TableHead>
              <TableHead>Stage Name</TableHead>
              <TableHead>Win Probability</TableHead>
              <TableHead>Stage Type</TableHead>
              <TableHead className="w-28 text-center">Reorder</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((stage, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === stages.length - 1;

              return (
                <TableRow key={stage.id} className="hover:bg-muted/40 transition-colors">
                  {/* Display Order */}
                  <TableCell className="text-center font-mono text-xs text-muted-foreground font-semibold">
                    {stage.display_order}
                  </TableCell>

                  {/* Name */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium text-sm text-foreground">{stage.name}</span>
                    </div>
                  </TableCell>

                  {/* Probability */}
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{stage.probability}%</span>
                  </TableCell>

                  {/* Stage Type */}
                  <TableCell>
                    {stage.is_won ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Closed Won
                      </Badge>
                    ) : stage.is_lost ? (
                      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1">
                        <XCircle className="w-3 h-3" />
                        Closed Lost
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        Open Pipeline
                      </Badge>
                    )}
                  </TableCell>

                  {/* Reorder Buttons */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isFirst || reorderMutation.isPending}
                        onClick={() => handleMove(idx, "up")}
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isLast || reorderMutation.isPending}
                        onClick={() => handleMove(idx, "down")}
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(stage)}
                        title="Edit Stage"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(stage)}
                        title="Delete Stage"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pipelineId && (
        <PipelineStageDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          pipelineId={pipelineId}
          stage={editingStage}
          defaultOrder={stages.length + 1}
        />
      )}

      {/* Delete Stage Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingStage)}
        onOpenChange={(open) => !open && setDeletingStage(null)}
        title="Delete Pipeline Stage"
        description={
          <>
            Are you sure you want to delete stage{" "}
            <strong className="text-foreground">{deletingStage?.name}</strong>? If there
            are active opportunities in this stage, deletion will be blocked by the server.
          </>
        }
        confirmText="Delete Stage"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deletingStage) {
            await deleteMutation.mutateAsync(deletingStage.id);
            setDeletingStage(null);
          }
        }}
      />
    </div>
  );
}
