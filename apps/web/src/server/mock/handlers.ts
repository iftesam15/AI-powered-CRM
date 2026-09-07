import "server-only";

import { NextResponse } from "next/server";

import { PERMISSIONS, permissionsForRole, ROLE_LABELS } from "@/lib/permissions";
import {
  isLocked,
  mockCheckDuplicateContact,
  mockCreateAccount,
  mockCreateContact,
  mockCreateUser,
  mockDeleteAccount,
  mockDeleteContact,
  mockGetAccount,
  mockGetAccountContacts,
  mockGetContact,
  mockGetUser,
  mockListAccounts,
  mockListAudit,
  mockListContacts,
  mockListUsers,
  mockUpdateAccount,
  mockUpdateContact,
  mockUpdateUser,
  mockUserForToken,
  type MockAccount,
  type MockAuditEntry,
} from "@/server/mock/store";
import type { Role } from "@/types/session";

/**
 * Mock implementations of the API routes the feature layer calls, so the app is
 * usable with `NEXT_PUBLIC_USE_MOCK_API=true` and no backend running.
 *
 * These deliberately answer with the **same wire shape as FastAPI**, snake_case
 * and all: the feature modules normalise one payload format, and the mock has
 * to be a faithful stand-in or the switch to the real API is not a no-op. They
 * also enforce the same permissions, so the RBAC behaviour the sprint is judged
 * on is visible without a backend.
 */

const AUDIT_ACTIONS = [
  "auth.account_locked",
  "auth.logged_out",
  "auth.login_failed",
  "auth.login_succeeded",
  "auth.password_reset_completed",
  "auth.password_reset_requested",
  "user.activated",
  "user.created",
  "user.deactivated",
  "user.role_changed",
  "user.updated",
] as const;

const AUDIT_ENTITY_TYPES = [
  "account",
  "contact",
  "lead",
  "opportunity",
  "tenant",
  "user",
] as const;

const ROLES: Role[] = ["admin", "sales_manager", "sales_rep", "read_only"];
const MIN_PASSWORD_LENGTH = 8;
const MAX_LIMIT = 100;

type MockUserRecord = NonNullable<ReturnType<typeof mockUserForToken>>;

function error(status: number, detail: string, code: string) {
  return NextResponse.json({ detail, code }, { status });
}

function invalid(fieldErrors: Record<string, string[]>) {
  return NextResponse.json(
    { detail: "Check the details you entered.", code: "validation_error", fieldErrors },
    { status: 422 },
  );
}

function page<T>(items: T[], total: number, limit: number, offset: number) {
  return NextResponse.json({ items, total, limit, offset });
}

function serialiseUser(user: MockUserRecord) {
  return {
    id: user.id,
    tenant_id: user.tenantId,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    is_active: user.isActive,
    last_login_at: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    is_locked: isLocked(user),
    created_at: new Date(user.createdAt).toISOString(),
    updated_at: new Date(user.updatedAt).toISOString(),
  };
}

function serialiseAudit(entry: MockAuditEntry) {
  return {
    id: entry.id,
    actor_user_id: entry.actorUserId,
    actor_email: entry.actorEmail,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    summary: entry.summary,
    changes: entry.changes,
    ip_address: "127.0.0.1",
    request_id: null,
    created_at: new Date(entry.createdAt).toISOString(),
  };
}

