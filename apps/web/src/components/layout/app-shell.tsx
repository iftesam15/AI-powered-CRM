import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SessionProvider } from "@/providers/session-provider";
import type { Session } from "@/types/session";

/**
 * Authenticated shell. The session is resolved on the server by the dashboard
 * layout and injected here, so the sidebar knows the user, tenant and
 * permissions on first paint.
 */
export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Topbar />
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
