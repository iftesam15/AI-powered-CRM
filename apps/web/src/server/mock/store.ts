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

export interface MockAccount {
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  address: string | null;
  ownerId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MockContact {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  accountId: string | null;
  ownerId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MockActivity {
  id: string;
  tenantId: string;
  activityType: "call" | "meeting" | "email" | "note";
  title: string;
  description: string | null;
  performedAt: number;
  entityType: "account" | "contact";
  entityId: string;
  accountId: string | null;
  contactId: string | null;
  createdById: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MockTask {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  dueDate: number | null;
  completedAt: number | null;
  entityType: string | null;
  entityId: string | null;
  accountId: string | null;
  contactId: string | null;
  assignedToId: string | null;
  createdById: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MockLead {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  title: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  isConverted: boolean;
  convertedAt: number | null;
  convertedContactId: string | null;
  convertedAccountId: string | null;
  convertedOpportunityId: string | null;
  ownerId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface MockDatabase {
  tenants: Map<string, SessionTenant>;
  users: Map<string, MockUser>;
  accounts: Map<string, MockAccount>;
  contacts: Map<string, MockContact>;
  leads: Map<string, MockLead>;
  activities: Map<string, MockActivity>;
  tasks: Map<string, MockTask>;
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

  const now = Date.now();
  const accounts = new Map<string, MockAccount>([
    [
      "acc-1",
      {
        id: "acc-1",
        tenantId: TENANT_ID,
        name: "Acme Logistics Corp",
        industry: "Logistics & Supply Chain",
        size: "500+",
        website: "https://acmelogistics.example.com",
        address: "100 Supply Chain Way, Chicago, IL 60601",
        ownerId: ADMIN_ID,
        createdAt: now - 30 * DAY,
        updatedAt: now - 30 * DAY,
      },
    ],
    [
      "acc-2",
      {
        id: "acc-2",
        tenantId: TENANT_ID,
        name: "Apex Global Freight",
        industry: "Freight Forwarding",
        size: "201-500",
        website: "https://apexglobal.example.com",
        address: "45 Ocean Port Blvd, Seattle, WA 98101",
        ownerId: REP_ID,
        createdAt: now - 20 * DAY,
        updatedAt: now - 20 * DAY,
      },
    ],
    [
      "acc-3",
      {
        id: "acc-3",
        tenantId: TENANT_ID,
        name: "Starlight Maritime",
        industry: "Maritime Shipping",
        size: "51-200",
        website: "https://starlightmaritime.example.com",
        address: "88 Harbor Drive, Miami, FL 33101",
        ownerId: MANAGER_ID,
        createdAt: now - 15 * DAY,
        updatedAt: now - 15 * DAY,
      },
    ],
    [
      "acc-4",
      {
        id: "acc-4",
        tenantId: TENANT_ID,
        name: "Summit Retail Distribution",
        industry: "Retail & E-commerce",
        size: "500+",
        website: "https://summitretail.example.com",
        address: "500 Commerce Ave, Dallas, TX 75201",
        ownerId: ADMIN_ID,
        createdAt: now - 10 * DAY,
        updatedAt: now - 10 * DAY,
      },
    ],
    [
      "acc-5",
      {
        id: "acc-5",
        tenantId: TENANT_ID,
        name: "Vantage Tech Solutions",
        industry: "Technology & Software",
        size: "11-50",
        website: "https://vantagetech.example.com",
        address: "12 Tech Park Loop, Austin, TX 78701",
        ownerId: REP_ID,
        createdAt: now - 5 * DAY,
        updatedAt: now - 5 * DAY,
      },
    ],
  ]);

  const contacts = new Map<string, MockContact>([
    [
      "cnt-1",
      {
        id: "cnt-1",
        tenantId: TENANT_ID,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@acmelogistics.example.com",
        phone: "+1 (555) 019-2834",
        title: "VP of Logistics",
        accountId: "acc-1",
        ownerId: ADMIN_ID,
        createdAt: now - 12 * DAY,
        updatedAt: now - 12 * DAY,
      },
    ],
    [
      "cnt-2",
      {
        id: "cnt-2",
        tenantId: TENANT_ID,
        firstName: "Robert",
        lastName: "Smith",
        email: "r.smith@acmelogistics.example.com",
        phone: "+1 (555) 019-8273",
        title: "Supply Chain Director",
        accountId: "acc-1",
        ownerId: ADMIN_ID,
        createdAt: now - 8 * DAY,
        updatedAt: now - 8 * DAY,
      },
    ],
    [
      "cnt-3",
      {
        id: "cnt-3",
        tenantId: TENANT_ID,
        firstName: "Alice",
        lastName: "Johnson",
        email: "ajohnson@apexglobal.example.com",
        phone: "+1 (555) 019-3746",
        title: "Head of Procurement",
        accountId: "acc-2",
        ownerId: REP_ID,
        createdAt: now - 4 * DAY,
        updatedAt: now - 4 * DAY,
      },
    ],
  ]);

  const activities = new Map<string, MockActivity>([
    [
      "act-1",
      {
        id: "act-1",
        tenantId: TENANT_ID,
        activityType: "call",
        title: "Introductory Discovery Call",
        description: "Discussed Q4 logistics route capacity and software integration requirements.",
        performedAt: now - 5 * DAY,
        entityType: "account",
        entityId: "acc-1",
        accountId: "acc-1",
        contactId: "cnt-1",
        createdById: ADMIN_ID,
        createdAt: now - 5 * DAY,
        updatedAt: now - 5 * DAY,
      },
    ],
    [
      "act-2",
      {
        id: "act-2",
        tenantId: TENANT_ID,
        activityType: "meeting",
        title: "Executive Strategy Briefing",
        description: "Presented proposal for automated dispatch workflows.",
        performedAt: now - 2 * DAY,
        entityType: "account",
        entityId: "acc-1",
        accountId: "acc-1",
        contactId: "cnt-1",
        createdById: ADMIN_ID,
        createdAt: now - 2 * DAY,
        updatedAt: now - 2 * DAY,
      },
    ],
  ]);

  const tasks = new Map<string, MockTask>([
    [
      "tsk-1",
      {
        id: "tsk-1",
        tenantId: TENANT_ID,
        title: "Send SLA & Pricing Proposal",
        description: "Draft custom tier pricing model for 50+ fleet hubs.",
        status: "pending",
        priority: "high",
        dueDate: now + 2 * DAY,
        completedAt: null,
        entityType: "account",
        entityId: "acc-1",
        accountId: "acc-1",
        contactId: "cnt-1",
        assignedToId: ADMIN_ID,
        createdById: ADMIN_ID,
        createdAt: now - 1 * DAY,
        updatedAt: now - 1 * DAY,
      },
    ],
  ]);

  const leads = new Map<string, MockLead>([
    [
      "led-1",
      {
        id: "led-1",
        tenantId: TENANT_ID,
        firstName: "Michael",
        lastName: "Scott",
        email: "mscott@dundermifflin.example.com",
        phone: "+1 (555) 019-9482",
        companyName: "Dunder Mifflin Freight",
        title: "Regional Manager",
        status: "qualified",
        source: "website",
        notes: "Expressing urgent interest in regional paper distribution logistics.",
        isConverted: false,
        convertedAt: null,
        convertedContactId: null,
        convertedAccountId: null,
        convertedOpportunityId: null,
        ownerId: ADMIN_ID,
        createdAt: now - 6 * DAY,
        updatedAt: now - 3 * DAY,
      },
    ],
    [
      "led-2",
      {
        id: "led-2",
        tenantId: TENANT_ID,
        firstName: "Dwight",
        lastName: "Schrute",
        email: "dschrute@beetfarms.example.com",
        phone: "+1 (555) 019-2834",
        companyName: "Schrute Beet Logistics",
        title: "Assistant to Regional Manager",
        status: "new",
        source: "referral",
        notes: "Wants cold-chain beet transport options.",
        isConverted: false,
        convertedAt: null,
        convertedContactId: null,
        convertedAccountId: null,
        convertedOpportunityId: null,
        ownerId: REP_ID,
        createdAt: now - 2 * DAY,
        updatedAt: now - 2 * DAY,
      },
    ],
    [
      "led-3",
      {
        id: "led-3",
        tenantId: TENANT_ID,
        firstName: "Pam",
        lastName: "Beesly",
        email: "pbeesly@prattart.example.com",
        phone: "+1 (555) 019-4829",
        companyName: "Pratt Packaging",
        title: "Office Administrator",
        status: "contacted",
        source: "outbound",
        notes: "Followed up after trade show inquiry.",
        isConverted: false,
        convertedAt: null,
        convertedContactId: null,
        convertedAccountId: null,
        convertedOpportunityId: null,
        ownerId: ADMIN_ID,
        createdAt: now - 4 * DAY,
        updatedAt: now - 1 * DAY,
      },
    ],
  ]);

  return {
    tenants,
    users,
    accounts,
    contacts,
    leads,
    activities,
    tasks,
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

// --- Mock Accounts CRUD ---

export function mockListAccounts(
  tenantId: string,
  filters: { q?: string; industry?: string; ownerId?: string; limit?: number; offset?: number },
) {
  const limit = Math.min(filters.limit ?? 25, 100);
  const offset = filters.offset ?? 0;

  const matches = [...db.accounts.values()].filter((acc) => {
    if (acc.tenantId !== tenantId) return false;
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      const match =
        acc.name.toLowerCase().includes(q) ||
        (acc.industry && acc.industry.toLowerCase().includes(q)) ||
        (acc.website && acc.website.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filters.industry && acc.industry !== filters.industry) return false;
    if (filters.ownerId && acc.ownerId !== filters.ownerId) return false;
    return true;
  });

  matches.sort((a, b) => a.name.localeCompare(b.name));

  return {
    items: matches.slice(offset, offset + limit),
    total: matches.length,
    limit,
    offset,
  };
}

export function mockGetAccount(tenantId: string, accountId: string): MockAccount | null {
  const acc = db.accounts.get(accountId);
  if (!acc || acc.tenantId !== tenantId) return null;
  return acc;
}

export function mockCreateAccount(
  actorId: string,
  payload: { name: string; industry?: string | null; size?: string | null; website?: string | null; address?: string | null; ownerId?: string | null },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const existing = [...db.accounts.values()].find(
    (a) => a.tenantId === actor.tenantId && a.name.toLowerCase() === payload.name.trim().toLowerCase(),
  );
  if (existing) {
    return { kind: "conflict" as const, detail: `An account named '${payload.name}' already exists.` };
  }

  const id = `acc-${randomUUID()}`;
  const now = Date.now();
  const account: MockAccount = {
    id,
    tenantId: actor.tenantId,
    name: payload.name.trim(),
    industry: payload.industry?.trim() || null,
    size: payload.size?.trim() || null,
    website: payload.website?.trim() || null,
    address: payload.address?.trim() || null,
    ownerId: payload.ownerId || actorId,
    createdAt: now,
    updatedAt: now,
  };

  db.accounts.set(id, account);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "account.created",
    entityType: "account",
    entityId: id,
    summary: `Created account '${account.name}'`,
    changes: {
      name: { before: null, after: account.name },
      industry: { before: null, after: account.industry },
    },
  });

  return { kind: "ok" as const, account };
}

export function mockUpdateAccount(
  actorId: string,
  accountId: string,
  payload: { name?: string | null; industry?: string | null; size?: string | null; website?: string | null; address?: string | null; ownerId?: string | null },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const account = mockGetAccount(actor.tenantId, accountId);
  if (!account) return { kind: "forbidden" as const, detail: "You do not have access to this account." };

  if (payload.name && payload.name.trim().toLowerCase() !== account.name.toLowerCase()) {
    const existing = [...db.accounts.values()].find(
      (a) => a.tenantId === actor.tenantId && a.name.toLowerCase() === payload.name!.trim().toLowerCase() && a.id !== account.id,
    );
    if (existing) {
      return { kind: "conflict" as const, detail: `An account named '${payload.name}' already exists.` };
    }
    account.name = payload.name.trim();
  }

  if (payload.industry !== undefined) account.industry = payload.industry;
  if (payload.size !== undefined) account.size = payload.size;
  if (payload.website !== undefined) account.website = payload.website;
  if (payload.address !== undefined) account.address = payload.address;
  if (payload.ownerId !== undefined) account.ownerId = payload.ownerId;
  account.updatedAt = Date.now();

  record({
    tenantId: actor.tenantId,
    actor,
    action: "account.updated",
    entityType: "account",
    entityId: account.id,
    summary: `Updated account '${account.name}'`,
    changes: null,
  });

  return { kind: "ok" as const, account };
}

export function mockDeleteAccount(actorId: string, accountId: string) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const account = mockGetAccount(actor.tenantId, accountId);
  if (!account) return { kind: "forbidden" as const, detail: "You do not have access to this account." };

  const name = account.name;
  db.accounts.delete(accountId);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "account.deleted",
    entityType: "account",
    entityId: accountId,
    summary: `Deleted account '${name}'`,
    changes: null,
  });

  return { kind: "ok" as const };
}

// --- contacts ----------------------------------------------------------------

export function mockListContacts(
  tenantId: string,
  query?: { q?: string; account_id?: string; owner_id?: string; sort?: string; desc?: boolean; limit?: number; offset?: number },
) {
  let items = [...db.contacts.values()].filter((c) => c.tenantId === tenantId);

  if (query?.q?.trim()) {
    const term = query.q.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.firstName.toLowerCase().includes(term) ||
        c.lastName.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && c.phone.toLowerCase().includes(term)) ||
        (c.title && c.title.toLowerCase().includes(term)),
    );
  }