function paging(search: URLSearchParams) {
  const limit = Number(search.get("limit") ?? 25);
  const offset = Number(search.get("offset") ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return null;
  if (!Number.isInteger(offset) || offset < 0) return null;
  return { limit, offset };
}

function booleanParam(value: string | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

function grants(user: MockUserRecord, permission: string): boolean {
  return permissionsForRole(user.role).includes(permission as never);
}

function forbidden() {
  return error(403, "You do not have access to this resource.", "forbidden");
}

// --- users -----------------------------------------------------------------

function handleUsers(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [target] = segments;

  if (method === "GET" && target === "roles") {
    if (!grants(actor, PERMISSIONS.usersRead)) return forbidden();
    return NextResponse.json(
      ROLES.map((role) => ({
        value: role,
        label: ROLE_LABELS[role],
        permissions: permissionsForRole(role),
      })),
    );
  }

  if (method === "GET" && !target) {
    if (!grants(actor, PERMISSIONS.usersRead)) return forbidden();
    const bounds = paging(search);
    if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

    const { items, total } = mockListUsers(actor.tenantId, {
      q: search.get("q"),
      role: search.get("role"),
      isActive: booleanParam(search.get("is_active")),
      sort: search.get("sort") ?? "full_name",
      descending: search.get("desc") === "true",
      ...bounds,
    });
    return page(items.map(serialiseUser), total, bounds.limit, bounds.offset);
  }

  if (method === "GET" && target) {
    if (!grants(actor, PERMISSIONS.usersRead)) return forbidden();
    const user = mockGetUser(actor.tenantId, target);
    if (!user) return error(403, "You do not have access to this user.", "forbidden");
    return NextResponse.json(serialiseUser(user));
  }

  if (method === "POST" && !target) {
    if (!grants(actor, PERMISSIONS.usersWrite)) return forbidden();

    const input = (body ?? {}) as Record<string, unknown>;
    const fieldErrors: Record<string, string[]> = {};
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const fullName = typeof input.full_name === "string" ? input.full_name.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      fieldErrors.email = ["String should match pattern"];
    }
    if (!fullName) fieldErrors.full_name = ["String should have at least 1 character"];
    if (password.length < MIN_PASSWORD_LENGTH) {
      fieldErrors.password = [
        `String should have at least ${MIN_PASSWORD_LENGTH} characters`,
      ];
    }
    if (!isRole(input.role ?? "sales_rep")) fieldErrors.role = ["Input should be a valid role"];
    if (Object.keys(fieldErrors).length > 0) return invalid(fieldErrors);

    const result = mockCreateUser(actor.id, {
      email,
      fullName,
      role: isRole(input.role) ? input.role : "sales_rep",
      isActive: input.is_active !== false,
      password,
    });
    if (result.kind === "conflict") return error(409, result.detail, "conflict");
    if (result.kind === "forbidden") return error(403, result.detail, "forbidden");
    return NextResponse.json(serialiseUser(result.user), { status: 201 });
  }

  if (method === "PATCH" && target) {
    if (!grants(actor, PERMISSIONS.usersWrite)) return forbidden();

    const input = (body ?? {}) as Record<string, unknown>;
    if (input.role !== undefined && !isRole(input.role)) {
      return invalid({ role: ["Input should be a valid role"] });
    }

    const result = mockUpdateUser(actor.id, target, {
      fullName: typeof input.full_name === "string" ? input.full_name : undefined,
      role: isRole(input.role) ? input.role : undefined,
      isActive: typeof input.is_active === "boolean" ? input.is_active : undefined,
    });
    if (result.kind === "conflict") return error(409, result.detail, "conflict");
    if (result.kind === "forbidden") return error(403, result.detail, "forbidden");
    return NextResponse.json(serialiseUser(result.user));
  }

  return null;
}

// --- audit -----------------------------------------------------------------

function handleAudit(
  method: string,
  segments: string[],
  search: URLSearchParams,
  actor: MockUserRecord,
): NextResponse | null {
  if (method !== "GET") return null;
  if (!grants(actor, PERMISSIONS.auditRead)) return forbidden();

  const [target] = segments;
  if (target === "actions") return NextResponse.json([...AUDIT_ACTIONS]);
  if (target === "entity-types") return NextResponse.json([...AUDIT_ENTITY_TYPES]);
  if (target) return null;

  const bounds = paging(search);
  if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

  const { items, total } = mockListAudit(actor.tenantId, {
    action: search.get("action"),
    entityType: search.get("entity_type"),
    entityId: search.get("entity_id"),
    actorUserId: search.get("actor_user_id"),
    ...bounds,
  });
  return page(items.map(serialiseAudit), total, bounds.limit, bounds.offset);
}

// --- entry point -----------------------------------------------------------

/**
 * Returns a response for a mocked route, or `null` when nothing here covers the
 * path — the proxy then answers 501 rather than pretending the route exists.
 */
export async function handleMockApiRequest(
  request: Request,
  path: string[],
  accessToken: string,
): Promise<NextResponse | null> {
  const actor = mockUserForToken(accessToken);
  if (!actor) {
    return error(401, "Your session has expired.", "unauthorized");
  }

  const search = new URL(request.url).searchParams;
  const [module, ...segments] = path;

  let body: unknown = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
  }

  if (module === "users") {
    return handleUsers(request.method, segments, search, body, actor);
  }
  if (module === "audit") {
    return handleAudit(request.method, segments, search, actor);
  }
  if (module === "accounts") {
    return handleAccounts(request.method, segments, search, body, actor);
  }
  if (module === "contacts") {
    return handleContacts(request.method, segments, search, body, actor);
  }
  return null;
}

