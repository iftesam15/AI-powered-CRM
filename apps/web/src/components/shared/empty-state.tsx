import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Empty and not-yet-built states share one composition so every screen in the
 * CRM explains what belongs there and how to fill it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card/50 px-6 py-10",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4.5" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1.5">
        <h3 className="text-base font-medium tracking-tight">{title}</h3>
        {description ? (
          <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
