"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { env } from "@/config/env";
import { CURRENT_SPRINT, navigation, type NavItem } from "@/config/navigation";
import { UserMenu } from "@/features/auth/components/user-menu";
import { useOptionalSession } from "@/features/auth/hooks/use-session";
import { can } from "@/lib/permissions";
import { routes } from "@/config/routes";

function useVisibleItems() {
  const session = useOptionalSession();
  return (items: NavItem[]) =>
    items.filter((item) => !item.permission || can(session, item.permission));
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const shipped = item.sprint <= CURRENT_SPRINT;

  if (!shipped) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled
          tooltip={`Planned for sprint ${item.sprint}`}
          className="cursor-not-allowed opacity-50"
        >
          <item.icon aria-hidden />
          <span>{item.title}</span>
          <Badge
            variant="outline"
            className="ml-auto border-sidebar-border/60 px-1.5 py-0 text-[10px] font-normal"
          >
            S{item.sprint}
          </Badge>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
        <Link href={item.href}>
          <item.icon aria-hidden />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const visible = useVisibleItems();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={routes.dashboard}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-primary-foreground">
                  <Route className="size-4" aria-hidden />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">
                    {env.NEXT_PUBLIC_APP_NAME}
                  </span>
                  <span className="truncate text-xs opacity-70">Sales workspace</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/*
        The nav fits without scrolling down to roughly a 700px viewport. Below
        that it still has to scroll, so the scrollbar is styled down to a thin
        track that reads as part of the panel rather than as browser chrome.
      */}
      <SidebarContent className="[scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-border [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:bg-transparent">
        {navigation.map((section) => {
          const items = visible(section.items);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(item.href)} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
