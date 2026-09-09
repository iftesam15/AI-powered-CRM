# CRM Sprint Tracker

Living status board for the vertical slices defined in
[CRM_SPRINT_PLAN.md](./CRM_SPRINT_PLAN.md). The plan says *what* each sprint
contains and does not change; this file says *where we are* and is updated at
the start and end of every sprint.

| Field | Value |
|---|---|
| Current sprint | **8 — Search + CSV import/export** |
| Status | ✅ Done |
| Last updated | 2026-09-09 |
| Milestone next up | ★ Sprint 9: Dashboards & Reports |

---

## Board

| Sprint | Scope | Status | Started | Demoed | Slice |
|---|---|---|---|---|---|
| 0 | Scaffold & "Hello CRM" | ✅ Done | 2026-09-03 | 2026-09-03 | API + web + Alembic |
| 1 | Tenants + Authentication | ✅ Done | 2026-09-04 | 2026-09-04 | API + web + tests |
| 2 | Users, RBAC & Audit spine | ✅ Done | 2026-09-05 | 2026-09-05 | API + web + tests |
| 3 | Accounts (E2E CRUD) | ✅ Done | 2026-09-07 | 2026-09-07 | API + web + tests |
| 4 | Contacts (+ account links) | ✅ Done | 2026-09-07 | 2026-09-07 | API + web + tests |
| 5 | Activities & Tasks (timeline) | ✅ Done | 2026-09-08 | 2026-09-08 | API + web + tests |
| 6 | Leads + conversion | ✅ Done | 2026-09-08 | 2026-09-08 | API + web + tests |
| 7 | Opportunities + Pipeline kanban | ✅ Done | 2026-09-09 | 2026-09-09 | API + web + tests |
| 8 | Search + CSV import/export | ✅ Done | 2026-09-09 | 2026-09-09 | API + web + tests |
| 9 | Dashboards & reports | ⬜ Not started | — | — | — |
| 10 | Hardening + P3 triage | ⬜ Not started | — | — | — |

Status key: ⬜ Not started · 🟡 In progress · 🔵 In review · ✅ Done · ⏸️ Parked

**Every sprint is done only when all five hold** (plan, "Definition of Done"):
migration applied · happy-path API works · UI wired · at least one integration
or e2e check · README/Makefile command works.

---

## Sprint 0 — Scaffold & "Hello CRM" ✅

Runnable monorepo: FastAPI on :8000, Next.js on :3000, Postgres/Redis in
Compose, empty Alembic baseline.

- [x] API OpenAPI docs at `/docs`
- [x] Web loads without errors
- [x] One Alembic revision creates the base schema (`0001_baseline`)

**Notes.** Compose publishes Postgres on **5433** to avoid colliding with a
local install. The Docker path is written but unverified — it was built on a
machine without Docker.

---

## Sprint 1 — Tenants + Authentication ✅

Login, logout, refresh, forgot/reset password, lockout, multi-tenant users.

- [x] Unauthenticated `/api/v1/accounts` → 401
- [x] Dashboard redirects to `/login` when logged out
- [x] Reset email delivered (console sender locally, SMTP adapter behind a protocol)

**Shipped**

| Layer | What |
|---|---|
| Backend | `tenants`, `auth`, `users` models; JWT access + rotating refresh; bcrypt; lockout counter; single-use reset tokens |
| Backend | `integrations/mail` (console + SMTP behind `MailSender`) |
| Scripts | `scripts/create_tenant.py`, `scripts/seed_data.py` |
| Frontend | `(auth)/login`, `forgot-password`, `reset-password`; httpOnly cookie session; `proxy.ts` edge gate; authenticated proxy at `/api/crm/*` |
| Tests | `tests/integration/test_auth.py` — login, lockout, single-use reset, tenant isolation |

**Notes.** The access token never reaches browser JavaScript; it lives in an
httpOnly cookie and the Next proxy attaches it server side. Mock auth
(`NEXT_PUBLIC_USE_MOCK_API=true`) reproduces lockout and reset semantics so the
slice is clickable without a backend.

---

## Sprint 2 — Users, RBAC & Audit spine ✅

Admin manages users and roles; every mutating call writes an append-only audit row.

- [x] Four roles enforced on at least one admin endpoint
- [x] Audit list API + settings/audit table

