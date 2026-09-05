import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, QUERY_KEYS } from "@/lib/constants";
import type { Paginated } from "@/types/api";
import {
  toCrmUser,
  type CrmUser,
  type RoleOption,
  type RoleWire,
  type UserListFilters,
  type UserWire,
} from "@/features/users/types";

/**
 * The only place that knows the backend's snake_case naming for users.
 * Components consume `CrmUser`.
 */

export interface UserPage {
  items: CrmUser[];
  total: number;
  limit: number;
  offset: number;
}

function toQueryString(filters: UserListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? DEFAULT_PAGE_SIZE));
  params.set("offset", String(filters.offset ?? 0));

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.role && filters.role !== "all") params.set("role", filters.role);
  if (filters.status && filters.status !== "all") {
    params.set("is_active", String(filters.status === "active"));
  }
  return params.toString();
}

export function usersQueryOptions(filters: UserListFilters = {}) {
  const query = toQueryString(filters);
  return queryOptions({
    // The serialised filters are part of the key, so each filter combination
    // caches separately and switching back to a previous one is instant.
    queryKey: [...QUERY_KEYS.users, query],
    queryFn: async (): Promise<UserPage> => {
      const page = await api.get<Paginated<UserWire>>(`/users?${query}`);
      return { ...page, items: page.items.map(toCrmUser) };
    },
    placeholderData: (previous) => previous,
  });
}

export const rolesQueryOptions = queryOptions({
  queryKey: [...QUERY_KEYS.users, "roles"],
  queryFn: async (): Promise<RoleOption[]> => {
    const roles = await api.get<RoleWire[]>("/users/roles");
    return roles.map((role) => ({
      value: role.value,
      label: role.label,
      permissions: role.permissions,
    }));
  },
  // The role catalogue changes when the backend is redeployed, not while
  // somebody is looking at the page.
  staleTime: 60 * 60 * 1000,
});