  if (query?.account_id) {
    items = items.filter((c) => c.accountId === query.account_id);
  }

  const sortKey = query?.sort ?? "lastName";
  items.sort((a, b) => {
    let aVal: any = (a as any)[sortKey] ?? "";
    let bVal: any = (b as any)[sortKey] ?? "";
    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return query?.desc ? 1 : -1;
    if (aVal > bVal) return query?.desc ? -1 : 1;
    return 0;
  });

  const total = items.length;
  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;
  const page = items.slice(offset, offset + limit).map((c) => {
    const acc = c.accountId ? db.accounts.get(c.accountId) : null;
    return {
      id: c.id,
      tenant_id: c.tenantId,
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email,
      phone: c.phone,
      title: c.title,
      account_id: c.accountId,
      account_name: acc ? acc.name : null,
      owner_id: c.ownerId,
      created_at: new Date(c.createdAt).toISOString(),
      updated_at: new Date(c.updatedAt).toISOString(),
    };
  });

  return { items: page, total, limit, offset };
}

export function mockGetContact(tenantId: string, contactId: string) {
  const c = db.contacts.get(contactId);
  if (!c || c.tenantId !== tenantId) return null;
  const acc = c.accountId ? db.accounts.get(c.accountId) : null;
  return {
    id: c.id,
    tenant_id: c.tenantId,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone: c.phone,
    title: c.title,
    account_id: c.accountId,
    account_name: acc ? acc.name : null,
    owner_id: c.ownerId,
    created_at: new Date(c.createdAt).toISOString(),
    updated_at: new Date(c.updatedAt).toISOString(),
  };
}

