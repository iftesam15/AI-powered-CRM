"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api-client";
import { QUERY_KEYS } from "@/lib/constants";
import { toCrmUser, type CrmUser, type UserWire } from "@/features/users/types";
import type { Role } from "@/types/session";

interface CreateUserPayload {
  email: string;
  fullName: string;
  role: Role;
  password: string;
}

interface UpdateUserPayload {
  id: string;
  fullName?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * Both mutations invalidate the whole `users` key rather than patching one row
 * in the cache. A change can move a user in or out of the active filter or the
 * current page, so the honest thing is to re-ask the server what the list is.
 *
 * The audit key is invalidated too: every mutation here writes a trail entry,
 * and an admin who has both tabs open should not see a stale log.
 */
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.audit });
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: async (payload: CreateUserPayload): Promise<CrmUser> => {
      const created = await api.post<UserWire>("/users", {
        email: payload.email,
        full_name: payload.fullName,
        role: payload.role,
        password: payload.password,
      });
      return toCrmUser(created);
    },
    onSuccess: (user) => {
      invalidate();
      toast.success(`${user.fullName} can now sign in.`);
    },
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();

  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateUserPayload): Promise<CrmUser> => {
      const body: Record<string, unknown> = {};
      if (patch.fullName !== undefined) body.full_name = patch.fullName;
      if (patch.role !== undefined) body.role = patch.role;
      if (patch.isActive !== undefined) body.is_active = patch.isActive;

      const updated = await api.patch<UserWire>(`/users/${id}`, body);
      return toCrmUser(updated);
    },
    onSuccess: () => invalidate(),
  });
}
