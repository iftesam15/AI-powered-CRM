# CRM Backend Folder Structure

| Field | Value |
|---|---|
| Document version | 1.1 |
| Status | **Implemented through Sprint 0** (see section 8) |
| Stack | FastAPI · SQLAlchemy 2 (async) · Alembic · PostgreSQL · Redis |
| Related | [CRM_ARCHITECTURE.md](./CRM_ARCHITECTURE.md), [CRM_USER_STORIES.md](./CRM_USER_STORIES.md), [CRM_SRS.md](./CRM_SRS.md) |

This document defines the **API project layout** (Python package under `src/crm`). Frontend (`Next.js`) lives separately (e.g. `apps/web` or a sibling repo).

---

## 1. Recommended tree

Baseline is your proposed layout, with small additions marked **(+)** for multi-tenant SaaS and SRS coverage.

```text
crm/                                    # backend repo root (or apps/api in a monorepo)
├── alembic/                            # DB migrations (async env)
│   ├── versions/
│   └── env.py
├── alembic.ini
├── pyproject.toml                      # deps + ruff, mypy, pytest
├── .env.example
├── .pre-commit-config.yaml
├── Dockerfile
├── docker-compose.yml                  # api + postgres + redis (+ worker)
├── Makefile                            # run / test / lint / migrate
│
├── src/
│   └── crm/
│       ├── __init__.py
│       ├── main.py                     # app factory; mount routers + middleware
│       │
│       ├── core/                       # cross-cutting infrastructure
│       │   ├── __init__.py
│       │   ├── config.py               # pydantic-settings, env-driven
│       │   ├── database.py             # async engine, session factory, Base
│       │   ├── security.py             # password hashing, JWT encode/decode
│       │   ├── dependencies.py         # get_db, get_current_user, get_tenant, require_role
│       │   ├── exceptions.py           # app exceptions + FastAPI handlers
│       │   ├── middleware.py           # request-id, timing
│       │   ├── logging.py
│       │   ├── pagination.py           # page/cursor helpers + response envelope
│       │   └── rbac.py                  # (+) permission constants / role→perm map
│       │
│       ├── modules/                    # one folder per bounded context
│       │   ├── __init__.py
│       │   ├── tenants/                # (+) SaaS provisioning & tenant settings
│       │   ├── auth/                   # login, logout, refresh, password reset, lockout
│       │   ├── users/                  # (+) admin user CRUD / deactivate (split from auth)
│       │   ├── accounts/
│       │   ├── contacts/
│       │   ├── leads/                  # includes lead → contact/account/opp conversion
│       │   ├── opportunities/
│       │   ├── pipelines/              # pipelines + stages + kanban moves
│       │   ├── activities/             # calls, emails, meetings, notes + timeline
│       │   ├── tasks/                  # (+) due-dated tasks (or nest under activities/)
│       │   ├── search/                 # (+) global search across entities
│       │   ├── data_ops/               # (+) CSV import/export (FR-DATA.*)
│       │   ├── reporting/
│       │   ├── audit/                  # (+) audit log write/read (FR-ADM.3)
│       │   └── notifications/
│       │
│       ├── shared/                     # domain-agnostic reusables
│       │   ├── __init__.py
│       │   ├── base_model.py           # id, timestamps; TenantMixin (tenant_id)
│       │   ├── base_repository.py      # generic CRUD; always scoped by tenant_id
│       │   ├── enums.py
│       │   └── schemas.py              # (+) shared Envelope, Error, Page meta
│       │
│       ├── integrations/               # (+) external adapters (ports)
│       │   ├── __init__.py
│       │   └── mail/
│       │       ├── smtp.py             # SMTP implementation
│       │       └── protocol.py         # MailSender protocol (swap provider later)
│       │
│       └── workers/                    # background jobs
│           ├── celery_app.py           # or arq.py — pick one and stick to it
│           └── tasks/
│               ├── imports.py          # FR-DATA.3 bulk CSV
│               ├── exports.py          # (+) large CSV export
│               ├── mail.py             # (+) send transactional email
│               └── notifications.py    # reminders, assignment emails
│
├── tests/
│   ├── conftest.py                     # test DB, tenant fixtures, AsyncClient
│   ├── factories/                      # (+) model factories (polyfactory / factory_boy)
│   ├── unit/
│   └── integration/
│       └── modules/                    # mirror modules/ (auth, accounts, …)
│
└── scripts/
    ├── seed_data.py
    └── create_tenant.py                # (+) bootstrap first tenant + admin
```

