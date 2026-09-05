import { queryOptions } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { QUERY_KEYS } from "@/lib/constants";
import type { Session } from "@/types/session";

/**
 * The session comes from the BFF route, not from FastAPI directly, because the
 * token that identifies it is an httpOnly cookie the browser cannot read.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: QUERY_KEYS.session,
  queryFn: () => apiRequest<Session>("/api/auth/session", { proxy: false }),
  staleTime: 60_000,
  retry: false,
});
