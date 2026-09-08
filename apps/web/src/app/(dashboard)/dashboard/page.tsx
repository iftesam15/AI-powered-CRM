import { CalendarClock, Contact, Target, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeHeader } from "@/features/dashboard/components/welcome-header";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Sprint 1 delivers the shell, not the numbers. Reporting widgets arrive in
 * sprint 9, so each tile names what it will show instead of displaying an
 * invented figure.
 */
const PLANNED_TILES = [
  { title: "Open opportunities", icon: TrendingUp, sprint: 7 },
  { title: "My contacts", icon: Contact, sprint: 4 },
  { title: "Leads to qualify", icon: Target, sprint: 6 },
  { title: "Tasks due today", icon: CalendarClock, sprint: 5 },
];

export default function DashboardPage() {
  return (
    <>
      <WelcomeHeader />

      {/*
        Grouped by hairline rules rather than four card containers. Card
        elevation should mean hierarchy, and these tiles are peers; in dark mode
        the preset puts --card within 1.03:1 of --background, so the boxes were
        close to invisible anyway. The `gap-px` over a border-coloured parent
        draws the dividers at every breakpoint without per-cell border juggling.
      */}
      <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {PLANNED_TILES.map((tile) => (
          <div key={tile.title} className="group bg-background hover:bg-muted/30 transition-colors px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              <tile.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
              {tile.title}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Available from sprint {tile.sprint}
            </p>
          </div>
        ))}
      </section>

      <EmptyState
        icon={CalendarClock}
        title="Nothing to work through yet"
        description="Once accounts and contacts land in sprints 3 and 4, this space shows the records you own and the activities logged against them."
      />
    </>
  );
}
