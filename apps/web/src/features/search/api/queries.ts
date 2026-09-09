import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { QUERY_KEYS } from "@/lib/constants";
import type { SearchResponse } from "../types";

export function useSearch(query: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.search, query],
    queryFn: async () => {
      if (!query || query.trim().length < 2) {
        return { query: "", total: 0, items: [] } as SearchResponse;
      }
      return api.get<SearchResponse>(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });
}
