# CRM Architecture Decisions (v1)

| Field | Value |
|---|---|
| Document version | 1.1 |
| Status | Locked for build (pending scale numbers confirmation) |
| Related | [CRM_SRS.md](./CRM_SRS.md), [CRM_USER_STORIES.md](./CRM_USER_STORIES.md), [CRM_BACKEND_STRUCTURE.md](./CRM_BACKEND_STRUCTURE.md), [CRM_FRONTEND_STRUCTURE.md](./CRM_FRONTEND_STRUCTURE.md) |

---

## 1. Locked product decisions

| Decision | Choice | Notes |
|---|---|---|
| **Deployment** | Multi-tenant SaaS | Shared PostgreSQL + `tenant_id` on all tenant-owned rows |
| **Industry** | Generic B2B | Default account/contact/lead/opp fields; default pipeline stages |
| **Currency** | One default currency per tenant | No multi-currency deals in v1 |
| **UI language** | English-first | Per SRS baseline |
| **Auth (v1)** | Built-in email/password + RBAC | SSO/IdP deferred; MFA = Should (post-MVP ok) |
| **Integrations (v1)** | **SMTP only** | IdP and calendar deferred (see §3) |
| **Tech stack** | **Next.js + FastAPI + PostgreSQL** | See §4 |

---

## 2. Tenancy model

- **Pattern:** Shared database, shared schema, row-level isolation via `tenant_id`.
- **Every** business table includes non-null `tenant_id` (User, Account, Contact, Lead, Opportunity, Pipeline, Stage, Activity, Task, AuditLog, ImportJob, etc.).
- Uniqueness is tenant-scoped, e.g. `UNIQUE(tenant_id, email)` on contacts/users where applicable.
- Request middleware resolves tenant from authenticated session (tenant membership), never from client-supplied id alone.
- Platform **super-admin** (optional, later) is out of band; normal users never cross tenants.
- Provisioning: signup/create-tenant creates tenant row, default pipeline/stages, default currency, first admin user.

### Default pipeline stages (generic B2B)

1. Qualification  
2. Discovery  
3. Proposal  
4. Negotiation  
5. Closed Won  
6. Closed Lost  

(Admin can rename/reorder/add/remove per FR-PIPE.3.)

### Default lead statuses

New → Contacted → Qualified → Disqualified  

---

## 3. Integrations — recommendation for v1

| Integration | v1? | Why |
|---|---|---|
| **SMTP** (transactional email) | **Required** | Password reset, notifications (later), invite emails — blocked without it |
| **IdP / SSO (OIDC)** | **Defer (Could)** | Built-in auth covers FR-AUTH.1–5 Musts; SSO is FR-AUTH.6 Could |
| **Calendar sync** | **Defer (Could)** | FR-ACT.5 Could; tasks/reminders work in-app first |

**Decision: SMTP only for v1.** Design auth and activity modules with clean ports/interfaces so IdP and calendar can plug in later without rewriting core CRM.

---

## 4. Tech stack (locked)

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js (App Router) + TypeScript | CRM UI; consumes OpenAPI from FastAPI |
| **Backend** | **FastAPI** + Python 3.12+ | Async REST, auto OpenAPI, clear router/service layering |
| **ORM / migrations** | **SQLAlchemy 2.x** + **Alembic** | Mature Postgres support; easy `tenant_id` filters and indexes |
| **Validation** | Pydantic v2 | Request/response schemas; shared with FastAPI |
| **Database** | PostgreSQL | SRS system of record; FTS for v1 search |
| **Auth** | JWT access + refresh (or httpOnly session cookies); passlib/argon2 passwords | Dependencies enforce tenant + RBAC on every route |
| **Jobs** | **Celery** or **ARQ** + Redis | CSV import, email send, reminders |
| **Email** | SMTP provider (e.g. Resend, Postmark, SES, or generic SMTP) | Transactional only in v1 |
| **Deploy** | Docker Compose locally; uvicorn/gunicorn workers behind load balancer | Horizontal API tier |

**Stack note:** Frontend stays TypeScript; backend is Python. Contract between them is the FastAPI-generated OpenAPI spec (optional `openapi-typescript` client on the web app).

---

## 5. Scale targets (proposed — confirm numbers)

SRS requires ~500 concurrent users/tenant and list/search over up to ~1M records. For **v1 planning**, use these working targets until you override:

| Dimension | v1 working target | Implication |
|---|---|---|
| Users per tenant | up to **50–100** active | Simple RBAC + team filters enough |
| Concurrent users (platform) | design toward **500** active | Stateless FastAPI replicas + PgBouncer |
| Records per tenant (contacts+leads+opps) | **100k–1M** | Pagination everywhere; composite indexes `(tenant_id, …)` |
| Search | Postgres **full-text** (+ trigram for email/name) | Defer Elasticsearch/OpenSearch until search SLAs fail |
| Import | Async job, chunked CSV | Never block HTTP on large files |

**Confirm or adjust:** typical team size and expected records in year 1. Search/indexing depth depends on that.

### Indexing baseline

- All FKs + `(tenant_id, owner_id)`, `(tenant_id, stage_id)`, `(tenant_id, updated_at)`  
- Email/name search: `pg_trgm` and/or `tsvector` columns per searchable entity  
- List endpoints: cursor or keyset pagination preferred over deep OFFSET  

---

## 6. Application layout (FastAPI)

**Source of truth for folders:** [CRM_BACKEND_STRUCTURE.md](./CRM_BACKEND_STRUCTURE.md) (`src/crm` + per-context `modules/`).

High-level:

```text
crm/                    # backend root
  src/crm/
    main.py
    core/               # config, db, security, deps, middleware
    modules/            # tenants, auth, users, accounts, … (router/schemas/models/service/repository)
    shared/             # TenantMixin, base repository, enums
    integrations/mail/  # SMTP adapter
    workers/            # Celery or ARQ tasks
  alembic/
  tests/
```

API surface (v1): `/auth`, `/users`, `/tenants`, `/accounts`, `/contacts`, `/leads`, `/opportunities`, `/pipelines`, `/activities`, `/tasks`, `/search`, `/imports`/`/exports`, `/reports`, `/audit`, `/notifications`.

Cross-cutting: `get_current_user` / `get_tenant` / `require_permission`, audit hooks, tenant-scoped repositories.

---

## 7. API conventions

- REST, JSON, HTTPS  
- Base path e.g. `/api/v1/...`  
- Auth required except login/reset  
- All list/detail mutations scoped by session `tenant_id`  
- Standard error shape; 403 on cross-tenant or RBAC denial (do not leak existence across tenants)  

---

## 8. Delivery phases (aligned with user stories)

| Phase | Scope |
|---|---|
| **P0** | Tenant provisioning, Auth, Users/Roles, Accounts, Contacts, Activities/Tasks (basic), Audit |
| **P1** | Leads + conversion, Opportunities, Pipeline kanban, stage history |
| **P2** | Dashboards/forecast basics, global search, CSV import/export |
| **P3** | MFA, notifications prefs, custom fields, duplicate merge, SSO, calendar |

---

## 9. Still to confirm

1. **Year-1 scale:** users/tenant and record volume (keep proposed defaults or set exact numbers).  
2. **SMTP provider** preference (generic SMTP vs a specific vendor).  
3. **Hosting** preference (AWS / GCP / Azure / VPS) — does not block local scaffold.  
4. **Repo layout:** monorepo (`apps/web` + `apps/api`) vs separate repos — monorepo recommended for v1.

---

*End of document.*