export function mockGetAccountContacts(tenantId: string, accountId: string) {
  const account = db.accounts.get(accountId);
  if (!account || account.tenantId !== tenantId) return null;

  return [...db.contacts.values()]
    .filter((c) => c.tenantId === tenantId && c.accountId === accountId)
    .map((c) => ({
      id: c.id,
      tenant_id: c.tenantId,
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email,
      phone: c.phone,
      title: c.title,
      account_id: c.accountId,
      account_name: account.name,
      owner_id: c.ownerId,
      created_at: new Date(c.createdAt).toISOString(),
      updated_at: new Date(c.updatedAt).toISOString(),
    }));
}

export function mockCheckDuplicateContact(tenantId: string, email: string) {
  if (!email || !email.trim()) {
    return { is_duplicate: false, matching_count: 0, matching_contacts: [] };
  }
  const needle = email.trim().toLowerCase();
  const matches = [...db.contacts.values()]
    .filter((c) => c.tenantId === tenantId && c.email?.toLowerCase() === needle)
    .map((c) => {
      const acc = c.accountId ? db.accounts.get(c.accountId) : null;
      return {
        id: c.id,
        tenant_id: c.tenantId,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        phone: c.phone,
        title: c.title,
        account_id: c.accountId,
        account_name: acc ? acc.name : null,
        owner_id: c.ownerId,
        created_at: new Date(c.createdAt).toISOString(),
        updated_at: new Date(c.updatedAt).toISOString(),
      };
    });

  return {
    is_duplicate: matches.length > 0,
    matching_count: matches.length,
    matching_contacts: matches,
  };
}

