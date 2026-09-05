import type { Role } from "@/types/session";

/**
 * Wire shapes as FastAPI sends them (snake_case), and the camelCase shapes the
 * components use. The boundary between the two is `api/queries.ts`, so exactly
 * one file knows the backend's naming convention.
 */

export interface UserWire {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWire {
  value: Role;
  label: string;
  permissions: string[];
}

export interface CrmUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  /** Null until the account has been used at least once. */
  lastLoginAt: string | null;
  /** True while a failed-login lockout is still in force. */
  isLocked: boolean;
  createdAt: string;
}

export interface RoleOption {
  value: Role;
  label: string;
  permissions: string[];
}

export interface UserListFilters {
  q?: string;
  role?: Role | "all";
  status?: "all" | "active" | "inactive";
  limit?: number;
  offset?: number;
}

export function toCrmUser(wire: UserWire): CrmUser {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    email: wire.email,
    fullName: wire.full_name,
    role: wire.role,
    isActive: wire.is_active,
    lastLoginAt: wire.last_login_at,
    isLocked: wire.is_locked,
    createdAt: wire.created_at,
  };
}
