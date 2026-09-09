"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Contact, Search, Target, TrendingUp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useSearch } from "../api/queries";
import type { EntityType, SearchResultItem } from "../types";

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  account: Building2,
  contact: Contact,
  lead: Target,
  opportunity: TrendingUp,
};

const ENTITY_COLORS: Record<EntityType, string> = {
  account: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  contact: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  lead: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  opportunity: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
};

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const { data, isLoading } = useSearch(query);

  const handleSelect = (item: SearchResultItem) => {
    onOpenChange(false);
    setQuery("");
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      onOpenChange(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="sr-only">Search CRM</DialogTitle>
          <div className="flex items-center gap-2 px-1">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search accounts, contacts, leads, opportunities... (Press Enter for full results)"
              className="border-0 shadow-none focus-visible:ring-0 text-base h-9 p-0"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="max-h-[350px] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search across all CRM records.
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Matches ({data.total})
              </div>
              {data.items.map((item) => {
                const Icon = ENTITY_ICONS[item.entity_type] || Search;
                return (
                  <button
                    key={`${item.entity_type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-accent text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-md border ${ENTITY_COLORS[item.entity_type]}`}>
                        <Icon className="size-4 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate group-hover:text-accent-foreground">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0 ml-2">
                      {item.entity_type}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {query.trim().length >= 2 && data && data.items.length > 0 && (
          <div className="border-t p-2 bg-muted/40 text-center">
            <button
              onClick={() => {
                onOpenChange(false);
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="text-xs text-primary font-medium hover:underline"
            >
              View all results for "{query}" →
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