export function mockCreateContact(
  actorId: string,
  payload: { first_name: string; last_name: string; email?: string | null; phone?: string | null; title?: string | null; account_id?: string | null; owner_id?: string | null },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  if (payload.account_id) {
    const acc = db.accounts.get(payload.account_id);
    if (!acc || acc.tenantId !== actor.tenantId) {
      return { kind: "forbidden" as const, detail: "Specified account does not belong to your organization." };
    }
  }

  const id = `cnt-${randomUUID()}`;
  const now = Date.now();
  const contact: MockContact = {
    id,
    tenantId: actor.tenantId,
    firstName: payload.first_name.trim(),
    lastName: payload.last_name.trim(),
    email: payload.email?.trim().toLowerCase() || null,
    phone: payload.phone?.trim() || null,
    title: payload.title?.trim() || null,
    accountId: payload.account_id || null,
    ownerId: payload.owner_id || actorId,
    createdAt: now,
    updatedAt: now,
  };

  db.contacts.set(id, contact);

  const fullName = `${contact.firstName} ${contact.lastName}`;
  record({
    tenantId: actor.tenantId,
    actor,
    action: "contact.created",
    entityType: "contact",
    entityId: id,
    summary: `Created contact '${fullName}'`,
    changes: {
      name: { before: null, after: fullName },
      email: { before: null, after: contact.email },
    },
  });

  const acc = contact.accountId ? db.accounts.get(contact.accountId) : null;
  const dto = {
    id: contact.id,
    tenant_id: contact.tenantId,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    account_id: contact.accountId,
    account_name: acc ? acc.name : null,
    owner_id: contact.ownerId,
    created_at: new Date(contact.createdAt).toISOString(),
    updated_at: new Date(contact.updatedAt).toISOString(),
  };

  return { kind: "ok" as const, contact: dto };
}

export function mockUpdateContact(
  actorId: string,
  contactId: string,
  payload: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null; title?: string | null; account_id?: string | null; owner_id?: string | null },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const contact = db.contacts.get(contactId);
  if (!contact || contact.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this contact." };
  }

  if (payload.account_id) {
    const acc = db.accounts.get(payload.account_id);
    if (!acc || acc.tenantId !== actor.tenantId) {
      return { kind: "forbidden" as const, detail: "Specified account does not belong to your organization." };
    }
  }

  if (payload.first_name !== undefined && payload.first_name !== null) contact.firstName = payload.first_name.trim();
  if (payload.last_name !== undefined && payload.last_name !== null) contact.lastName = payload.last_name.trim();
  if (payload.email !== undefined) contact.email = payload.email?.trim().toLowerCase() || null;
  if (payload.phone !== undefined) contact.phone = payload.phone?.trim() || null;
  if (payload.title !== undefined) contact.title = payload.title?.trim() || null;
  if (payload.account_id !== undefined) contact.accountId = payload.account_id;
  if (payload.owner_id !== undefined) contact.ownerId = payload.owner_id;
  contact.updatedAt = Date.now();

  const fullName = `${contact.firstName} ${contact.lastName}`;
  record({
    tenantId: actor.tenantId,
    actor,
    action: "contact.updated",
    entityType: "contact",
    entityId: contact.id,
    summary: `Updated contact '${fullName}'`,
    changes: null,
  });

  const acc = contact.accountId ? db.accounts.get(contact.accountId) : null;
  const dto = {
    id: contact.id,
    tenant_id: contact.tenantId,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    account_id: contact.accountId,
    account_name: acc ? acc.name : null,
    owner_id: contact.ownerId,
    created_at: new Date(contact.createdAt).toISOString(),
    updated_at: new Date(contact.updatedAt).toISOString(),
  };

  return { kind: "ok" as const, contact: dto };
}

export function mockDeleteContact(actorId: string, contactId: string) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const contact = db.contacts.get(contactId);
  if (!contact || contact.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this contact." };
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  db.contacts.delete(contactId);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "contact.deleted",
    entityType: "contact",
    entityId: contactId,
    summary: `Deleted contact '${fullName}'`,
    changes: null,
  });

  return { kind: "ok" as const };
}

// --- activities & tasks mock handlers ----------------------------------------