---

## 2. Module file shape (canonical)

Every feature module under `modules/<name>/` should follow the same thin-layer pattern:

```text
modules/<name>/
├── __init__.py
├── router.py           # HTTP only — parse, call service, return schema
├── schemas.py          # Pydantic request/response
├── models.py           # SQLAlchemy ORM (tenant-scoped)
├── service.py          # business rules / orchestration
├── repository.py       # queries only (no business rules)
├── dependencies.py     # module-specific FastAPI Depends (optional)
├── exceptions.py       # module errors (optional if thin)
└── constants.py        # statuses, limits (optional)
```

**Rules of thumb**

| Layer | May | Must not |
|---|---|---|
| `router` | Depend on schemas + service + auth deps | Contain SQL or business rules |
| `service` | Call repositories, other services, integrations | Depend on `Request` / FastAPI types |
| `repository` | Run SQLAlchemy queries | Enforce RBAC or send email |
| `models` | Define tables + relationships | Import routers/schemas |

---

## 3. Module responsibilities (v1)

| Module | Owns | Key stories / FR |
|---|---|---|
| **tenants** | Tenant row, default currency, provisioning | Multi-tenant SaaS |
| **auth** | Login, refresh, password reset, lockout, MFA later | US-AUTH-*, FR-AUTH.* |
| **users** | Invite/create/deactivate users, roles assignment | US-ADM-01, FR-ADM.1 |
| **accounts** | Account CRUD, related lists | US-CON-03–04 |
| **contacts** | Contact CRUD, duplicate warn | US-CON-01–02, 05 |
| **leads** | Lead CRUD, statuses, **conversion** | US-LEAD-* |
| **opportunities** | Deal CRUD, Won/Lost, stage history hooks | US-OPP-* |
| **pipelines** | Pipelines/stages config, kanban move API | US-PIPE-* |
| **activities** | Log call/email/meeting/note, timeline | US-ACT-01, 03 |
| **tasks** | Due dates, assignees, completion | US-ACT-02, 04 |
| **search** | Global search across core entities | US-DATA-01 |
| **data_ops** | CSV import mapping + export | US-DATA-03–05 |
| **reporting** | Dashboards, filters, forecast, report export | US-RPT-* |
| **audit** | Append-only audit entries; admin query | US-ADM-03 |
| **notifications** | In-app + email fan-out | US-NOT-* |

---

## 4. Suggested improvements (vs original sketch)

### Must-have for our locked architecture

1. **`tenants/` module** — Multi-tenant SaaS needs provisioning, settings (default currency), and a first-class `Tenant` model. Do not bury this only in `auth`.
2. **Split `users/` from `auth/`** — Auth = credentials & tokens; Users = admin lifecycle & roles. Keeps routers and permissions clear.
3. **`TenantMixin` + tenant-scoped `BaseRepository`** — Every business row gets `tenant_id`; repositories accept `tenant_id` and never return cross-tenant rows. This is the cheap path to safe SaaS.
4. **`audit/` module** — SRS Must (FR-ADM.3). Prefer explicit service hooks (`audit.record(...)`) over only middleware so business actions are typed.
5. **`data_ops/` (or `imports/` + `exports/`)** — CSV is Must; belongs with workers, not inside `contacts` alone.
6. **`search/` module** — Global search spans entities; a dedicated module avoids circular imports between accounts/contacts/leads/opps.
7. **`integrations/mail/`** — SMTP behind a protocol so providers stay swappable (architecture: SMTP-only v1).

### Strongly recommended