**Shipped**

| Layer | What |
|---|---|
| Backend | `users` module: list (search/filter/paginate), create, read, update, role change, activate/deactivate — all tenant-scoped |
| Backend | `audit` module: append-only `audit_logs`, `AuditService.record(...)`, admin query API |
| Backend | `core/pagination.py` — one list envelope for every module from here on |
| Backend | Audit hooks on auth (login, failed login, lockout, logout, password reset) and on every user mutation |
| Frontend | `/settings/users` list + create/edit dialogs, `/settings/audit` log, `/settings/tenant` read-only org card |
| Frontend | Mock handlers for users + audit so the slice is clickable with `NEXT_PUBLIC_USE_MOCK_API=true` |
| Tests | `tests/integration/test_users.py`, `tests/integration/test_audit.py` |

**Guardrails worth remembering**

- A user cannot change their own role or deactivate themselves — that is the
  fastest way to lock an organisation out of its own tenant.
- The last active admin in a tenant cannot be demoted or deactivated.
- Cross-tenant ids answer `403`, never `404`, so an id cannot be probed for
  existence in another tenant.
- Audit rows are append-only: there is no update or delete route, by design.

**Learning checkpoint.** *Authentication* is who you are — proven once, at
`/auth/login`, and carried by the JWT. *Authorization* is what you may do —
re-derived from the token on every single request by
`require_permission(...)`, never trusted from the client.

---

## Sprint 3 — Accounts ✅

**Goal:** Full account list → create → detail → edit.

- [x] OpenAPI shows account endpoints
- [x] List pagination works with >1 page of seed data
- [x] Tenant isolation test: A's account id → 403 for B

**Shipped**

| Layer | What |
|---|---|
| Backend | `accounts` module CRUD: model, migration `0004_accounts_table`, schemas, repository, service, router |
| Backend | Audit hooks for `account.created`, `account.updated`, `account.deleted` |
| Scripts | `scripts/seed_data.py` seeds accounts under demo tenant |
| Frontend | `/accounts` data table, search/filter, pagination, create/edit modals, `/accounts/[id]` detail view |
| Frontend | Mock store and handlers for `NEXT_PUBLIC_USE_MOCK_API=true` |
| Navigation | `CURRENT_SPRINT = 3` unlocks sidebar navigation item |
| Tests | `tests/integration/test_accounts.py` — CRUD, RBAC, pagination, tenant isolation |

---

## Sprint 4 — Contacts ✅

**Goal:** Contacts CRUD linked to a primary account; account detail shows related contacts; duplicate email warning.

- [x] Cannot attach a contact to another tenant's account (403 Forbidden)
- [x] Account detail lists contacts and provides quick-add contact shortcut
- [x] Duplicate email warning check on contact creation

**Shipped**

| Layer | What |
|---|---|
| Backend | `contacts` module: model, migration `0005_contacts_table`, schemas, repository, service, router |
| Backend | Cross-tenant account linking protection & duplicate email warning endpoint `/contacts/check-duplicate` |
| Backend | Audit hooks for `contact.created`, `contact.updated`, `contact.deleted` |
| Scripts | `scripts/seed_data.py` seeds contacts linked to demo accounts |
| Frontend | `/contacts` data table, search/filter, pagination, create/edit modals with duplicate email banner, `/contacts/[id]` detail view |
| Frontend | Account detail view updated with Contacts tab and quick add button |
| Frontend | Mock store and handlers for `NEXT_PUBLIC_USE_MOCK_API=true` |
| Navigation | `CURRENT_SPRINT = 4` unlocks Contacts navigation item |
| Tests | `tests/integration/test_contacts.py` — CRUD, RBAC, pagination, tenant isolation, cross-tenant account check |

---

## Sprint 5 — Activities & Tasks (timeline) ✅

**Goal:** Log activities on account/contact; create tasks with due dates; chronological timeline on record detail.

- [x] Timeline on Account and Contact detail pages
- [x] Audit entries recorded on activity and task mutations
- [x] System-wide `/activities` and `/tasks` management views

**Shipped**

