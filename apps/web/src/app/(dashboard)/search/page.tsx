"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, Contact, Search as SearchIcon, Target, TrendingUp } from "lucide-react";

import { useSearch } from "@/features/search/api/queries";
import type { EntityType } from "@/features/search/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [searchTerm, setSearchTerm] = React.useState(initialQuery);
  const [activeFilter, setActiveFilter] = React.useState<string>("all");

  const { data, isLoading } = useSearch(searchTerm);

  const filteredItems = React.useMemo(() => {
    if (!data?.items) return [];
    if (activeFilter === "all") return data.items;
    return data.items.filter((item) => item.entity_type === activeFilter);
  }, [data?.items, activeFilter]);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Global Search</h1>
        <p className="text-muted-foreground text-sm">
          Search across accounts, contacts, leads, and opportunities.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <SearchIcon className="size-5 text-muted-foreground shrink-0" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, company, title..."
              className="text-base"
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {searchTerm.trim().length >= 2 && data && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            All Results ({data.total})
          </button>
          {(["account", "contact", "lead", "opportunity"] as EntityType[]).map((type) => {
            const count = data.items.filter((i) => i.entity_type === type).length;
            if (count === 0 && activeFilter !== type) return null;
            return (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${
                  activeFilter === type
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {type}s ({count})
              </button>
            );
          })}
        </div>
      )}

      {searchTerm.trim().length < 2 ? (
        <Card className="py-12 text-center text-muted-foreground">
          Type at least 2 characters to search.
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          No matching records found for "{searchTerm}".
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => {
            const Icon = ENTITY_ICONS[item.entity_type] || SearchIcon;
            return (
              <Link key={`${item.entity_type}-${item.id}`} href={item.href}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-2.5 rounded-lg border ${ENTITY_COLORS[item.entity_type]}`}>
                        <Icon className="size-5 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-sm text-muted-foreground truncate">{item.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0 ml-3">
                      {item.entity_type}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
