import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/types/session";

/**
 * Role reads as a quiet label, not a colour-coded rank. Four tinted badges in a
 * table column turn the list into a traffic light and pull attention away from
 * the names, which are what people are actually scanning for. Administrator is
 * the one worth spotting at a glance, so it alone carries weight.
 */
export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge
      variant="outline"
      className={
        role === "admin"
          ? "border-primary/40 bg-primary/10 font-medium text-foreground"
          : "font-normal text-muted-foreground"
      }
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/**
 * Only the states that need acting on are drawn. An ordinary active account is
 * the overwhelming majority of rows and gets a plain, unemphasised label, so a
 * deactivated or locked account is the thing the eye lands on.
 */
export function UserStatusBadge({
  isActive,
  isLocked,
}: {
  isActive: boolean;
  isLocked: boolean;
}) {
  if (!isActive) {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/8 text-destructive">
        Deactivated
      </Badge>
    );
  }

  if (isLocked) {
    return (
      <Badge variant="outline" className="gap-1 border-chart-4/40 bg-chart-4/10">
        <Lock className="size-3" aria-hidden />
        Locked
      </Badge>
    );
  }

  return <span className="text-sm text-muted-foreground">Active</span>;
}
