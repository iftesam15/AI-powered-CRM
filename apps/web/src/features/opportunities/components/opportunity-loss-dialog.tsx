"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OpportunityLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityName?: string;
  onConfirm: (lossReason: string, notes?: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

const COMMON_REASONS = [
  "Price / Budget constraints",
  "Competitor selected",
  "Product feature gap",
  "Project canceled / Deferred indefinitely",
  "Lost champion / Internal reorganization",
  "Poor timing / No current need",
];

export function OpportunityLossDialog({
  open,
  onOpenChange,
  opportunityName,
  onConfirm,
  isSubmitting: externalSubmitting,
}: OpportunityLossDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [internalSubmitting, setInternalSubmitting] = useState(false);

  const isSubmitting = externalSubmitting ?? internalSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Loss reason is mandatory to close deal as Lost.");
      return;
    }

    try {
      setInternalSubmitting(true);
      setError(null);
      await onConfirm(cleanReason, notes.trim() || undefined);
      setReason("");
      setNotes("");
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark opportunity as lost");
    } finally {
      setInternalSubmitting(false);
    }
  };

  const handleReasonClick = (prefill: string) => {
    setReason(prefill);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Mark Deal as Closed Lost
            </DialogTitle>
            <DialogDescription>
              {opportunityName
                ? `Please provide a reason why "${opportunityName}" was lost. This helps improve sales forecasting and win-rate analysis.`
                : "A reason is strictly required before moving this opportunity to Closed Lost."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Quick Select Common Reasons:
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleReasonClick(r)}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors border border-border"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loss_reason">
                Loss Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="loss_reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Specific reason (e.g. Competitor undercut by 15% on freight volume)..."
                className="resize-none h-20"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loss_notes">Additional Context / Follow-up Notes (Optional)</Label>
              <Textarea
                id="loss_notes"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Any follow-up details or future re-engagement date..."
                className="resize-none h-16"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim() || isSubmitting}
            >
              {isSubmitting ? "Marking Lost..." : "Confirm Closed Lost"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
