"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateStage, useUpdateStage } from "@/features/pipelines/api/queries";
import type { CrmPipelineStage } from "@/features/pipelines/types";

const stageSchema = z.object({
  name: z.string().min(1, "Stage name is required").max(100),
  probability: z.string().refine(
    (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100),
    "Probability must be between 0 and 100"
  ),
  stage_type: z.enum(["open", "won", "lost"]),
});

type StageFormValues = z.infer<typeof stageSchema>;

interface PipelineStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stage?: CrmPipelineStage | null;
  defaultOrder?: number;
}

export function PipelineStageDialog({
  open,
  onOpenChange,
  pipelineId,
  stage,
  defaultOrder = 0,
}: PipelineStageDialogProps) {
  const isEditing = Boolean(stage);
  const createMutation = useCreateStage(pipelineId);
  const updateMutation = useUpdateStage(pipelineId);

  const getStageType = (s?: CrmPipelineStage | null): "open" | "won" | "lost" => {
    if (!s) return "open";
    if (s.is_won) return "won";
    if (s.is_lost) return "lost";
    return "open";
  };

  const form = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: stage?.name || "",
      probability: stage ? String(stage.probability) : "20",
      stage_type: getStageType(stage),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: stage?.name || "",
        probability: stage ? String(stage.probability) : "20",
        stage_type: getStageType(stage),
      });
    }
  }, [open, stage, form]);

  const watchedType = form.watch("stage_type");

  // Auto-fill typical probabilities for won/lost
  const handleTypeChange = (type: "open" | "won" | "lost") => {
    form.setValue("stage_type", type);
    if (type === "won") {
      form.setValue("probability", "100");
    } else if (type === "lost") {
      form.setValue("probability", "0");
    }
  };

  const onSubmit = async (values: StageFormValues) => {
    const is_won = values.stage_type === "won";
    const is_lost = values.stage_type === "lost";
    const probability = Number(values.probability || 0);

    if (isEditing && stage) {
      await updateMutation.mutateAsync({
        stageId: stage.id,
        data: {
          name: values.name.trim(),
          probability,
          is_won,
          is_lost,
        },
      });
    } else {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        probability,
        is_won,
        is_lost,
        display_order: defaultOrder,
      });
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Pipeline Stage" : "Add Pipeline Stage"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update stage name, default probability, or outcome status."
              : "Define a new milestone stage for your sales pipeline."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Contract Review" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage Outcome Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(val: "open" | "won" | "lost") => handleTypeChange(val)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Open Pipeline (Active deal flow)</SelectItem>
                      <SelectItem value="won">Closed Won (Successful deal close)</SelectItem>
                      <SelectItem value="lost">Closed Lost (Unsuccessful deal close)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    Outcome flags are strictly mutually exclusive.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="probability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Win Probability (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="0 - 100"
                      disabled={watchedType === "won" || watchedType === "lost"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Used to calculate weighted revenue forecast for open pipeline deals.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Stage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
