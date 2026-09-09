import "server-only";

import { NextResponse } from "next/server";

import { PERMISSIONS, permissionsForRole, ROLE_LABELS } from "@/lib/permissions";
import {
  isLocked,
  mockCheckDuplicateContact,
  mockConvertLead,
  mockCreateAccount,
  mockCreateActivity,
  mockCreateContact,
  mockCreateLead,
  mockCreateTask,
  mockCreateUser,
  mockDeleteAccount,
  mockDeleteActivity,
  mockDeleteContact,
  mockDeleteLead,
  mockDeleteTask,
  mockGetAccount,
  mockGetAccountContacts,
  mockGetContact,
  mockGetLead,
  mockGetTimeline,
  mockGetUser,
  mockListAccounts,
  mockListActivities,
  mockListAudit,
  mockListContacts,
  mockListLeads,
  mockListTasks,
  mockListUsers,
  mockListPipelines,
  mockGetDefaultPipeline,
  mockGetPipeline,
  mockCreateStage,
  mockUpdateStage,
  mockDeleteStage,
  mockReorderStages,
  mockListOpportunities,
  mockGetOpportunity,
  mockCreateOpportunity,
  mockUpdateOpportunity,
  mockMoveOpportunityStage,
  mockCloseOpportunityWon,
  mockCloseOpportunityLost,
  mockDeleteOpportunity,
  mockGetPipelineSummary,
  mockUpdateAccount,
  mockUpdateContact,
  mockUpdateLead,
  mockUpdateTask,
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
  if (module === "leads") {
    return handleLeads(request.method, segments, search, body, actor);
  }
  if (module === "activities") {
    return handleActivities(request.method, segments, search, body, actor);
  }
  if (module === "tasks") {
    return handleTasks(request.method, segments, search, body, actor);
  }
  if (module === "pipelines") {
    return handlePipelines(request.method, segments, search, body, actor);
  }
  if (module === "opportunities") {
    return handleOpportunities(request.method, segments, search, body, actor);
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

function handleActivities(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [activityId] = segments;

  if (!activityId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.activitiesRead)) return forbidden();
      const bounds = paging(search);
      if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

      const res = mockListActivities(actor.tenantId, {
        activity_type: search.get("activity_type") ?? undefined,
        entity_type: search.get("entity_type") ?? undefined,
        entity_id: search.get("entity_id") ?? undefined,
        limit: bounds.limit,
        offset: bounds.offset,
      });
      return page(res.items, res.total, res.limit, res.offset);
    }

    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.activitiesWrite)) return forbidden();
      if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
      const b = body as Record<string, unknown>;

      if (!b.activity_type || typeof b.activity_type !== "string") {
        return invalid({ activity_type: ["Activity type is required"] });
      }
      if (!b.title || typeof b.title !== "string" || !b.title.trim()) {
        return invalid({ title: ["Title is required"] });
      }
      if (!b.entity_type || typeof b.entity_type !== "string") {
        return invalid({ entity_type: ["Entity type is required"] });
      }
      if (!b.entity_id || typeof b.entity_id !== "string") {
        return invalid({ entity_id: ["Entity ID is required"] });
      }

      const res = mockCreateActivity(actor.id, {
        activity_type: b.activity_type as "call" | "meeting" | "email" | "note",
        title: b.title,
        description: typeof b.description === "string" ? b.description : null,
        performed_at: typeof b.performed_at === "string" ? b.performed_at : null,
        entity_type: b.entity_type as "account" | "contact",
        entity_id: b.entity_id,
        account_id: typeof b.account_id === "string" ? b.account_id : null,
        contact_id: typeof b.contact_id === "string" ? b.contact_id : null,
      });

      if (res.kind === "forbidden") return forbidden();
      return NextResponse.json(res.activity, { status: 201 });
    }

    return null;
  }

  if (activityId === "timeline" && method === "GET") {
    if (!grants(actor, PERMISSIONS.activitiesRead)) return forbidden();
    const entityType = search.get("entity_type");
    const entityId = search.get("entity_id");
    if (!entityType || !entityId) {
      return invalid({ entity_type: ["entity_type and entity_id are required"] });
    }
    const items = mockGetTimeline(actor.tenantId, entityType, entityId);
    return NextResponse.json(items);
  }

  if (method === "DELETE") {
    if (!grants(actor, PERMISSIONS.activitiesWrite)) return forbidden();
    const res = mockDeleteActivity(actor.id, activityId);
    if (res.kind === "forbidden") return forbidden();
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

function handleTasks(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [taskId] = segments;

  if (!taskId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.tasksRead)) return forbidden();
      const bounds = paging(search);
      if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

      const res = mockListTasks(actor.tenantId, {
        status: search.get("status") ?? undefined,
        priority: search.get("priority") ?? undefined,
        assigned_to_id: search.get("assigned_to_id") ?? undefined,
        entity_type: search.get("entity_type") ?? undefined,
        entity_id: search.get("entity_id") ?? undefined,
        limit: bounds.limit,
        offset: bounds.offset,
      });
      return page(res.items, res.total, res.limit, res.offset);
    }

    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.tasksWrite)) return forbidden();
      if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
      const b = body as Record<string, unknown>;

      if (!b.title || typeof b.title !== "string" || !b.title.trim()) {
        return invalid({ title: ["Title is required"] });
      }

      const res = mockCreateTask(actor.id, {
        title: b.title,
        description: typeof b.description === "string" ? b.description : null,
        status: typeof b.status === "string" ? (b.status as "pending" | "in_progress" | "completed" | "cancelled") : undefined,
        priority: typeof b.priority === "string" ? (b.priority as "low" | "medium" | "high") : undefined,
        due_date: typeof b.due_date === "string" ? b.due_date : null,
        entity_type: typeof b.entity_type === "string" ? b.entity_type : null,
        entity_id: typeof b.entity_id === "string" ? b.entity_id : null,
        account_id: typeof b.account_id === "string" ? b.account_id : null,
        contact_id: typeof b.contact_id === "string" ? b.contact_id : null,
        assigned_to_id: typeof b.assigned_to_id === "string" ? b.assigned_to_id : null,
      });

      if (res.kind === "forbidden") return forbidden();
      return NextResponse.json(res.task, { status: 201 });
    }

    return null;
  }

  if (method === "PATCH") {
    if (!grants(actor, PERMISSIONS.tasksWrite)) return forbidden();
    if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
    const b = body as Record<string, unknown>;

    const res = mockUpdateTask(actor.id, taskId, {
      title: typeof b.title === "string" ? b.title : undefined,
      description: typeof b.description === "string" ? b.description : b.description === null ? null : undefined,
      status: typeof b.status === "string" ? (b.status as "pending" | "in_progress" | "completed" | "cancelled") : undefined,
      priority: typeof b.priority === "string" ? (b.priority as "low" | "medium" | "high") : undefined,
      due_date: typeof b.due_date === "string" ? b.due_date : b.due_date === null ? null : undefined,
      assigned_to_id: typeof b.assigned_to_id === "string" ? b.assigned_to_id : b.assigned_to_id === null ? null : undefined,
    });

    if (res.kind === "forbidden") return forbidden();
    return NextResponse.json(res.task);
  }

  if (method === "DELETE") {
    if (!grants(actor, PERMISSIONS.tasksWrite)) return forbidden();
    const res = mockDeleteTask(actor.id, taskId);
    if (res.kind === "forbidden") return forbidden();
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

function handleLeads(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [leadId, action] = segments;

  if (!leadId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.leadsRead)) return forbidden();
      const bounds = paging(search);
      if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

      const isConvertedParam = search.get("is_converted");
      const res = mockListLeads(actor.tenantId, {
        q: search.get("q"),
        status: search.get("status"),
        is_converted: isConvertedParam !== null ? isConvertedParam === "true" : undefined,
        owner_id: search.get("owner_id"),
        limit: bounds.limit,
        offset: bounds.offset,
      });

      return page(res.items, res.total, res.limit, res.offset);
    }

    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.leadsWrite)) return forbidden();
      if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
      const b = body as Record<string, unknown>;

      if (!b.first_name || typeof b.first_name !== "string" || !b.first_name.trim()) {
        return invalid({ first_name: ["First name is required"] });
      }
      if (!b.last_name || typeof b.last_name !== "string" || !b.last_name.trim()) {
        return invalid({ last_name: ["Last name is required"] });
      }

      const res = mockCreateLead(actor.id, {
        first_name: b.first_name,
        last_name: b.last_name,
        email: typeof b.email === "string" ? b.email : null,
        phone: typeof b.phone === "string" ? b.phone : null,
        company_name: typeof b.company_name === "string" ? b.company_name : null,
        title: typeof b.title === "string" ? b.title : null,
        status: typeof b.status === "string" ? b.status : "new",
        source: typeof b.source === "string" ? b.source : null,
        notes: typeof b.notes === "string" ? b.notes : null,
        owner_id: typeof b.owner_id === "string" ? b.owner_id : null,
      });

      if (res.kind === "forbidden") return forbidden();
      return NextResponse.json(res.lead, { status: 201 });
    }

    return null;
  }

  // Action endpoints on lead: /leads/[id]/convert
  if (action === "convert") {
    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.leadsWrite)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

      const res = mockConvertLead(actor.id, leadId, {
        create_account: typeof b.create_account === "boolean" ? b.create_account : true,
        account_id: typeof b.account_id === "string" ? b.account_id : null,
        account_name: typeof b.account_name === "string" ? b.account_name : null,
        opportunity_name: typeof b.opportunity_name === "string" ? b.opportunity_name : null,
        opportunity_amount: typeof b.opportunity_amount === "number" || typeof b.opportunity_amount === "string" ? b.opportunity_amount : null,
      });

      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "invalid") return invalid({ lead_id: [res.detail] });
      return NextResponse.json(res.result);
    }
    return null;
  }

  if (method === "GET") {
    if (!grants(actor, PERMISSIONS.leadsRead)) return forbidden();
    const lead = mockGetLead(actor.tenantId, leadId);
    if (!lead) return error(403, "You do not have access to this lead.", "forbidden");
    return NextResponse.json(lead);
  }

  if (method === "PATCH") {
    if (!grants(actor, PERMISSIONS.leadsWrite)) return forbidden();
    if (!body || typeof body !== "object") return invalid({ body: ["Required"] });
    const b = body as Record<string, unknown>;

    const res = mockUpdateLead(actor.id, leadId, {
      first_name: typeof b.first_name === "string" ? b.first_name : undefined,
      last_name: typeof b.last_name === "string" ? b.last_name : undefined,
      email: typeof b.email === "string" ? b.email : b.email === null ? null : undefined,
      phone: typeof b.phone === "string" ? b.phone : b.phone === null ? null : undefined,
      company_name: typeof b.company_name === "string" ? b.company_name : b.company_name === null ? null : undefined,
      title: typeof b.title === "string" ? b.title : b.title === null ? null : undefined,
      status: typeof b.status === "string" ? b.status : undefined,
      source: typeof b.source === "string" ? b.source : b.source === null ? null : undefined,
      notes: typeof b.notes === "string" ? b.notes : b.notes === null ? null : undefined,
      owner_id: typeof b.owner_id === "string" ? b.owner_id : b.owner_id === null ? null : undefined,
    });

    if (res.kind === "forbidden") return forbidden();
    return NextResponse.json(res.lead);
  }

  if (method === "DELETE") {
    if (!grants(actor, PERMISSIONS.leadsWrite)) return forbidden();
    const res = mockDeleteLead(actor.id, leadId);
    if (res.kind === "forbidden") return forbidden();
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

function handlePipelines(
  method: string,
  segments: string[],
  _search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [pipelineId, subresource, stageId] = segments;

  if (!pipelineId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.pipelineRead)) return forbidden();
      return NextResponse.json(mockListPipelines(actor.tenantId));
    }
    return null;
  }

  if (pipelineId === "default") {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.pipelineRead)) return forbidden();
      const pipe = mockGetDefaultPipeline(actor.tenantId);
      if (!pipe) return error(404, "Pipeline not found", "not_found");
      return NextResponse.json(pipe);
    }
    return null;
  }

  // /pipelines/[pipelineId]/stages/reorder
  if (subresource === "stages" && stageId === "reorder") {
    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.pipelineConfigure)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      const stages = Array.isArray(b.stages) ? (b.stages as Array<{ id: string; display_order: number }>) : [];
      const res = mockReorderStages(actor.id, pipelineId, stages);
      if (res.kind === "forbidden") return forbidden();
      return NextResponse.json(res.stages);
    }
    return null;
  }

  // /pipelines/[pipelineId]/stages or /pipelines/[pipelineId]/stages/[stageId]
  if (subresource === "stages") {
    if (!stageId) {
      if (method === "POST") {
        if (!grants(actor, PERMISSIONS.pipelineConfigure)) return forbidden();
        const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
        if (!b.name || typeof b.name !== "string") return invalid({ name: ["Required"] });
        const res = mockCreateStage(actor.id, pipelineId, {
          name: b.name,
          display_order: typeof b.display_order === "number" ? b.display_order : undefined,
          probability: typeof b.probability === "number" ? b.probability : undefined,
          is_won: typeof b.is_won === "boolean" ? b.is_won : undefined,
          is_lost: typeof b.is_lost === "boolean" ? b.is_lost : undefined,
        });
        if (res.kind === "forbidden") return forbidden();
        return NextResponse.json(res.stage, { status: 201 });
      }
      return null;
    }

    if (method === "PATCH") {
      if (!grants(actor, PERMISSIONS.pipelineConfigure)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      const res = mockUpdateStage(actor.id, pipelineId, stageId, {
        name: typeof b.name === "string" ? b.name : undefined,
        display_order: typeof b.display_order === "number" ? b.display_order : undefined,
        probability: typeof b.probability === "number" ? b.probability : undefined,
        is_won: typeof b.is_won === "boolean" ? b.is_won : undefined,
        is_lost: typeof b.is_lost === "boolean" ? b.is_lost : undefined,
      });
      if (res.kind === "forbidden") return forbidden();
      return NextResponse.json(res.stage);
    }

    if (method === "DELETE") {
      if (!grants(actor, PERMISSIONS.pipelineConfigure)) return forbidden();
      const res = mockDeleteStage(actor.id, pipelineId, stageId);
      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "conflict") return error(409, res.detail, "conflict");
      return new NextResponse(null, { status: 204 });
    }

    return null;
  }

  if (method === "GET") {
    if (!grants(actor, PERMISSIONS.pipelineRead)) return forbidden();
    const pipe = mockGetPipeline(actor.tenantId, pipelineId);
    if (!pipe) return error(404, "Pipeline not found", "not_found");
    return NextResponse.json(pipe);
  }

  return null;
}

