"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface HealthPayload {
  mode: "mock" | "live";
  apiUrl: string;
  api: {
    reachable: boolean;
    detail: string;
    upstream: { version: string; environment: string } | null;
  };
}

/**
 * Small connection indicator. Sprint 0's demo is being able to open the web app
 * and see that the API is up, and it stays useful afterwards as the first thing
 * to look at when the app misbehaves locally.
 */
export function ApiStatus({ className }: { className?: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiRequest<HealthPayload>("/api/health", { proxy: false }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const state = isPending
    ? ("checking" as const)
    : isError || !data?.api.reachable
      ? ("down" as const)
      : ("up" as const);

  // Mocked auth and a live backend are independent, so the suffix is additive
  // rather than a separate state.
  const mockSuffix = data?.mode === "mock" ? " · mock auth" : "";

  const label = {
    checking: "Checking API",
    up: `API healthy${data?.api.upstream ? ` · v${data.api.upstream.version}` : ""}${mockSuffix}`,
    down: `${data?.api.detail ?? "API unreachable"}${mockSuffix}`,
  }[state];

  const dot = {
    checking: "bg-muted-foreground/40",
    up: "bg-chart-5",
    down: "bg-destructive",
  }[state];

  return (
    <p
      className={cn("flex items-center gap-2 text-xs", className)}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          dot,
          state === "checking" && "animate-pulse motion-reduce:animate-none",
        )}
        aria-hidden
      />
      {label}
    </p>
  );
}
