import { ArrowRight } from "lucide-react";

import type { AuditChange } from "@/features/audit/types";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@/types/session";

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  is_active: "Status",
  role: "Role",
  email: "Email",
};

function render(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Active" : "Deactivated";
  // Roles are stored as the wire value; show the label a person recognises.
  if (field === "role") return ROLE_LABELS[value as Role] ?? String(value);
  return String(value);
}

/**
 * The before/after half of an audit entry (US-ADM-03).
 *
 * A creation records every field with a `null` before, which would print four
 * rows of "— → something" and say nothing the summary has not already said. So
 * only genuine transitions are drawn, and a creation shows nothing here.
 */
export function AuditChanges({ changes }: { changes: Record<string, AuditChange> | null }) {
  const transitions = Object.entries(changes ?? {}).filter(
    ([, change]) => change.before !== null && change.before !== undefined,
  );

  if (transitions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <dl className="space-y-1">
      {transitions.map(([field, change]) => (
        <div key={field} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <dt className="text-muted-foreground">{FIELD_LABELS[field] ?? field}</dt>
          <dd className="flex items-center gap-1.5">
            <span className="text-muted-foreground line-through">
              {render(field, change.before)}
            </span>
            <ArrowRight className="size-3 text-muted-foreground" aria-label="changed to" />
            <span className="font-medium">{render(field, change.after)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