| Layer | What |
|---|---|
| Backend | `activities` module: models, schemas, repository, service, router (`/activities`, `/activities/timeline`) |
| Backend | `tasks` module: models, schemas, repository, service, router (`/tasks`) |
| Migration | `0006_activities_and_tasks.py` creating `activities` and `tasks` tables with tenant indexes |
| Audit | Audit hooks for `activity.created`, `activity.deleted`, `task.created`, `task.updated`, `task.deleted` |
| Scripts | `scripts/seed_data.py` seeds activities and tasks linked to demo accounts & contacts |
| Frontend | `/activities` page, `/tasks` page with filters and inline status toggle |
| Frontend | Shared `ActivityTimeline`, `LogActivityModal`, and `CreateTaskModal` components |
| Frontend | Account & Contact detail views updated with interactive Activity Timeline tab |
| Frontend | Mock store and handlers for `NEXT_PUBLIC_USE_MOCK_API=true` |
| Navigation | `CURRENT_SPRINT = 5` unlocks Activities and Tasks navigation items |
| Tests | `tests/integration/test_activities.py`, `tests/integration/test_tasks.py` — CRUD, RBAC, tenant isolation, timeline order |

---

## Sprint 6 — Leads + Conversion ✅

**Goal:** Capture leads; change status; convert qualified lead → contact + optional account in a single DB transaction.

- [x] Conversion is transactional (all-or-nothing single DB transaction)
- [x] Converted lead locked from active edits and re-conversion
- [x] Converted lead history retained with links to created records
- [x] Double-convert rejected with clear error

**Shipped**

| Layer | What |
|---|---|
| Backend | `leads` module: model, migration `0007_leads_table`, schemas, repository, service, router (`/leads`, `/leads/{id}/convert`) |
| Migration | `0007_leads_table.py` creating `leads` table with indexes and foreign keys |
| Audit | Audit hooks for `lead.created`, `lead.updated`, `lead.deleted`, `lead.converted` |
| Scripts | `scripts/seed_data.py` seeds initial leads under demo tenant |
| Frontend | `/leads` data table with status filtering tabs, `/leads/[id]` detail view |
| Frontend | `CreateLeadDialog`, `EditLeadDialog`, `ConvertLeadDialog`, `LeadStatusBadge` components |
| Frontend | Mock store and handlers for `NEXT_PUBLIC_USE_MOCK_API=true` |
| Navigation | `CURRENT_SPRINT = 6` unlocks Leads navigation item |
| Tests | `tests/integration/test_leads.py` — CRUD, RBAC, tenant isolation, single-transaction conversion, double-conversion guard, immutability check |

---

## Sprint 7 — Opportunities + Pipeline Kanban ✅ (Milestone ★ P1)

**Goal:** Opportunities CRUD, stage transition history with timestamps & days-in-stage, mandatory loss reason on Closed Lost, weighted forecasting summary, and interactive drag-and-drop Pipeline Kanban board. **Achieves Milestone ★ P1: the complete sales loop: Lead → Convert → Opportunity → Pipeline → Close.**

- [x] Default B2B pipeline and stages provisioned on tenant setup
- [x] Stage transition history logged with timestamps, actors, and days in stage
- [x] Moving to Closed Lost strictly requires a non-empty `loss_reason` (HTTP 422 if empty/whitespace)
- [x] Summary metrics calculate total pipeline value and probability-weighted forecast
- [x] Interactive Kanban board with optimistic drag-and-drop and rollback on failure
- [x] Pipeline stage configuration admin (`/settings/pipeline`) with add, rename, reorder, delete (409 conflict guard)
- [x] Lead conversion seamlessly creates an opportunity in the first pipeline stage
- [x] 104/104 backend tests passing with full tenant isolation and RBAC verification

**Shipped**