export function mockListActivities(
  tenantId: string,
  query?: { activity_type?: string; entity_type?: string; entity_id?: string; limit?: number; offset?: number },
) {
  let items = [...db.activities.values()].filter((a) => a.tenantId === tenantId);

  if (query?.activity_type) {
    items = items.filter((a) => a.activityType === query.activity_type);
  }
  if (query?.entity_type) {
    items = items.filter((a) => a.entityType === query.entity_type);
  }
  if (query?.entity_id) {
    items = items.filter(
      (a) => a.entityId === query.entity_id || a.accountId === query.entity_id || a.contactId === query.entity_id,
    );
  }

  items.sort((a, b) => b.performedAt - a.performedAt);

  const total = items.length;
  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;

  const page = items.slice(offset, offset + limit).map((a) => {
    const acc = a.accountId ? db.accounts.get(a.accountId) : null;
    const cnt = a.contactId ? db.contacts.get(a.contactId) : null;
    const usr = a.createdById ? db.users.get(a.createdById) : null;
    return {
      id: a.id,
      tenant_id: a.tenantId,
      activity_type: a.activityType,
      title: a.title,
      description: a.description,
      performed_at: new Date(a.performedAt).toISOString(),
      entity_type: a.entityType,
      entity_id: a.entityId,
      account_id: a.accountId,
      contact_id: a.contactId,
      created_by_id: a.createdById,
      account_name: acc ? acc.name : null,
      contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
      created_by_name: usr ? usr.fullName : null,
      created_at: new Date(a.createdAt).toISOString(),
      updated_at: new Date(a.updatedAt).toISOString(),
    };
  });

  return { items: page, total, limit, offset };
}

export function mockCreateActivity(
  actorId: string,
  payload: {
    activity_type: "call" | "meeting" | "email" | "note";
    title: string;
    description?: string | null;
    performed_at?: string | null;
    entity_type: "account" | "contact";
    entity_id: string;
    account_id?: string | null;
    contact_id?: string | null;
  },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const id = `act-${randomUUID()}`;
  const now = Date.now();
  const performedAt = payload.performed_at ? new Date(payload.performed_at).getTime() : now;

  let accountId = payload.account_id || null;
  let contactId = payload.contact_id || null;

  if (payload.entity_type === "account") {
    accountId = payload.entity_id;
  } else if (payload.entity_type === "contact") {
    contactId = payload.entity_id;
    const cnt = db.contacts.get(payload.entity_id);
    if (cnt && cnt.accountId && !accountId) {
      accountId = cnt.accountId;
    }
  }

  const activity: MockActivity = {
    id,
    tenantId: actor.tenantId,
    activityType: payload.activity_type,
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    performedAt,
    entityType: payload.entity_type,
    entityId: payload.entity_id,
    accountId,
    contactId,
    createdById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  db.activities.set(id, activity);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "activity.created",
    entityType: "activity",
    entityId: id,
    summary: `Logged activity '${activity.title}' (${activity.activityType})`,
    changes: null,
  });

  const acc = activity.accountId ? db.accounts.get(activity.accountId) : null;
  const cnt = activity.contactId ? db.contacts.get(activity.contactId) : null;
  const dto = {
    id: activity.id,
    tenant_id: activity.tenantId,
    activity_type: activity.activityType,
    title: activity.title,
    description: activity.description,
    performed_at: new Date(activity.performedAt).toISOString(),
    entity_type: activity.entityType,
    entity_id: activity.entityId,
    account_id: activity.accountId,
    contact_id: activity.contactId,
    created_by_id: activity.createdById,
    account_name: acc ? acc.name : null,
    contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
    created_by_name: actor.fullName,
    created_at: new Date(activity.createdAt).toISOString(),
    updated_at: new Date(activity.updatedAt).toISOString(),
  };

  return { kind: "ok" as const, activity: dto };
}

export function mockDeleteActivity(actorId: string, activityId: string) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const activity = db.activities.get(activityId);
  if (!activity || activity.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this activity." };
  }

  const title = activity.title;
  db.activities.delete(activityId);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "activity.deleted",
    entityType: "activity",
    entityId: activityId,
    summary: `Deleted activity '${title}'`,
    changes: null,
  });

  return { kind: "ok" as const };
}

