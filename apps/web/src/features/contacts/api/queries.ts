import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from "@/lib/constants";
import type { Paginated } from "@/types/api";
import type {
  ContactCreateInput,
  ContactDuplicateCheckResponse,
  ContactListFilters,
  ContactUpdateInput,
  CrmContact,
} from "@/features/contacts/types";

export interface ContactPage {
  items: CrmContact[];
  total: number;
  limit: number;
  offset: number;
}

function toQueryString(filters: ContactListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? DEFAULT_PAGE_SIZE));
  params.set("offset", String(filters.offset ?? 0));

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.account_id) params.set("account_id", filters.account_id);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.desc) params.set("desc", "true");

  return params.toString();
}

export function contactsQueryOptions(filters: ContactListFilters = {}) {
  const query = toQueryString(filters);
  return queryOptions({
    queryKey: [...QUERY_KEYS.contacts, query],
    queryFn: async (): Promise<ContactPage> => {
      return api.get<Paginated<CrmContact>>(`/contacts?${query}`);
    },
    placeholderData: (previous) => previous,
  });
}

export function contactDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: [...QUERY_KEYS.contacts, "detail", id],
    queryFn: async (): Promise<CrmContact> => {
      return api.get<CrmContact>(`/contacts/${id}`);
    },
    enabled: Boolean(id),
  });
}

export function accountContactsQueryOptions(accountId: string) {
  return queryOptions({
    queryKey: [...QUERY_KEYS.contacts, "account", accountId],
    queryFn: async (): Promise<CrmContact[]> => {
      return api.get<CrmContact[]>(`/accounts/${accountId}/contacts`);
    },
    enabled: Boolean(accountId),
  });
}

export function checkDuplicateContact(email: string) {
  return api.get<ContactDuplicateCheckResponse>(
    `/contacts/check-duplicate?email=${encodeURIComponent(email)}`
  );
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContactCreateInput): Promise<CrmContact> => {
      return api.post<CrmContact>("/contacts", payload);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success(`Contact '${created.first_name} ${created.last_name}' created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create contact");
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: ContactUpdateInput;
    }): Promise<CrmContact> => {
      return api.patch<CrmContact>(`/contacts/${id}`, payload);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success(`Contact '${updated.first_name} ${updated.last_name}' updated`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update contact");
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      return api.delete(`/contacts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      toast.success("Contact deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete contact");
    },
  });
}
