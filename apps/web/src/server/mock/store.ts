import "server-only";

import { randomUUID } from "node:crypto";

import { permissionsForRole, ROLE_LABELS } from "@/lib/permissions";
import type { Role, Session, SessionTenant, SessionUser } from "@/types/session";

/**
 * In-memory stand-in for the FastAPI modules (`tenants`, `auth`, `users`,
 * `audit`). Active only when NEXT_PUBLIC_USE_MOCK_API=true so the app is
 * clickable before or without a backend. It deliberately reproduces the
 * behaviours each sprint's definition of done checks: lockout after repeated
 * failures, single-use reset tokens, tenant-scoped user administration, and an
 * append-only audit trail.
 *
 * It is not a security boundary and stores passwords in plain text on purpose.
 * Nothing here ships to production; the flag defaults to false.
 */

interface MockUser extends SessionUser {
  password: string;
  tenantId: string;
  failedAttempts: number;
  lockedUntil: number | null;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface ResetToken {
  token: string;
  userId: string;
  expiresAt: number;
  usedAt: number | null;
}

export interface MockAuditEntry {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
  /** Monotonic counter. Two entries written in the same millisecond still read
      back in the order they were written, which an audit log has to guarantee. */
  sequence: number;
  createdAt: number;
}

interface MockDatabase {
  tenants: Map<string, SessionTenant>;
  users: Map<string, MockUser>;
  resetTokens: Map<string, ResetToken>;
  sessions: Map<string, string>;
  auditLogs: MockAuditEntry[];
  auditSequence: number;
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const REP_ID = "33333333-3333-4333-8333-333333333333";
const MANAGER_ID = "44444444-4444-4444-8444-444444444444";
const VIEWER_ID = "55555555-5555-4555-8555-555555555555";

const DAY = 24 * 60 * 60 * 1000;

function seedUser(
  id: string,
  email: string,
  fullName: string,
  role: Role,
  createdDaysAgo: number,
): [string, MockUser] {
  const createdAt = Date.now() - createdDaysAgo * DAY;
  return [
    id,
    {
      id,
      email,
      fullName,
      role,
      isActive: true,
      password: "Sprint1demo!",
      tenantId: TENANT_ID,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function seed(): MockDatabase {
  const tenants = new Map<string, SessionTenant>([
    [
      TENANT_ID,
      {
        id: TENANT_ID,
        name: "Calder Freightways",
        defaultCurrency: "USD",
        locale: "en-US",
      },
    ],
  ]);

  const users = new Map<string, MockUser>([
    seedUser(ADMIN_ID, "admin@calderfreight.test", "Avery Whitlock", "admin", 90),
    seedUser(REP_ID, "rep@calderfreight.test", "Priya Raghunathan", "sales_rep", 62),
    seedUser(
      MANAGER_ID,
      "manager@calderfreight.test",
      "Tomas Lindqvist",
      "sales_manager",
      74,
    ),
    seedUser(VIEWER_ID, "finance@calderfreight.test", "Dana Osei", "read_only", 31),
  ]);

  return {
    tenants,
    users,
    resetTokens: new Map(),
    sessions: new Map(),
    auditLogs: [],
    auditSequence: 0,
  };
}

/**
 * Survives dev-server hot reloads, which would otherwise reset the lockout
 * counters, reset tokens and audit trail on every file save. The key carries a
 * version so a changed store shape does not read back a stale object.
 */
const globalStore = globalThis as unknown as { __crmMockDbV2?: MockDatabase };
const db: MockDatabase = (globalStore.__crmMockDbV2 ??= seed());

function toSession(user: MockUser): Session {
  const tenant = db.tenants.get(user.tenantId);
  if (!tenant) throw new Error(`Mock tenant ${user.tenantId} is missing.`);
  // Build the public shape explicitly rather than stripping fields, so a new
  // internal field on MockUser can never leak into a session response.
  const safe: SessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };
  return { user: safe, tenant, permissions: permissionsForRole(user.role) };
}

function findByEmail(email: string): MockUser | undefined {
  const needle = email.trim().toLowerCase();
  return [...db.users.values()].find((u) => u.email.toLowerCase() === needle);
}

// --- audit -----------------------------------------------------------------

function record(entry: {
  tenantId: string;
  actor: MockUser | null;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: MockAuditEntry["changes"];
}): void {
  db.auditSequence += 1;
  db.auditLogs.push({
    id: randomUUID(),
    tenantId: entry.tenantId,
    actorUserId: entry.actor?.id ?? null,
    actorEmail: entry.actor?.email ?? entry.actorEmail ?? "system",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    changes: entry.changes ?? null,
    sequence: db.auditSequence,
    createdAt: Date.now(),
  });
}

export interface AuditQuery {
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorUserId?: string | null;
  limit: number;
  offset: number;
}

export function mockListAudit(
  tenantId: string,
  query: AuditQuery,
): { items: MockAuditEntry[]; total: number } {
  const matches = db.auditLogs
    .filter((entry) => entry.tenantId === tenantId)
    .filter((entry) => !query.action || entry.action === query.action)
    .filter((entry) => !query.entityType || entry.entityType === query.entityType)
    .filter((entry) => !query.entityId || entry.entityId === query.entityId)
    .filter((entry) => !query.actorUserId || entry.actorUserId === query.actorUserId)
    .sort((a, b) => b.sequence - a.sequence);

  return {
    items: matches.slice(query.offset, query.offset + query.limit),
    total: matches.length,
  };
}

// --- authentication --------------------------------------------------------

export type MockLoginResult =
  | { kind: "ok"; accessToken: string; refreshToken: string; session: Session }
  | { kind: "invalid" }
  | { kind: "locked"; retryAfterSeconds: number }
  | { kind: "inactive" };

export function mockLogin(email: string, password: string): MockLoginResult {
  const user = findByEmail(email);
  const now = Date.now();

  if (!user) return { kind: "invalid" };

  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      kind: "locked",
      retryAfterSeconds: Math.ceil((user.lockedUntil - now) / 1000),
    };
  }

  if (!user.isActive) return { kind: "inactive" };

  if (user.password !== password) {
    user.failedAttempts += 1;
    record({
      tenantId: user.tenantId,
      actor: user,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      summary: `Failed sign-in attempt (${user.failedAttempts} of ${MAX_FAILED_ATTEMPTS})`,
    });

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = now + LOCKOUT_MS;
      user.failedAttempts = 0;
      record({
        tenantId: user.tenantId,
        actor: user,
        action: "auth.account_locked",
        entityType: "user",
        entityId: user.id,
        summary: `Account locked for ${LOCKOUT_MS / 60000} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts`,
      });
      return { kind: "locked", retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
    }
    return { kind: "invalid" };
  }

  user.failedAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = now;

  const accessToken = randomUUID();
  const refreshToken = randomUUID();
  db.sessions.set(accessToken, user.id);
  db.sessions.set(refreshToken, user.id);

  record({
    tenantId: user.tenantId,
    actor: user,
    action: "auth.login_succeeded",
    entityType: "user",
    entityId: user.id,
    summary: "Signed in",
  });

  return { kind: "ok", accessToken, refreshToken, session: toSession(user) };
}

export function mockSession(accessToken: string): Session | null {
  const user = mockUserForToken(accessToken);
  return user ? toSession(user) : null;
}

/** The authenticated user behind an access token, for the mock API handlers. */
export function mockUserForToken(accessToken: string): MockUser | null {
  const userId = db.sessions.get(accessToken);
  if (!userId) return null;
  const user = db.users.get(userId);
  if (!user || !user.isActive) return null;
  return user;
}

export function mockLogout(accessToken: string | null, refreshToken: string | null): void {
  const user = accessToken ? mockUserForToken(accessToken) : null;
  if (user) {
    record({
      tenantId: user.tenantId,
      actor: user,
      action: "auth.logged_out",
      entityType: "user",
      entityId: user.id,
      summary: "Signed out",
    });
  }
  if (accessToken) db.sessions.delete(accessToken);
  if (refreshToken) db.sessions.delete(refreshToken);
}

export function mockRefresh(
  refreshToken: string,
): { accessToken: string; session: Session } | null {
  const userId = db.sessions.get(refreshToken);
  if (!userId) return null;
  const user = db.users.get(userId);
  if (!user || !user.isActive) return null;
  const accessToken = randomUUID();
  db.sessions.set(accessToken, user.id);
  return { accessToken, session: toSession(user) };
}

/**
 * Always resolves successfully. Confirming whether an address exists would let
 * anyone enumerate a tenant's users, so the API answer is identical either way
 * and the token is only minted when the account is real.
 */
export function mockRequestPasswordReset(email: string): { token: string | null } {
  const user = findByEmail(email);
  if (!user) return { token: null };

  const token = randomUUID();
  db.resetTokens.set(token, {
    token,
    userId: user.id,
    expiresAt: Date.now() + RESET_TTL_MS,
    usedAt: null,
  });
  record({
    tenantId: user.tenantId,
    actor: user,
    action: "auth.password_reset_requested",
    entityType: "user",
    entityId: user.id,
    summary: "Requested a password reset link",
  });
  return { token };
}

export type MockResetResult =
  | { kind: "ok" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "used" };

export function mockResetPassword(token: string, password: string): MockResetResult {
  const record_ = db.resetTokens.get(token);
  if (!record_) return { kind: "invalid" };
  if (record_.usedAt) return { kind: "used" };
  if (record_.expiresAt < Date.now()) return { kind: "expired" };

  const user = db.users.get(record_.userId);
  if (!user) return { kind: "invalid" };

  user.password = password;
  user.failedAttempts = 0;
  user.lockedUntil = null;
  record_.usedAt = Date.now();

  record({
    tenantId: user.tenantId,
    actor: user,
    action: "auth.password_reset_completed",
    entityType: "user",
    entityId: user.id,
    summary: "Password changed with a reset link; all sessions revoked",
  });

  for (const [key, userId] of db.sessions.entries()) {
    if (userId === user.id) db.sessions.delete(key);
  }

  return { kind: "ok" };
}

// --- user administration ---------------------------------------------------

export interface UserQuery {
  q?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  sort: string;
  descending: boolean;
  limit: number;
  offset: number;
}

const SORTABLE: Record<string, (user: MockUser) => string | number> = {
  full_name: (u) => u.fullName.toLowerCase(),
  email: (u) => u.email,
  role: (u) => u.role,
  created_at: (u) => u.createdAt,
  last_login_at: (u) => u.lastLoginAt ?? 0,
};

export function mockListUsers(
  tenantId: string,
  query: UserQuery,
): { items: MockUser[]; total: number } {
  const needle = query.q?.trim().toLowerCase();
  const key = SORTABLE[query.sort] ?? SORTABLE.full_name;

  const matches = [...db.users.values()]
    .filter((user) => user.tenantId === tenantId)
    .filter(
      (user) =>
        !needle ||
        user.fullName.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle),
    )
    .filter((user) => !query.role || user.role === query.role)
    .filter((user) => query.isActive == null || user.isActive === query.isActive)
    .sort((a, b) => {
      const left = key(a);
      const right = key(b);
      if (left === right) return a.id.localeCompare(b.id);
      const order = left < right ? -1 : 1;
      return query.descending ? -order : order;
    });