export function mockGetTimeline(tenantId: string, entityType: string, entityId: string) {
  const activities = [...db.activities.values()].filter(
    (a) =>
      a.tenantId === tenantId &&
      (a.entityId === entityId || a.accountId === entityId || a.contactId === entityId),
  );

  const tasks = [...db.tasks.values()].filter(
    (t) =>
      t.tenantId === tenantId &&
      (t.entityId === entityId || t.accountId === entityId || t.contactId === entityId),
  );

  const items = [];

  for (const a of activities) {
    const usr = a.createdById ? db.users.get(a.createdById) : null;
    items.push({
      id: a.id,
      item_type: "activity",
      category: a.activityType,
      title: a.title,
      description: a.description,
      timestamp: new Date(a.performedAt).toISOString(),
      status: null,
      priority: null,
      due_date: null,
      entity_type: a.entityType,
      entity_id: a.entityId,
      actor_name: usr ? usr.fullName : null,
      raw_id: a.id,
    });
  }

  for (const t of tasks) {
    const usr = t.assignedToId ? db.users.get(t.assignedToId) : null;
    const ts = t.completedAt || t.createdAt;
    items.push({
      id: t.id,
      item_type: "task",
      category: t.status === "completed" ? "task_completed" : "task",
      title: t.title,
      description: t.description,
      timestamp: new Date(ts).toISOString(),
      status: t.status,
      priority: t.priority,
      due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      entity_type: t.entityType,
      entity_id: t.entityId,
      actor_name: usr ? usr.fullName : null,
      raw_id: t.id,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}

export function mockListTasks(
  tenantId: string,
  query?: { status?: string; priority?: string; assigned_to_id?: string; entity_type?: string; entity_id?: string; limit?: number; offset?: number },
) {
  let items = [...db.tasks.values()].filter((t) => t.tenantId === tenantId);

  if (query?.status) {
    items = items.filter((t) => t.status === query.status);
  }
  if (query?.priority) {
    items = items.filter((t) => t.priority === query.priority);
  }
  if (query?.assigned_to_id) {
    items = items.filter((t) => t.assignedToId === query.assigned_to_id);
  }
  if (query?.entity_type) {
    items = items.filter((t) => t.entityType === query.entity_type);
  }
  if (query?.entity_id) {
    items = items.filter(
      (t) => t.entityId === query.entity_id || t.accountId === query.entity_id || t.contactId === query.entity_id,
    );
  }

  items.sort((a, b) => b.createdAt - a.createdAt);

  const total = items.length;
  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;

  const page = items.slice(offset, offset + limit).map((t) => {
    const acc = t.accountId ? db.accounts.get(t.accountId) : null;
    const cnt = t.contactId ? db.contacts.get(t.contactId) : null;
    const asg = t.assignedToId ? db.users.get(t.assignedToId) : null;
    const crt = t.createdById ? db.users.get(t.createdById) : null;
    return {
      id: t.id,
      tenant_id: t.tenantId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
      entity_type: t.entityType,
      entity_id: t.entityId,
      account_id: t.accountId,
      contact_id: t.contactId,
      assigned_to_id: t.assignedToId,
      created_by_id: t.createdById,
      account_name: acc ? acc.name : null,
      contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
      assigned_to_name: asg ? asg.fullName : null,
      created_by_name: crt ? crt.fullName : null,
      created_at: new Date(t.createdAt).toISOString(),
      updated_at: new Date(t.updatedAt).toISOString(),
    };
  });

  return { items: page, total, limit, offset };
}

export function mockCreateTask(
  actorId: string,
  payload: {
    title: string;
    description?: string | null;
    status?: "pending" | "in_progress" | "completed" | "cancelled";
    priority?: "low" | "medium" | "high";
    due_date?: string | null;
    entity_type?: string | null;
    entity_id?: string | null;
    account_id?: string | null;
    contact_id?: string | null;
    assigned_to_id?: string | null;
  },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const id = `tsk-${randomUUID()}`;
  const now = Date.now();
  const statusVal = payload.status || "pending";
  const completedAt = statusVal === "completed" ? now : null;

  let accountId = payload.account_id || null;
  let contactId = payload.contact_id || null;

  if (payload.entity_type === "account" && payload.entity_id) {
    accountId = payload.entity_id;
  } else if (payload.entity_type === "contact" && payload.entity_id) {
    contactId = payload.entity_id;
    const cnt = db.contacts.get(payload.entity_id);
    if (cnt && cnt.accountId && !accountId) {
      accountId = cnt.accountId;
    }
  }

  const task: MockTask = {
    id,
    tenantId: actor.tenantId,
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    status: statusVal,
    priority: payload.priority || "medium",
    dueDate: payload.due_date ? new Date(payload.due_date).getTime() : null,
    completedAt,
    entityType: payload.entity_type || null,
    entityId: payload.entity_id || null,
    accountId,
    contactId,
    assignedToId: payload.assigned_to_id || actorId,
    createdById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  db.tasks.set(id, task);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "task.created",
    entityType: "task",
    entityId: id,
    summary: `Created task '${task.title}'`,
    changes: null,
  });

  const acc = task.accountId ? db.accounts.get(task.accountId) : null;
  const cnt = task.contactId ? db.contacts.get(task.contactId) : null;
  const asg = task.assignedToId ? db.users.get(task.assignedToId) : null;

  const dto = {
    id: task.id,
    tenant_id: task.tenantId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    entity_type: task.entityType,
    entity_id: task.entityId,
    account_id: task.accountId,
    contact_id: task.contactId,
    assigned_to_id: task.assignedToId,
    created_by_id: task.createdById,
    account_name: acc ? acc.name : null,
    contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
    assigned_to_name: asg ? asg.fullName : null,
    created_by_name: actor.fullName,
    created_at: new Date(task.createdAt).toISOString(),
    updated_at: new Date(task.updatedAt).toISOString(),
  };

  return { kind: "ok" as const, task: dto };
}

export function mockUpdateTask(
  actorId: string,
  taskId: string,
  payload: {
    title?: string | null;
    description?: string | null;
    status?: "pending" | "in_progress" | "completed" | "cancelled" | null;
    priority?: "low" | "medium" | "high" | null;
    due_date?: string | null;
    assigned_to_id?: string | null;
  },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const task = db.tasks.get(taskId);
  if (!task || task.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this task." };
  }

  if (payload.title !== undefined && payload.title !== null) task.title = payload.title.trim();
  if (payload.description !== undefined) task.description = payload.description?.trim() || null;
  if (payload.priority !== undefined && payload.priority !== null) task.priority = payload.priority;
  if (payload.due_date !== undefined) task.dueDate = payload.due_date ? new Date(payload.due_date).getTime() : null;
  if (payload.assigned_to_id !== undefined) task.assignedToId = payload.assigned_to_id;

  if (payload.status !== undefined && payload.status !== null) {
    const oldStatus = task.status;
    task.status = payload.status;
    if (payload.status === "completed" && oldStatus !== "completed") {
      task.completedAt = Date.now();
    } else if (payload.status !== "completed") {
      task.completedAt = null;
    }
  }

  task.updatedAt = Date.now();

  record({
    tenantId: actor.tenantId,
    actor,
    action: "task.updated",
    entityType: "task",
    entityId: task.id,
    summary: `Updated task '${task.title}'`,
    changes: null,
  });

  const acc = task.accountId ? db.accounts.get(task.accountId) : null;
  const cnt = task.contactId ? db.contacts.get(task.contactId) : null;
  const asg = task.assignedToId ? db.users.get(task.assignedToId) : null;
  const crt = task.createdById ? db.users.get(task.createdById) : null;

  const dto = {
    id: task.id,
    tenant_id: task.tenantId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    entity_type: task.entityType,
    entity_id: task.entityId,
    account_id: task.accountId,
    contact_id: task.contactId,
    assigned_to_id: task.assignedToId,
    created_by_id: task.createdById,
    account_name: acc ? acc.name : null,
    contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
    assigned_to_name: asg ? asg.fullName : null,
    created_by_name: crt ? crt.fullName : null,
    created_at: new Date(task.createdAt).toISOString(),
    updated_at: new Date(task.updatedAt).toISOString(),
  };

  return { kind: "ok" as const, task: dto };
}

export function mockDeleteTask(actorId: string, taskId: string) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const task = db.tasks.get(taskId);
  if (!task || task.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this task." };
  }

  const title = task.title;
  db.tasks.delete(taskId);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "task.deleted",
    entityType: "task",
    entityId: taskId,
    summary: `Deleted task '${title}'`,
    changes: null,
  });

  return { kind: "ok" as const };
}

