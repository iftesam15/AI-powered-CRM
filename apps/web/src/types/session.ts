/**
 * Session shape shared by the BFF route handlers, the auth provider and the
 * layout shell. Mirrors what FastAPI returns from `/api/v1/auth/me`.
 *
 * `tenantId` is informational only. Authorization is always derived server side
 * from the session; the client never sends a tenant id to select a tenant.
 */
export type Role = "admin" | "sales_manager" | "sales_rep" | "read_only";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface SessionTenant {
  id: string;
  name: string;
  defaultCurrency: string;
  locale: string;
}

export interface Session {
  user: SessionUser;
  tenant: SessionTenant;
  permissions: string[];
}
