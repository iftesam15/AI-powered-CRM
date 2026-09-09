import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StageBadgeProps {
  stageName?: string | null;
  status?: string | null;
  isWon?: boolean;
  isLost?: boolean;
  className?: string;
}

export function StageBadge({
  stageName,
  status,
  isWon,
  isLost,
  className,
}: StageBadgeProps) {
  const won = isWon || status === "won";
  const lost = isLost || status === "lost";

  let variantClass = "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15";
  let dotClass = "bg-primary";

  if (won) {
    variantClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15";
    dotClass = "bg-emerald-500";
  } else if (lost) {
    variantClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/15";
    dotClass = "bg-rose-500";
  }

  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-0.5 rounded-full transition-colors", variantClass, className)}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClass)} />
      {stageName || (won ? "Closed Won" : lost ? "Closed Lost" : "Open")}
    </Badge>
  );
}