export function mockListLeads(
  tenantId: string,
  options: {
    q?: string | null;
    status?: string | null;
    is_converted?: boolean | null;
    owner_id?: string | null;
    limit?: number;
    offset?: number;
  } = {},
) {
  let list = [...db.leads.values()].filter((l) => l.tenantId === tenantId);

  if (options.q) {
    const q = options.q.toLowerCase().trim();
    list = list.filter(
      (l) =>
        l.firstName.toLowerCase().includes(q) ||
        l.lastName.toLowerCase().includes(q) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.companyName && l.companyName.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q))
    );
  }

  if (options.status) {
    list = list.filter((l) => l.status === options.status);
  }

  if (options.is_converted !== undefined && options.is_converted !== null) {
    list = list.filter((l) => l.isConverted === options.is_converted);
  }

  list.sort((a, b) => b.createdAt - a.createdAt);

  const total = list.length;
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  const sliced = list.slice(offset, offset + limit);

  const items = sliced.map((lead) => {
    const cnt = lead.convertedContactId ? db.contacts.get(lead.convertedContactId) : null;
    const acc = lead.convertedAccountId ? db.accounts.get(lead.convertedAccountId) : null;
    return {
      id: lead.id,
      tenant_id: lead.tenantId,
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      company_name: lead.companyName,
      title: lead.title,
      status: lead.status,
      source: lead.source,
      notes: lead.notes,
      is_converted: lead.isConverted,
      converted_at: lead.convertedAt ? new Date(lead.convertedAt).toISOString() : null,
      converted_contact_id: lead.convertedContactId,
      converted_account_id: lead.convertedAccountId,
      converted_opportunity_id: lead.convertedOpportunityId,
      converted_contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
      converted_account_name: acc ? acc.name : null,
      owner_id: lead.ownerId,
      created_at: new Date(lead.createdAt).toISOString(),
      updated_at: new Date(lead.updatedAt).toISOString(),
    };
  });

  return { items, total, limit, offset };
}

export function mockGetLead(tenantId: string, leadId: string) {
  const lead = db.leads.get(leadId);
  if (!lead || lead.tenantId !== tenantId) return null;

  const cnt = lead.convertedContactId ? db.contacts.get(lead.convertedContactId) : null;
  const acc = lead.convertedAccountId ? db.accounts.get(lead.convertedAccountId) : null;

  return {
    id: lead.id,
    tenant_id: lead.tenantId,
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    company_name: lead.companyName,
    title: lead.title,
    status: lead.status,
    source: lead.source,
    notes: lead.notes,
    is_converted: lead.isConverted,
    converted_at: lead.convertedAt ? new Date(lead.convertedAt).toISOString() : null,
    converted_contact_id: lead.convertedContactId,
    converted_account_id: lead.convertedAccountId,
    converted_opportunity_id: lead.convertedOpportunityId,
    converted_contact_name: cnt ? `${cnt.firstName} ${cnt.lastName}` : null,
    converted_account_name: acc ? acc.name : null,
    owner_id: lead.ownerId,
    created_at: new Date(lead.createdAt).toISOString(),
    updated_at: new Date(lead.updatedAt).toISOString(),
  };
}

export function mockCreateLead(
  actorId: string,
  payload: {
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    company_name?: string | null;
    title?: string | null;
    status?: string;
    source?: string | null;
    notes?: string | null;
    owner_id?: string | null;
  },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const now = Date.now();
  const lead: MockLead = {
    id: randomUUID(),
    tenantId: actor.tenantId,
    firstName: payload.first_name.trim(),
    lastName: payload.last_name.trim(),
    email: payload.email?.trim().toLowerCase() || null,
    phone: payload.phone?.trim() || null,
    companyName: payload.company_name?.trim() || null,
    title: payload.title?.trim() || null,
    status: payload.status || "new",
    source: payload.source?.trim() || null,
    notes: payload.notes?.trim() || null,
    isConverted: false,
    convertedAt: null,
    convertedContactId: null,
    convertedAccountId: null,
    convertedOpportunityId: null,
    ownerId: payload.owner_id || actor.id,
    createdAt: now,
    updatedAt: now,
  };

  db.leads.set(lead.id, lead);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "lead.created",
    entityType: "lead",
    entityId: lead.id,
    summary: `Created lead ${lead.firstName} ${lead.lastName}`,
    changes: null,
  });

  return {
    kind: "ok" as const,
    lead: mockGetLead(actor.tenantId, lead.id)!,
  };
}