function handleOpportunities(
  method: string,
  segments: string[],
  search: URLSearchParams,
  body: unknown,
  actor: MockUserRecord,
): NextResponse | null {
  const [oppId, action] = segments;

  if (!oppId) {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.opportunitiesRead)) return forbidden();
      const bounds = paging(search);
      if (!bounds) return invalid({ limit: ["Input should be between 1 and 100"] });

      const res = mockListOpportunities(actor.tenantId, {
        q: search.get("q") ?? undefined,
        pipeline_id: search.get("pipeline_id") ?? undefined,
        stage_id: search.get("stage_id") ?? undefined,
        status: search.get("status") ?? undefined,
        owner_id: search.get("owner_id") ?? undefined,
        account_id: search.get("account_id") ?? undefined,
        sort: search.get("sort") ?? undefined,
        order: (search.get("order") as "asc" | "desc") ?? undefined,
        limit: bounds.limit,
        offset: bounds.offset,
      });
      return NextResponse.json(res);
    }

    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.opportunitiesWrite)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      if (!b.name || typeof b.name !== "string") return invalid({ name: ["Required"] });

      const res = mockCreateOpportunity(actor.id, {
        name: b.name,
        amount: typeof b.amount === "number" || typeof b.amount === "string" ? b.amount : 0,
        currency: typeof b.currency === "string" ? b.currency : "USD",
        pipeline_id: typeof b.pipeline_id === "string" ? b.pipeline_id : undefined,
        stage_id: typeof b.stage_id === "string" ? b.stage_id : undefined,
        account_id: typeof b.account_id === "string" ? b.account_id : null,
        primary_contact_id: typeof b.primary_contact_id === "string" ? b.primary_contact_id : null,
        owner_id: typeof b.owner_id === "string" ? b.owner_id : null,
        lead_id: typeof b.lead_id === "string" ? b.lead_id : null,
        expected_close_date: typeof b.expected_close_date === "string" ? b.expected_close_date : null,
        probability: typeof b.probability === "number" ? b.probability : undefined,
        notes: typeof b.notes === "string" ? b.notes : null,
      });

      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "invalid") return invalid({ body: [res.detail] });
      return NextResponse.json(res.opportunity, { status: 201 });
    }

    return null;
  }

  // /opportunities/summary
  if (oppId === "summary") {
    if (method === "GET") {
      if (!grants(actor, PERMISSIONS.opportunitiesRead)) return forbidden();
      const pipelineId = search.get("pipeline_id");
      return NextResponse.json(mockGetPipelineSummary(actor.tenantId, pipelineId));
    }
    return null;
  }

  // Action endpoints on opportunity
  if (action === "move-stage") {
    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.opportunitiesWrite)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      if (!b.stage_id || typeof b.stage_id !== "string") return invalid({ stage_id: ["Required"] });

      const res = mockMoveOpportunityStage(
        actor.id,
        oppId,
        b.stage_id,
        typeof b.loss_reason === "string" ? b.loss_reason : null,
      );
      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "invalid") return error(422, res.detail, "validation_error");
      return NextResponse.json(res.opportunity);
    }
    return null;
  }

  if (action === "won") {
    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.opportunitiesWrite)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      const res = mockCloseOpportunityWon(actor.id, oppId, typeof b.notes === "string" ? b.notes : null);
      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "invalid") return error(422, res.detail, "validation_error");
      return NextResponse.json(res.opportunity);
    }
    return null;
  }

  if (action === "lost") {
    if (method === "POST") {
      if (!grants(actor, PERMISSIONS.opportunitiesWrite)) return forbidden();
      const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      if (!b.loss_reason || typeof b.loss_reason !== "string" || !b.loss_reason.trim()) {
        return error(422, "Loss reason is required when closing an opportunity as Lost.", "validation_error");
      }
      const res = mockCloseOpportunityLost(
        actor.id,
        oppId,
        b.loss_reason,
        typeof b.notes === "string" ? b.notes : null,
      );
      if (res.kind === "forbidden") return forbidden();
      if (res.kind === "invalid") return error(422, res.detail, "validation_error");
      return NextResponse.json(res.opportunity);
    }
    return null;
  }

  if (method === "GET") {
    if (!grants(actor, PERMISSIONS.opportunitiesRead)) return forbidden();
    const opp = mockGetOpportunity(actor.tenantId, oppId);
    if (!opp) return error(403, "You do not have access to this opportunity.", "forbidden");
    return NextResponse.json(opp);
  }

  if (method === "PATCH") {
    if (!grants(actor, PERMISSIONS.opportunitiesWrite)) return forbidden();
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const res = mockUpdateOpportunity(actor.id, oppId, {
      name: typeof b.name === "string" ? b.name : undefined,
      amount: typeof b.amount === "number" || typeof b.amount === "string" ? b.amount : undefined,
      currency: typeof b.currency === "string" ? b.currency : undefined,
      stage_id: typeof b.stage_id === "string" ? b.stage_id : undefined,
      account_id: typeof b.account_id === "string" ? b.account_id : b.account_id === null ? null : undefined,
      primary_contact_id: typeof b.primary_contact_id === "string" ? b.primary_contact_id : b.primary_contact_id === null ? null : undefined,
      owner_id: typeof b.owner_id === "string" ? b.owner_id : b.owner_id === null ? null : undefined,
      expected_close_date: typeof b.expected_close_date === "string" ? b.expected_close_date : b.expected_close_date === null ? null : undefined,
      probability: typeof b.probability === "number" ? b.probability : undefined,
      notes: typeof b.notes === "string" ? b.notes : b.notes === null ? null : undefined,
      loss_reason: typeof b.loss_reason === "string" ? b.loss_reason : undefined,
    });
    if (res.kind === "forbidden") return forbidden();
    if (res.kind === "invalid") return error(422, res.detail, "validation_error");
    return NextResponse.json(res.opportunity);
  }

  if (method === "DELETE") {
    if (!grants(actor, PERMISSIONS.opportunitiesWrite)) return forbidden();
    const res = mockDeleteOpportunity(actor.id, oppId);
    if (res.kind === "forbidden") return forbidden();
    return new NextResponse(null, { status: 204 });
  }

  return null;
}


