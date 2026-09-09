import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from "@/lib/constants";
import type { Paginated } from "@/types/api";
import type {
  CrmOpportunity,
  OpportunityCreateInput,
  OpportunityListFilters,
  OpportunityUpdateInput,
  PipelineSummaryResponse,
  StageMoveInput,
} from "@/features/opportunities/types";

export interface OpportunityPage {
  items: CrmOpportunity[];
  total: number;
  limit: number;
  offset: number;
}

function toQueryString(filters: OpportunityListFilters): string {
  const params = new URLSearchParams();
  const rawLimit = Number(filters.limit ?? DEFAULT_PAGE_SIZE);
  const safeLimit = Math.min(Math.max(isNaN(rawLimit) ? DEFAULT_PAGE_SIZE : rawLimit, 1), 100);
  params.set("limit", String(safeLimit));
  params.set("offset", String(filters.offset ?? 0));

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.pipeline_id) params.set("pipeline_id", filters.pipeline_id);
  if (filters.stage_id) params.set("stage_id", filters.stage_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.owner_id) params.set("owner_id", filters.owner_id);
  if (filters.account_id) params.set("account_id", filters.account_id);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.desc) params.set("order", "desc");
  else if (filters.desc === false) params.set("order", "asc");

  return params.toString();
}

export function opportunitiesQueryOptions(filters: OpportunityListFilters = {}) {
  const query = toQueryString(filters);
  return queryOptions({
    queryKey: [...QUERY_KEYS.opportunities, query],
    queryFn: async (): Promise<OpportunityPage> => {
      return api.get<Paginated<CrmOpportunity>>(`/opportunities?${query}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function opportunityDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...QUERY_KEYS.opportunities, "detail", id],
    queryFn: async (): Promise<CrmOpportunity> => {
      return api.get<CrmOpportunity>(`/opportunities/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function pipelineSummaryQueryOptions(pipelineId?: string) {
  const param = pipelineId ? `?pipeline_id=${pipelineId}` : "";
  return queryOptions({
    queryKey: [...QUERY_KEYS.opportunities, "summary", pipelineId ?? "default"],
    queryFn: async (): Promise<PipelineSummaryResponse> => {
      return api.get<PipelineSummaryResponse>(`/opportunities/summary${param}`);
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OpportunityCreateInput): Promise<CrmOpportunity> => {
      return api.post<CrmOpportunity>("/opportunities", payload);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success(`Created deal "${created.name}"`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to create opportunity");
    },
  });
}

export function useUpdateOpportunity(oppId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OpportunityUpdateInput): Promise<CrmOpportunity> => {
      return api.patch<CrmOpportunity>(`/opportunities/${oppId}`, payload);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success(`Updated deal "${updated.name}"`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update opportunity");
    },
  });
}

export function useMoveOpportunityStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      oppId,
      input,
    }: {
      oppId: string;
      input: StageMoveInput;
    }): Promise<CrmOpportunity> => {
      return api.post<CrmOpportunity>(`/opportunities/${oppId}/move-stage`, input);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success(`Moved to ${updated.stage_name || "new stage"}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to move opportunity stage");
    },
  });
}

export function useCloseOpportunityWon(oppId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { oppId?: string; notes?: string } | void): Promise<CrmOpportunity> => {
      const targetId = input?.oppId || oppId;
      if (!targetId) throw new Error("Opportunity ID is required");
      return api.post<CrmOpportunity>(`/opportunities/${targetId}/won`, { notes: input?.notes });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success(`Deal marked as Won! 🎉`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to close opportunity as won");
    },
  });
}

export function useCloseOpportunityLost(oppId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oppId?: string; loss_reason: string; notes?: string }): Promise<CrmOpportunity> => {
      const targetId = input.oppId || oppId;
      if (!targetId) throw new Error("Opportunity ID is required");
      return api.post<CrmOpportunity>(`/opportunities/${targetId}/lost`, {
        loss_reason: input.loss_reason,
        notes: input.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success(`Deal closed as Lost`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to close opportunity as lost");
    },
  });
}

export function useDeleteOpportunity(oppId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id?: string | void): Promise<void> => {
      const targetId = id || oppId;
      if (!targetId) throw new Error("Opportunity ID is required");
      return api.delete(`/opportunities/${targetId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      toast.success("Opportunity deleted");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete opportunity");
    },
  });
}
