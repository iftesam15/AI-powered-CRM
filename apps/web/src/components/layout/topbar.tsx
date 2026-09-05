"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/shared/theme-toggle";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { env } from "@/config/env";
import { navigation, settingsNavigation } from "@/config/navigation";
import { useSession } from "@/features/auth/hooks/use-session";

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

        {/* Global search is delivered in sprint 8. The control is shown disabled
            so the shell's information architecture stays honest. */}
        <Button
          variant="outline"
          size="sm"
          disabled
          className="gap-2 text-muted-foreground"
          title="Global search arrives in sprint 8"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </Button>

        <ThemeToggle />
      </div>
    </header>
  );
}