8. **`tasks/` as its own module** (or a clear subpackage under `activities/`) — Tasks have assignees, due dates, and reminder jobs; mixing only into activity “notes” gets messy.
9. **Aggregate API router** — e.g. `modules/api_router.py` or `main.py` includes `APIRouter(prefix="/api/v1")` mounting each module router. Keep versioning in one place.
10. **Health routes** — `GET /health` / `GET /ready` (DB + Redis) outside auth for orchestration.
11. **`tests/factories/`** — Faster, readable integration tests with multi-tenant fixtures (`tenant_a`, `tenant_b` isolation tests).
12. **Pick one job runner** — Document **Celery *or* ARQ** in `pyproject`/`Makefile`; avoid both. ARQ is lighter if the team wants asyncio-native; Celery is more common for ops familiarity.
13. **`core/rbac.py`** — Central permission names (`contacts:write`, `reports:read`) mapped from roles; `require_permission("…")` dependency.
14. **Seed + `create_tenant` script** — First-run path: create tenant → default pipeline/stages → admin user.

### Optional / later

15. **`custom_fields/`** — FR-ADM.2 Should; defer folder until P3.
16. **Outbox / domain events** — Only if audit + notifications need reliable fan-out at scale.
17. **IdP / calendar packages under `integrations/`** — Empty stubs not required until P3.

### Naming / packaging nits

| Original | Suggestion |
|---|---|
| Flat `crm/` as only package | Keep **`src/crm`** (good); ensure `pyproject.toml` has `packages = [{ include = "crm", from = "src" }]` |
| User model only under `auth` | Prefer `users/models.py` with auth importing User; avoids auth owning admin domain |
| `reporting/` | Fine; URL can still be `/api/v1/reports` |
| Missing `__init__.py` in sketch | Add them for clarity under src-layout + mypy |

---

## 5. Cross-cutting wiring

```text
Request
  → middleware (request-id, logging)
  → router
  → dependencies: get_db, get_current_user, get_tenant, require_permission
  → service (tenant_id from user/membership)
  → repository (filter tenant_id)
  → DB
```

- **Never** trust a client-supplied `tenant_id` for authorization; resolve from the authenticated membership.
- Unauthorized / cross-tenant → **403** with a generic body (do not leak existence).
- Password hashing and JWT stay in `core/security.py`; routers stay thin.

---

## 6. What to scaffold first (P0)

Create folders/files in this order:

1. `core/` + `shared/` (Base, TenantMixin, pagination, exceptions)  
2. `tenants/`, `users/`, `auth/`  
3. `accounts/`, `contacts/`  
4. `activities/` (+ `tasks/` if separate)  
5. `audit/` + `integrations/mail/`  
6. Alembic initial migration + `scripts/create_tenant.py`  
7. Integration tests proving **tenant isolation**

Defer until P1+: `leads`, `opportunities`, `pipelines`, `reporting`, `search`, `data_ops`, `notifications` workers.

---

## 7. Alignment with architecture doc

`CRM_ARCHITECTURE.md` §6 previously showed a flatter `app/` layout. **This document supersedes that layout** for the backend: use **`src/crm` + `modules/<context>`** as the source of truth. Product decisions (multi-tenant, FastAPI, SMTP-only, Postgres) are unchanged.

---

## 8. Sprint 0 implementation record

Sprint 0 of [CRM_SPRINT_PLAN.md](./CRM_SPRINT_PLAN.md) is built. The API is an empty but runnable
service: it boots, publishes OpenAPI, answers both probes, and has a migration pipeline that has
been applied to a real PostgreSQL. No business modules yet; those begin in sprint 1.

### 8.1 What exists