| Layer | What |
|---|---|
| Backend | `pipelines` module: models (`Pipeline`, `PipelineStage`), default stage seeding, schemas, repository, service, router (`/pipelines`, `/pipelines/{id}/stages`, `/stages/reorder`) |
| Backend | `opportunities` module: models (`Opportunity`, `OpportunityStageHistory`), CRUD, stage movement, `/won`, `/lost`, `/summary` metrics calculation |
| Migration | `0008_pipelines_and_opportunities.py` creating `pipelines`, `pipeline_stages`, `opportunities`, `opportunity_stage_history` tables |
| Audit | Audit actions: `opportunity.created`, `opportunity.updated`, `opportunity.deleted`, `opportunity.stage_moved`, `opportunity.won`, `opportunity.lost`, `pipeline.created`, `pipeline.stage_reordered` |
| Scripts | `scripts/seed_data.py` seeds default pipeline with 6 stages and 6 realistic opportunities |
| Frontend | `/opportunities` table view with stage/status filter, search, pagination, sort, create/edit modals |
| Frontend | `/opportunities/[id]` detail view with stage timeline history, days-in-stage metrics, quick actions |
| Frontend | `/pipeline` visual Kanban board with `@dnd-kit` drag-and-drop, optimistic UI updates, and real-time forecasting metrics bar |
| Frontend | `/settings/pipeline` stage configuration page to add, edit, reorder, and delete stages |
| Frontend | Lead conversion dialog updated to optionally create an Opportunity directly during qualification |
| Frontend | Mock store and handlers parity for `NEXT_PUBLIC_USE_MOCK_API=true` |
| Navigation | `CURRENT_SPRINT = 7` unlocks Opportunities, Pipeline, and Pipeline Stages navigation items |
| Tests | `tests/integration/test_pipelines.py` and `tests/integration/test_opportunities.py` |

---

## Sprint 8 — Search + CSV import/export ✅

**Goal:** Global search box across all entities; CSV import with column mapping + per-row error report; permission-safe CSV export from list pages.

- [x] Global search box across Accounts, Contacts, Leads, Opportunities (Cmd+K modal & `/search` page)
- [x] Multi-step CSV import wizard with auto header detection, custom column mapping, and per-row error summary
- [x] Permission-safe CSV export on Accounts, Contacts, Leads, and Opportunities tables
- [x] Audit actions logged for import execution and data exports
- [x] All 98 backend integration and unit tests passing

**Shipped**

| Layer | What |
|---|---|
| Backend | `search` module: `SearchService` for cross-entity ILIKE search, `SearchResponse`, `/api/v1/search` endpoint |
| Backend | `data_ops` module: CSV preview, field options, transactional contact import, CSV export generators (`/api/v1/data-ops/*`) |
| Audit | `search:read`, `imports:write`, `exports:read` RBAC permissions and audit trail logging |
| Frontend | Global `SearchCommand` modal (Cmd+K / Ctrl+K), dedicated `/search` page with entity filters |
| Frontend | `/imports` page featuring multi-step `ImportWizard` (CSV upload → column mapping → batch import → error log) |
| Frontend | `ExportButton` added to Accounts, Contacts, Leads, and Opportunities tables |
| Navigation | `CURRENT_SPRINT = 8` unlocks Imports navigation item |
| Tests | `tests/integration/test_search.py` and `tests/integration/test_data_ops.py` |

---

## Sprints 9–10 ⬜

Not started. Scope, learning goals and DoD live in
[CRM_SPRINT_PLAN.md](./CRM_SPRINT_PLAN.md); this file gets a section per sprint
as each one starts.

---

## Carried debt

Things known to be unfinished, deliberately. Reviewed at sprint 10 (hardening).

| # | Item | Since | Notes |
|---|---|---|---|
| 1 | Docker Compose path unverified | S0 | Written on a machine without Docker |
| 2 | No CI | S0 | Lint + typecheck + tests run locally only |
| 3 | Refresh-token rotation has no reuse detection | S1 | A replayed old token is rejected, but the family is not revoked |
| 4 | Mock mode is a parallel implementation | S1 | Every module now needs a mock handler too, or its page 501s by default |
| 5 | Offset pagination, not keyset | S2 | Fine at seed volume; revisit when a list exceeds a few thousand rows |
| 6 | Audit has no retention or export | S2 | Table grows unbounded; no CSV until sprint 8 |
| 7 | `/settings/tenant` is read-only | S2 | Editing org name/currency is not in any sprint yet |

---

## Cadence

One week per sprint, or two if working evenings only. Keep the vertical slice
either way — do not batch "all backend now, all UI later".

| Day | Focus |
|---|---|
| Mon | Read the sprint's "You will learn"; sketch model + API; write a failing test |
| Tue–Wed | Backend module to green tests |
| Thu | Frontend wired to the API |
| Fri | Demo script, sharp edges, retro note in this file |
