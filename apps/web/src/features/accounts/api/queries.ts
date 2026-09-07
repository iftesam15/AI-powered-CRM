import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from "@/lib/constants";
import type { Paginated } from "@/types/api";
import type {
  AccountCreateInput,
  AccountListFilters,
  AccountUpdateInput,
  CrmAccount,
} from "@/features/accounts/types";

export interface AccountPage {
  items: CrmAccount[];
  total: number;
  limit: number;
  offset: number;
}

function toQueryString(filters: AccountListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? DEFAULT_PAGE_SIZE));
  params.set("offset", String(filters.offset ?? 0));

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.industry && filters.industry !== "all") {
    params.set("industry", filters.industry);
  }
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.desc) params.set("desc", "true");

  return params.toString();
}

export function accountsQueryOptions(filters: AccountListFilters = {}) {
  const query = toQueryString(filters);
  return queryOptions({
    queryKey: [...QUERY_KEYS.accounts, query],
    queryFn: async (): Promise<AccountPage> => {
      return api.get<Paginated<CrmAccount>>(`/accounts?${query}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function accountDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...QUERY_KEYS.accounts, "detail", id],
    queryFn: async (): Promise<CrmAccount> => {
      return api.get<CrmAccount>(`/accounts/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AccountCreateInput): Promise<CrmAccount> => {
      return api.post<CrmAccount>("/accounts", payload);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success(`Account '${created.name}' created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create account");
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: AccountUpdateInput;
    }): Promise<CrmAccount> => {
      return api.patch<CrmAccount>(`/accounts/${id}`, payload);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success(`Account '${updated.name}' updated`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update account");
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      return api.delete(`/accounts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success("Account deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete account");
    },
  });
}
