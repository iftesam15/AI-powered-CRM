"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CURRENT_SPRINT, settingsNavigation } from "@/config/navigation";
import { useLogout } from "@/features/auth/api/mutations";
import { useSession } from "@/features/auth/hooks/use-session";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { initialsOf } from "@/lib/utils";

/**
 * Settings live here rather than as a sidebar group. Four more nav rows pushed
 * the sidebar past the viewport on any laptop under about 890px tall, and an
 * account menu is where settings are conventionally looked for anyway.
 */
export function UserMenu() {
  const session = useSession();
  const { user, tenant } = session;
  const logout = useLogout();

  const settings = settingsNavigation.filter(
    (item) => !item.permission || can(session, item.permission),
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md bg-sidebar-primary text-xs font-medium text-primary-foreground">
                  {initialsOf(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{user.fullName}</span>
                <span className="truncate text-xs opacity-70">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                {tenant.name} · {tenant.defaultCurrency}
              </p>
            </DropdownMenuLabel>

            {settings.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Settings
                  </DropdownMenuLabel>
                  {settings.map((item) =>
                    item.sprint <= CURRENT_SPRINT ? (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>
                          <item.icon className="size-4" aria-hidden />
                          {item.title}
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem key={item.href} disabled>
                        <item.icon className="size-4" aria-hidden />
                        {item.title}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          S{item.sprint}
                        </span>
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuGroup>
              </>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              disabled={logout.isPending}
              onSelect={(event) => {
                event.preventDefault();
                logout.mutate();
              }}
            >
              <LogOut className="size-4" aria-hidden />
              {logout.isPending ? "Signing out" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
