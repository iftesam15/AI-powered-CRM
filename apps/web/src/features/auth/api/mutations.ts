"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api-client";
import { QUERY_KEYS } from "@/lib/constants";
import { routes } from "@/config/routes";
import type { Session } from "@/types/session";
import type { ForgotPasswordResponse } from "@/features/auth/types";

interface LoginPayload {
  email: string;
  password: string;
}

export function useLogin(redirectTo: string = routes.dashboard) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiRequest<Session>("/api/auth/login", {
        proxy: false,
        method: "POST",
        body: payload,
      }),
    onSuccess: (session) => {
      queryClient.setQueryData(QUERY_KEYS.session, session);
      router.replace(redirectTo);
      // The dashboard shell is server rendered, so the route cache has to be
      // refreshed for the new session to be reflected.
      router.refresh();
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/auth/logout", { proxy: false, method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      router.replace(routes.login);
      router.refresh();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: { email: string }) =>
      apiRequest<ForgotPasswordResponse>("/api/auth/forgot-password", {
        proxy: false,
        method: "POST",
        body: payload,
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { token: string; password: string }) =>
      apiRequest<void>("/api/auth/reset-password", {
        proxy: false,
        method: "POST",
        body: payload,
      }),
  });
}
