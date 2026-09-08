import React from "react";
import { Badge } from "@/components/ui/badge";

interface LeadStatusBadgeProps {
  status: string;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "new":
      return (
        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
          New
        </Badge>
      );
    case "contacted":
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
          Contacted
        </Badge>
      );
    case "qualified":
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
          Qualified
        </Badge>
      );
    case "unqualified":
      return (
        <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium">
          Unqualified
        </Badge>
      );
    case "converted":
      return (
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-medium">
          Converted
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground font-medium">
          {status}
        </Badge>
      );
  }
}
