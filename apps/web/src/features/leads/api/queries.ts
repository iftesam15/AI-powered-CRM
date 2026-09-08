import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from "@/lib/constants";
import type { Paginated } from "@/types/api";
import type {
  ConvertLeadInput,
  ConvertLeadResponse,
  CrmLead,
  LeadCreateInput,
  LeadListFilters,
  LeadUpdateInput,
} from "@/features/leads/types";

export interface LeadPage {
  items: CrmLead[];
  total: number;
  limit: number;
  offset: number;
}

function toQueryString(filters: LeadListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? DEFAULT_PAGE_SIZE));
  params.set("offset", String(filters.offset ?? 0));

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.is_converted !== undefined) params.set("is_converted", String(filters.is_converted));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.desc) params.set("desc", "true");

  return params.toString();
}

export function leadsQueryOptions(filters: LeadListFilters = {}) {
  const query = toQueryString(filters);
  return queryOptions({
    queryKey: [...QUERY_KEYS.leads, query],
    queryFn: async (): Promise<LeadPage> => {
      return api.get<Paginated<CrmLead>>(`/leads?${query}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function leadDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...QUERY_KEYS.leads, "detail", id],
    queryFn: async (): Promise<CrmLead> => {
      return api.get<CrmLead>(`/leads/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LeadCreateInput): Promise<CrmLead> => {
      return api.post<CrmLead>("/leads", payload);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.leads });
      toast.success(`Lead '${created.first_name} ${created.last_name}' created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create lead");
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: LeadUpdateInput;
    }): Promise<CrmLead> => {
      return api.patch<CrmLead>(`/leads/${id}`, payload);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.leads });
      toast.success(`Lead '${updated.first_name} ${updated.last_name}' updated`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update lead");
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      return api.delete(`/leads/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.leads });
      toast.success("Lead deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete lead");
    },
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: ConvertLeadInput;
    }): Promise<ConvertLeadResponse> => {
      return api.post<ConvertLeadResponse>(`/leads/${id}/convert`, payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.leads });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success(`Lead successfully converted to Contact!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to convert lead");
    },
  });
}