function serialiseAccount(acc: MockAccount) {
  return {
    id: acc.id,
    tenant_id: acc.tenantId,
    name: acc.name,
    industry: acc.industry,
    size: acc.size,
    website: acc.website,
    address: acc.address,
    owner_id: acc.ownerId,
    created_at: new Date(acc.createdAt).toISOString(),
    updated_at: new Date(acc.updatedAt).toISOString(),
  };
}

function handleAccounts(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [accountId, subroute] = segments;

  if (!accountId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.accountsRead)) return forbidden();
      const bounds = paging(search);
      if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

      const res = mockListAccounts(actor.tenantId, {
        q: search.get("q") ?? undefined,
        industry: search.get("industry") ?? undefined,
        ownerId: search.get("owner_id") ?? undefined,
        limit: bounds.limit,
        offset: bounds.offset,
      });
      return page(res.items.map(serialiseAccount), res.total, res.limit, res.offset);
    }

    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.accountsWrite)) return forbidden();
      if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
      const b = body as Record<string, unknown>;
      if (!b.name || typeof b.name !== "string" || !b.name.trim()) {
        return invalid({ name: ["Account name is required"] });
      }

      const res = mockCreateAccount(actor.id, {
        name: b.name,
        industry: typeof b.industry === "string" ? b.industry : null,
        size: typeof b.size === "string" ? b.size : null,
        website: typeof b.website === "string" ? b.website : null,
        address: typeof b.address === "string" ? b.address : null,
        ownerId: typeof b.owner_id === "string" ? b.owner_id : null,
      });

      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "conflict") return error(409, res.detail, "conflict");
      return NextResponse.json(serialiseAccount(res.account), { status: 201 });
    }

    return null;
  }

  if (subroute === "contacts") {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.accountsRead)) return forbidden();
      const contacts = mockGetAccountContacts(actor.tenantId, accountId);
      if (!contacts) return forbidden();
      return NextResponse.json(contacts);
    }
    return null;
  }

  // Account detail routes: /accounts/:id
  if (method === "GET") {
    if (!grants(actor, PERMISSIONS.accountsRead)) return forbidden();
    const acc = mockGetAccount(actor.tenantId, accountId);
    if (!acc) return forbidden();
    return NextResponse.json(serialiseAccount(acc));
  }

  if (method === "PATCH") {
    if (!grants(actor, PERMISSIONS.accountsWrite)) return forbidden();
    if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
    const b = body as Record<string, unknown>;

    const res = mockUpdateAccount(actor.id, accountId, {
      name: typeof b.name === "string" ? b.name : undefined,
      industry: typeof b.industry === "string" ? b.industry : b.industry === null ? null : undefined,
      size: typeof b.size === "string" ? b.size : b.size === null ? null : undefined,
      website: typeof b.website === "string" ? b.website : b.website === null ? null : undefined,
      address: typeof b.address === "string" ? b.address : b.address === null ? null : undefined,
      ownerId: typeof b.owner_id === "string" ? b.owner_id : b.owner_id === null ? null : undefined,
    });

    if (res.kind === "forbidden") return forbidden();
    if (res.kind === "conflict") return error(409, res.detail, "conflict");
    return NextResponse.json(serialiseAccount(res.account));
  }

  if (method === "DELETE") {
    if (!grants(actor, PERMISSIONS.accountsWrite)) return forbidden();
    const res = mockDeleteAccount(actor.id, accountId);
    if (res.kind === "forbidden") return forbidden();
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

function handleContacts(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [contactId] = segments;

  if (contactId === "check-duplicate") {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.contactsRead)) return forbidden();
      const email = search.get("email") || "";
      const res = mockCheckDuplicateContact(actor.tenantId, email);
      return NextResponse.json(res);
    }
    return null;
  }

  if (!contactId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.contactsRead)) return forbidden();
      const bounds = paging(search);
      if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

      const res = mockListContacts(actor.tenantId, {
        q: search.get("q") ?? undefined,
        account_id: search.get("account_id") ?? undefined,
        owner_id: search.get("owner_id") ?? undefined,
        sort: search.get("sort") ?? undefined,
        desc: search.get("desc") === "true",
        limit: bounds.limit,
        offset: bounds.offset,
      });
      return page(res.items, res.total, res.limit, res.offset);
    }

    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.contactsWrite)) return forbidden();
      if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
      const b = body as Record<string, unknown>;
      if (!b.first_name || typeof b.first_name !== "string" || !b.first_name.trim()) {
        return invalid({ first_name: ["First name is required"] });
      }
      if (!b.last_name || typeof b.last_name !== "string" || !b.last_name.trim()) {
        return invalid({ last_name: ["Last name is required"] });
      }

      const res = mockCreateContact(actor.id, {
        first_name: b.first_name,
        last_name: b.last_name,
        email: typeof b.email === "string" ? b.email : null,
        phone: typeof b.phone === "string" ? b.phone : null,
        title: typeof b.title === "string" ? b.title : null,
        account_id: typeof b.account_id === "string" ? b.account_id : null,
        owner_id: typeof b.owner_id === "string" ? b.owner_id : null,
      });

      if (res.kind === "forbidden") return forbidden();
      return NextResponse.json(res.contact, { status: 201 });
    }

    return null;
  }

  // Contact detail routes: /contacts/:id
  if (method === "GET") {
    if (!grants(actor, PERMISSIONS.contactsRead)) return forbidden();
    const contact = mockGetContact(actor.tenantId, contactId);
    if (!contact) return forbidden();
    return NextResponse.json(contact);
  }

  if (method === "PATCH") {
    if (!grants(actor, PERMISSIONS.contactsWrite)) return forbidden();
    if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
    const b = body as Record<string, unknown>;

    const res = mockUpdateContact(actor.id, contactId, {
      first_name: typeof b.first_name === "string" ? b.first_name : undefined,
      last_name: typeof b.last_name === "string" ? b.last_name : undefined,
      email: typeof b.email === "string" ? b.email : b.email === null ? null : undefined,
      phone: typeof b.phone === "string" ? b.phone : b.phone === null ? null : undefined,
      title: typeof b.title === "string" ? b.title : b.title === null ? null : undefined,
      account_id: typeof b.account_id === "string" ? b.account_id : b.account_id === null ? null : undefined,
      owner_id: typeof b.owner_id === "string" ? b.owner_id : b.owner_id === null ? null : undefined,
    });

    if (res.kind === "forbidden") return forbidden();
    return NextResponse.json(res.contact);
  }

  if (method === "DELETE") {
    if (!grants(actor, PERMISSIONS.contactsWrite)) return forbidden();
    const res = mockDeleteContact(actor.id, contactId);
    if (res.kind === "forbidden") return forbidden();
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