export function mockUpdateLead(
  actorId: string,
  leadId: string,
  payload: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    company_name?: string | null;
    title?: string | null;
    status?: string | null;
    source?: string | null;
    notes?: string | null;
    owner_id?: string | null;
  },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const lead = db.leads.get(leadId);
  if (!lead || lead.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this lead." };
  }

  if (lead.isConverted) {
    return { kind: "forbidden" as const, detail: "Converted leads are read-only and cannot be updated." };
  }

  if (payload.first_name) lead.firstName = payload.first_name.trim();
  if (payload.last_name) lead.lastName = payload.last_name.trim();
  if (payload.email !== undefined) lead.email = payload.email?.trim().toLowerCase() || null;
  if (payload.phone !== undefined) lead.phone = payload.phone?.trim() || null;
  if (payload.company_name !== undefined) lead.companyName = payload.company_name?.trim() || null;
  if (payload.title !== undefined) lead.title = payload.title?.trim() || null;
  if (payload.status) lead.status = payload.status;
  if (payload.source !== undefined) lead.source = payload.source?.trim() || null;
  if (payload.notes !== undefined) lead.notes = payload.notes?.trim() || null;
  if (payload.owner_id !== undefined) lead.ownerId = payload.owner_id;
  lead.updatedAt = Date.now();

  record({
    tenantId: actor.tenantId,
    actor,
    action: "lead.updated",
    entityType: "lead",
    entityId: lead.id,
    summary: `Updated lead ${lead.firstName} ${lead.lastName}`,
    changes: null,
  });

  return {
    kind: "ok" as const,
    lead: mockGetLead(actor.tenantId, lead.id)!,
  };
}

export function mockDeleteLead(actorId: string, leadId: string) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const lead = db.leads.get(leadId);
  if (!lead || lead.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this lead." };
  }

  const fullName = `${lead.firstName} ${lead.lastName}`;
  db.leads.delete(leadId);

  record({
    tenantId: actor.tenantId,
    actor,
    action: "lead.deleted",
    entityType: "lead",
    entityId: leadId,
    summary: `Deleted lead ${fullName}`,
    changes: null,
  });

  return { kind: "ok" as const };
}

export function mockConvertLead(
  actorId: string,
  leadId: string,
  options: {
    create_account?: boolean;
    account_id?: string | null;
    account_name?: string | null;
  },
) {
  const actor = db.users.get(actorId);
  if (!actor) return { kind: "forbidden" as const, detail: "You do not have access." };

  const lead = db.leads.get(leadId);
  if (!lead || lead.tenantId !== actor.tenantId) {
    return { kind: "forbidden" as const, detail: "You do not have access to this lead." };
  }

  if (lead.isConverted) {
    return { kind: "invalid" as const, detail: "Lead is already converted." };
  }

  const now = Date.now();
  let targetAccountId: string | null = null;

  // 1. Account handling
  if (options.account_id) {
    const acc = db.accounts.get(options.account_id);
    if (!acc || acc.tenantId !== actor.tenantId) {
      return { kind: "forbidden" as const, detail: "Specified account belongs to another organization." };
    }
    targetAccountId = acc.id;
  } else if (options.create_account || options.account_name || lead.companyName) {
    const newAccId = randomUUID();
    const accName = options.account_name?.trim() || lead.companyName || `${lead.firstName} ${lead.lastName} Account`;
    db.accounts.set(newAccId, {
      id: newAccId,
      tenantId: actor.tenantId,
      name: accName,
      industry: null,
      size: null,
      website: null,
      address: null,
      ownerId: lead.ownerId || actor.id,
      createdAt: now,
      updatedAt: now,
    });
    targetAccountId = newAccId;

    record({
      tenantId: actor.tenantId,
      actor,
      action: "account.created",
      entityType: "account",
      entityId: newAccId,
      summary: `Created account ${accName} via lead conversion`,
      changes: null,
    });
  }

  // 2. Contact creation
  const contactId = randomUUID();
  db.contacts.set(contactId, {
    id: contactId,
    tenantId: actor.tenantId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    title: lead.title,
    accountId: targetAccountId,
    ownerId: lead.ownerId || actor.id,
    createdAt: now,
    updatedAt: now,
  });

  record({
    tenantId: actor.tenantId,
    actor,
    action: "contact.created",
    entityType: "contact",
    entityId: contactId,
    summary: `Created contact ${lead.firstName} ${lead.lastName} via lead conversion`,
    changes: null,
  });

  // 3. Update Lead
  lead.status = "converted";
  lead.isConverted = true;
  lead.convertedAt = now;
  lead.convertedContactId = contactId;
  lead.convertedAccountId = targetAccountId;
  lead.updatedAt = now;

  record({
    tenantId: actor.tenantId,
    actor,
    action: "lead.converted",
    entityType: "lead",
    entityId: lead.id,
    summary: `Converted lead ${lead.firstName} ${lead.lastName} to contact`,
    changes: null,
  });

  return {
    kind: "ok" as const,
    result: {
      lead: mockGetLead(actor.tenantId, lead.id)!,
      contact_id: contactId,
      account_id: targetAccountId,
    },
  };
}



