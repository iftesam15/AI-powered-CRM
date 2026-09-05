/**
 * Wire shapes as FastAPI sends them, and the camelCase shapes the components
 * use. `api/queries.ts` is the only place that crosses between the two.
 */

export interface AuditChange {
  before: unknown;
  after: unknown;
}

export interface AuditEntryWire {
  id: string;
  actor_user_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  changes: Record<string, AuditChange> | null;
  ip_address: string | null;
  request_id: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: Record<string, AuditChange> | null;
  ipAddress: string | null;
  createdAt: string;
}

export function toAuditEntry(wire: AuditEntryWire): AuditEntry {
  return {
    id: wire.id,
    actorUserId: wire.actor_user_id,
    actorEmail: wire.actor_email,
    action: wire.action,
    entityType: wire.entity_type,
    entityId: wire.entity_id,
    summary: wire.summary,
    changes: wire.changes,
    ipAddress: wire.ip_address,
    createdAt: wire.created_at,
  };
}

/**
 * Action names are `<entity>.<verb>` and come from the API, so the UI never
 * holds a hardcoded list. These two helpers only make them readable.
 */
export function actionLabel(action: string): string {
  const verb = action.includes(".") ? action.slice(action.indexOf(".") + 1) : action;
  const words = verb.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function actionGroup(action: string): string {
  const group = action.includes(".") ? action.slice(0, action.indexOf(".")) : "other";
  return group === "auth" ? "Authentication" : group.charAt(0).toUpperCase() + group.slice(1);
}

/**
 * Entries worth a second look when scanning a long log: a failed sign-in, a
 * lockout, a role change or a deactivation. Everything else is routine.
 */
const NOTABLE = new Set([
  "auth.login_failed",
  "auth.account_locked",
  "user.role_changed",
  "user.deactivated",
]);

export function isNotable(action: string): boolean {
  return NOTABLE.has(action);
}