```text
apps/api/
├── pyproject.toml               # deps, ruff, mypy (strict), pytest
├── alembic.ini
├── Dockerfile                   # non-root, liveness healthcheck
├── .dockerignore
├── .env.example
├── alembic/
│   ├── env.py                   # async engine, URL from core.config
│   ├── script.py.mako
│   └── versions/
│       └── 0001_baseline_extensions.py
├── src/crm/
│   ├── __init__.py              # __version__
│   ├── main.py                  # create_app(), lifespan, router mounting
│   ├── core/
│   │   ├── config.py            # pydantic-settings, cached
│   │   ├── database.py          # async engine, session factory, Base, get_db
│   │   ├── exceptions.py        # AppError hierarchy + handlers
│   │   ├── health.py            # /health and /ready
│   │   ├── logging.py
│   │   └── middleware.py        # request id + server-timing
│   ├── modules/                 # empty; one package per context from sprint 1
│   ├── shared/
│   ├── integrations/
│   └── workers/
├── scripts/
└── tests/
    ├── conftest.py              # ASGI transport client, no port bound
    └── integration/test_health.py
```

### 8.2 Decisions worth knowing

| Decision | Choice | Why |
|---|---|---|
| App construction | `create_app()` factory, `app` at module level for uvicorn | Tests build isolated instances; settings resolve at call time, not import time |
| Probe placement | `/health` and `/ready` at the root, not under `/api/v1` | They are infrastructure, not a versioned business contract |
| Liveness vs readiness | `/health` never opens a database session; `/ready` does and returns 503 when it fails | A database outage must not make an orchestrator kill an otherwise healthy process. There is a test asserting `/health` opens no session |
| Error shape | One body: `{ detail, code }`, plus `fieldErrors` on 422 | Matches `apps/web/src/types/api.ts`. Changing it changes a contract |
| Cross-tenant access | `PermissionDeniedError` for both "not yours" and "not found" | Distinguishing them would let a caller probe which ids exist in another tenant |
| Migration URL | Alembic reads it from `crm.core.config`, `alembic.ini` leaves it blank | One source of truth; migrations and the app cannot drift onto different databases |
| Naming convention | Set on `Base.metadata` | Without it Postgres invents constraint names and autogenerate churns every run |
| Baseline migration | Extensions only: `pg_trgm`, `citext` | `CREATE EXTENSION` needs rights the application role will not have in a managed environment, so it belongs in the baseline rather than beside the first index that needs it |

### 8.3 Configuration note

`cors_origins` is annotated `Annotated[list[str], NoDecode]`. pydantic-settings tries to JSON-decode
complex types straight from the environment before any validator runs, so a plain
`CORS_ORIGINS=http://localhost:3000` raises a parse error without it. `NoDecode` hands the raw
string to the `field_validator`, which splits on commas.

### 8.4 Verified

Against PostgreSQL 17 running locally:

- `alembic upgrade head`, then `downgrade base`, then `upgrade head` again. Extensions present,
  absent, present. The migration is reversible and re-runnable
- `/health` 200 with service, version and environment
- `/ready` 200 with `database: ok` against a live database, and 503 `degraded` when the session
  factory is made to fail
- `/docs`, `/redoc` and `/openapi.json` all served, with both probes in the schema
- `x-request-id` echoed when supplied, generated when not; `server-timing` present
- Unknown routes return the shared error shape
- 7 tests, `ruff check`, `ruff format --check`, and `mypy --strict` all clean

### 8.5 Running it

`make` is not available on all developer machines, so the npm scripts at the repository root are the
primary interface and the `Makefile` mirrors them. `scripts/api.mjs` resolves the virtualenv
interpreter per platform, so `npm run api:*` behaves the same on Windows, macOS and Linux.

Docker Compose is written but unverified: Docker was not installed on the machine this was built on.
Everything above was checked against a locally installed PostgreSQL instead. The compose file
publishes Postgres on host port **5433** so it does not collide with a local install on 5432.

### 8.6 Not built, deliberately

No `security.py`, `dependencies.py`, `rbac.py` or `pagination.py` yet. Each arrives with the sprint
that first needs it: security and dependencies in sprint 1 with auth, rbac in sprint 2, pagination in
sprint 3 with the first list endpoint. Writing them now would mean guessing at requirements that the
sprint will make concrete.

The web app already expects the sprint 1 auth contract. It is written down at the top of
`apps/web/src/server/auth-service.ts` and is the target for the next sprint.

---

*End of document.*
