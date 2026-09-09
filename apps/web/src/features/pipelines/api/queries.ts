import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { QUERY_KEYS } from "@/lib/constants";
import type {
  CrmPipeline,
  CrmPipelineStage,
  PipelineStageCreateInput,
  PipelineStageReorderItem,
  PipelineStageUpdateInput,
} from "@/features/pipelines/types";

export function defaultPipelineQueryOptions() {
  return queryOptions({
    queryKey: [...QUERY_KEYS.pipeline, "default"],
    queryFn: async (): Promise<CrmPipeline> => {
      return api.get<CrmPipeline>("/pipelines/default");
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function pipelineDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...QUERY_KEYS.pipeline, "detail", id],
    queryFn: async (): Promise<CrmPipeline> => {
      return api.get<CrmPipeline>(`/pipelines/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function useCreateStage(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PipelineStageCreateInput): Promise<CrmPipelineStage> => {
      return api.post<CrmPipelineStage>(`/pipelines/${pipelineId}/stages`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pipeline });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success("Stage added successfully");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to add stage");
    },
  });
}

export function useUpdateStage(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stageId,
      data,
    }: {
      stageId: string;
      data: PipelineStageUpdateInput;
    }): Promise<CrmPipelineStage> => {
      return api.patch<CrmPipelineStage>(`/pipelines/${pipelineId}/stages/${stageId}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pipeline });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success("Stage updated successfully");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update stage");
    },
  });
}

export function useDeleteStage(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stageId: string): Promise<void> => {
      return api.delete(`/pipelines/${pipelineId}/stages/${stageId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pipeline });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success("Stage deleted successfully");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete stage. Ensure no opportunities are in this stage."
      );
    },
  });
}

export function useReorderStages(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: PipelineStageReorderItem[]): Promise<CrmPipelineStage[]> => {
      return api.post<CrmPipelineStage[]>(`/pipelines/${pipelineId}/stages/reorder`, { stages });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pipeline });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success("Stages reordered");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to reorder stages");
    },
  });
}
