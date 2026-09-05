import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from "@/lib/constants";
import type { Paginated } from "@/types/api";
import {
  toAuditEntry,
  type AuditEntry,
  type AuditEntryWire,
} from "@/features/audit/types";

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

function toQueryString(filters: AuditFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? DEFAULT_PAGE_SIZE));
  params.set("offset", String(filters.offset ?? 0));

  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entity_type", filters.entityType);
  if (filters.entityId) params.set("entity_id", filters.entityId);
  if (filters.actorUserId) params.set("actor_user_id", filters.actorUserId);
  return params.toString();
}

export function auditQueryOptions(filters: AuditFilters = {}) {
  const query = toQueryString(filters);
  return queryOptions({
    queryKey: [...QUERY_KEYS.audit, query],
    queryFn: async (): Promise<AuditPage> => {
      const page = await api.get<Paginated<AuditEntryWire>>(`/audit?${query}`);
      return { ...page, items: page.items.map(toAuditEntry) };
    },
    placeholderData: (previous) => previous,
    // The log is append-only and read to investigate something that already
    // happened, so a short window of staleness costs nothing.
    staleTime: 30_000,
  });
}

export const auditActionsQueryOptions = queryOptions({
  queryKey: [...QUERY_KEYS.audit, "actions"],
  queryFn: () => api.get<string[]>("/audit/actions"),
  staleTime: 60 * 60 * 1000,
});
