import { Route } from "lucide-react";
import type { ReactNode } from "react";

import { ApiStatus } from "@/components/layout/api-status";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { env } from "@/config/env";

/**
 * Unauthenticated shell. A split layout keeps the brand panel and the form in
 * separate columns on desktop; below `lg` the panel collapses to a compact
 * header so the form stays above the fold on a phone.
 *
 * The panel carries an explicit right border because in dark mode the preset's
 * `--sidebar` and `--background` sit only 0.03 apart in lightness, so without
 * one the two columns bleed together.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative flex flex-col justify-between border-b border-sidebar-border/60 bg-sidebar px-6 py-8 text-sidebar-foreground lg:border-b-0 lg:border-r lg:px-12 lg:py-14">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-primary-foreground">
            <Route className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            {env.NEXT_PUBLIC_APP_NAME}
          </span>
        </div>

        <div className="hidden max-w-[38ch] space-y-4 lg:block">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Every account, contact and deal in one workspace.
          </h2>
          <p className="text-sm leading-relaxed text-sidebar-foreground/70">
            Your records stay scoped to your organisation. Access is decided by the role
            your administrator assigned to you.
          </p>
        </div>

        <div className="hidden space-y-3 lg:block">
          <p className="text-xs text-sidebar-foreground/50">
            Trouble signing in? Ask an administrator in your organisation to check your
            account status.
          </p>
          <ApiStatus className="text-sidebar-foreground/50" />
        </div>
      </aside>

      <main className="relative flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