  return {
    items: matches.slice(query.offset, query.offset + query.limit),
    total: matches.length,
  };
}

export function mockGetUser(tenantId: string, userId: string): MockUser | null {
  const user = db.users.get(userId);
  return user && user.tenantId === tenantId ? user : null;
}

export function isLocked(user: MockUser): boolean {
  return user.lockedUntil !== null && user.lockedUntil > Date.now();
}

export type MockUserWrite =
  | { kind: "ok"; user: MockUser }
  | { kind: "conflict"; detail: string }
  | { kind: "forbidden"; detail: string };

export function mockCreateUser(
  actorId: string,
  input: { email: string; fullName: string; role: Role; isActive: boolean; password: string },
): MockUserWrite {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden", detail: "You do not have access to this user." };

  const email = input.email.trim().toLowerCase();
  const clash = [...db.users.values()].find(
    (user) => user.tenantId === actor.tenantId && user.email.toLowerCase() === email,
  );
  if (clash) {
    return {
      kind: "conflict",
      detail: `User with email '${email}' already exists in this tenant.`,
    };
  }

  const now = Date.now();
  const user: MockUser = {
    id: randomUUID(),
    email,
    fullName: input.fullName.trim(),
    role: input.role,
    isActive: input.isActive,
    password: input.password,
    // The tenant comes from the actor, never from the request — the same rule
    // the real API enforces.
    tenantId: actor.tenantId,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.users.set(user.id, user);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    summary: `Created ${user.fullName} (${user.email}) as ${ROLE_LABELS[user.role]}`,
    changes: {
      email: { before: null, after: user.email },
      full_name: { before: null, after: user.fullName },
      role: { before: null, after: user.role },
      is_active: { before: null, after: user.isActive },
    },
  });

