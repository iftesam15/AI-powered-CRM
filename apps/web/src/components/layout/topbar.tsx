"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { StylePresetToggle } from "@/components/shared/style-preset-toggle";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { env } from "@/config/env";
import { navigation, settingsNavigation } from "@/config/navigation";
import { useSession } from "@/features/auth/hooks/use-session";
import { SearchCommand } from "@/features/search/components/search-command";

const ALL_ITEMS = [...navigation.flatMap((s) => s.items), ...settingsNavigation];

function useCurrentTitle() {
  const pathname = usePathname();
  const match = ALL_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.title ?? "Dashboard";
}

export function Topbar() {
  const { tenant } = useSession();
  const title = useCurrentTitle();
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {tenant.name}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {env.NEXT_PUBLIC_USE_MOCK_API ? (
          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            Mock API
          </Badge>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchOpen(true)}
          className="gap-2 text-muted-foreground"
          title="Search CRM (Cmd+K)"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

        <StylePresetToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
