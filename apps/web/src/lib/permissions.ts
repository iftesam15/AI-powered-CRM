import type { Role, Session } from "@/types/session";

/**
 * Client-side permission names must match `core/rbac.py` on the backend
 * (convention: `<resource>:<action>`).
 *
 * These gates are UX only. They hide actions a role cannot perform so the user
 * is not offered dead ends. The API is still the enforcement boundary and must
 * reject every unauthorized call independently.
 */
export const PERMISSIONS = {
  accountsRead: "accounts:read",
  accountsWrite: "accounts:write",
  contactsRead: "contacts:read",
  contactsWrite: "contacts:write",
  leadsRead: "leads:read",
  leadsWrite: "leads:write",
  opportunitiesRead: "opportunities:read",
  opportunitiesWrite: "opportunities:write",
  pipelineRead: "pipeline:read",
  pipelineConfigure: "pipeline:configure",
  activitiesRead: "activities:read",
  activitiesWrite: "activities:write",
  tasksRead: "tasks:read",
  tasksWrite: "tasks:write",
  reportsRead: "reports:read",
  searchRead: "search:read",
  importsWrite: "imports:write",
  exportsRead: "exports:read",
  usersRead: "users:read",
  usersWrite: "users:write",
  tenantRead: "tenant:read",
  tenantWrite: "tenant:write",
  auditRead: "audit:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const READ_ONLY: Permission[] = [
  PERMISSIONS.accountsRead,
  PERMISSIONS.contactsRead,
  PERMISSIONS.leadsRead,
  PERMISSIONS.opportunitiesRead,
  PERMISSIONS.pipelineRead,
  PERMISSIONS.activitiesRead,
  PERMISSIONS.tasksRead,
  PERMISSIONS.reportsRead,
  PERMISSIONS.searchRead,
  PERMISSIONS.exportsRead,
];

const SALES_REP: Permission[] = [
  ...READ_ONLY,
  PERMISSIONS.accountsWrite,
  PERMISSIONS.contactsWrite,
  PERMISSIONS.leadsWrite,
  PERMISSIONS.opportunitiesWrite,
  PERMISSIONS.activitiesWrite,
  PERMISSIONS.tasksWrite,
];

const SALES_MANAGER: Permission[] = [
  ...SALES_REP,
  PERMISSIONS.importsWrite,
  PERMISSIONS.usersRead,
];

const ADMIN: Permission[] = [
  ...SALES_MANAGER,
  PERMISSIONS.pipelineConfigure,
  PERMISSIONS.usersWrite,
  PERMISSIONS.tenantRead,
  PERMISSIONS.tenantWrite,
  PERMISSIONS.auditRead,
];

/**
 * Fallback map used when the API has not yet returned an explicit permission
 * list. Once the backend ships `core/rbac.py`, the session's `permissions`
 * array is authoritative and this map is only a bootstrap default.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  read_only: READ_ONLY,
  sales_rep: SALES_REP,
  sales_manager: SALES_MANAGER,
  admin: ADMIN,
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  sales_manager: "Sales manager",
  sales_rep: "Sales representative",
  read_only: "Read only",
};

export function permissionsForRole(role: Role): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(
  session: Session | null,
  permission: Permission | Permission[],
): boolean {
  if (!session) return false;
  const granted = new Set(
    session.permissions.length > 0
      ? session.permissions
      : permissionsForRole(session.user.role),
  );
  const required = Array.isArray(permission) ? permission : [permission];
  return required.every((p) => granted.has(p));
}