  return { kind: "ok", user };
}

function activeAdminCount(tenantId: string): number {
  return [...db.users.values()].filter(
    (user) => user.tenantId === tenantId && user.role === "admin" && user.isActive,
  ).length;
}

export function mockUpdateUser(
  actorId: string,
  userId: string,
  patch: { fullName?: string; role?: Role; isActive?: boolean },
): MockUserWrite {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden", detail: "You do not have access to this user." };

  const user = mockGetUser(actor.tenantId, userId);
  if (!user) return { kind: "forbidden", detail: "You do not have access to this user." };

  if (actor.id === user.id && patch.isActive === false) {
    return {
      kind: "conflict",
      detail: "You cannot deactivate your own account. Ask another administrator to do it.",
    };
  }

  const losingAdmin =
    user.role === "admin" &&
    user.isActive &&
    ((patch.role !== undefined && patch.role !== "admin") || patch.isActive === false);
  if (losingAdmin && activeAdminCount(user.tenantId) <= 1) {
    return {
      kind: "conflict",
      detail:
        "This is the last active administrator. Promote another user to administrator first.",
    };
  }

  const before = { full_name: user.fullName, role: user.role, is_active: user.isActive };
  if (patch.fullName !== undefined) user.fullName = patch.fullName.trim();
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.isActive !== undefined) user.isActive = patch.isActive;
  const after = { full_name: user.fullName, role: user.role, is_active: user.isActive };

  const changes: MockAuditEntry["changes"] = {};
  for (const field of ["full_name", "role", "is_active"] as const) {
    if (before[field] !== after[field]) {
      changes[field] = { before: before[field], after: after[field] };
    }
  }
  if (Object.keys(changes).length === 0) return { kind: "ok", user };

  user.updatedAt = Date.now();
  if (patch.isActive === true) {
    user.failedAttempts = 0;
    user.lockedUntil = null;
  }

  const who = `${user.fullName} (${user.email})`;
  const entries: Array<{ action: string; summary: string }> = [];
  if (changes.role) {
    entries.push({
      action: "user.role_changed",
      summary: `Changed role of ${who} from ${ROLE_LABELS[changes.role.before as Role]} to ${ROLE_LABELS[changes.role.after as Role]}`,
    });
  }
  if (changes.is_active) {
    const activated = changes.is_active.after === true;
    entries.push({
      action: activated ? "user.activated" : "user.deactivated",
      summary: `${activated ? "Activated" : "Deactivated"} ${who}`,
    });
  }
  if (entries.length === 0) {
    entries.push({ action: "user.updated", summary: `Updated ${who}` });
  }

  for (const entry of entries) {
    record({
      tenantId: actor.tenantId,
      actor,
      action: entry.action,
      entityType: "user",
      entityId: user.id,
      summary: entry.summary,
      changes,
    });
  }

  return { kind: "ok", user };
}
