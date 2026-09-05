# CRM Sprint Plan — End-to-End Feature Development

| Field | Value |
|---|---|
| Document version | 1.0 |
| Cadence | **1 week per sprint** (adjust to 1.5–2 weeks if learning part-time) |
| Approach | Vertical slices: **API + UI + test** for each feature before moving on |
| Related | [CRM_SRS.md](./CRM_SRS.md) · [CRM_USER_STORIES.md](./CRM_USER_STORIES.md) · [CRM_ARCHITECTURE.md](./CRM_ARCHITECTURE.md) · [CRM_BACKEND_STRUCTURE.md](./CRM_BACKEND_STRUCTURE.md) · [CRM_FRONTEND_STRUCTURE.md](./CRM_FRONTEND_STRUCTURE.md) |
| Live status | **[SPRINT_TRACKER.md](./SPRINT_TRACKER.md)** — where we actually are; this document is the plan and does not change |

---

## How to use this plan

1. **One sprint = one demoable slice.** At the end you should be able to click through the feature in the browser against a real API.
2. **Learn intentionally.** Each sprint lists *concepts to understand* — skim docs / write a short note before coding deep.
3. **Do not skip tenant isolation tests** after Sprint 1 — every later module inherits that pattern.
4. **Order matters.** Later sprints assume auth, tenant context, list/detail patterns, and the activity timeline exist.
5. **Definition of Done (every sprint):** migration applied, happy-path API works, UI wired, at least one integration or e2e check, README/Makefile command works.

### Roadmap at a glance

```text
Sprint 0   Scaffold & Hello World
Sprint 1   Tenants + Auth (login / reset)
Sprint 2   Users, roles, RBAC, audit spine
Sprint 3   Accounts
Sprint 4   Contacts (+ account links)
Sprint 5   Activities & Tasks (timeline)
──────────  P0 complete: usable mini-CRM  ──────────
Sprint 6   Leads + conversion
Sprint 7   Opportunities + Pipeline kanban
──────────  P1 complete: full sales loop  ──────────
Sprint 8   Search + CSV import/export
Sprint 9   Dashboards & reports
──────────  P2 complete: Must-ready product  ──────────
Sprint 10  Hardening + P3 backlog triage
```

---

## Sprint 0 — Project scaffold & “Hello CRM”

**Goal:** Empty but runnable monorepo (or two repos): API health + web health, Postgres + Redis via Docker.

**You will learn**
- FastAPI app factory, uvicorn, src-layout packaging  
- Next.js App Router layout, env vars  
- Docker Compose networking (api ↔ db)  
- Alembic empty migration pipeline  

**Build**

| Layer | Work |
|---|---|
| Ops | `docker-compose.yml` (postgres, redis), `.env.example`, `Makefile` |
| Backend | `src/crm/main.py`, `core/config`, `core/database`, `GET /health` + `/ready` |
| Frontend | `crm-web` bootstrap, shadcn init, `GET` health page or footer status |
| Docs | Root README: how to `make up`, `make migrate`, `make web`, `make api` |

**Demo:** `docker compose up` → open web → see “API healthy”.

**DoD**
- [x] API OpenAPI docs at `/docs`
- [x] Web loads without errors
- [x] One Alembic revision creates empty/base schema (or extensions only)

**Learning checkpoint:** Can you explain why `src/crm` packaging beats a flat `app.py` for imports and tests?

---

## Sprint 1 — Tenants + Authentication (E2E)

**Goal:** Sign up/bootstrap a tenant, log in, log out, forgot/reset password (SMTP optional via Mailhog/Ethereal for local).

**Stories:** US-AUTH-01, US-AUTH-02, US-AUTH-05 (basic rate limit/lockout)

**You will learn**
- Password hashing (Argon2/bcrypt), JWT access + refresh  
- FastAPI dependencies (`get_db`, `get_current_user`)  
- Multi-tenant row: `Tenant` + membership on `User`  
- SMTP adapter + password-reset token lifecycle  
- Next.js auth pages + middleware redirect  

**Build**

| Layer | Work |
|---|---|
| Backend | `tenants`, `auth` modules; `User` model with `tenant_id`; login/refresh/logout; reset flow; lockout counter |
| Backend | `integrations/mail` + worker or sync send for reset email |
| Scripts | `create_tenant.py` (tenant + admin user) |
| Frontend | `(auth)/login`, `forgot-password`, `reset-password`; store session; middleware guards `(dashboard)` |
| Tests | Login success/fail; reset token single-use; **user from tenant A cannot use tenant B context** |

**Demo:** Create tenant via script → login on web → see empty dashboard shell → logout → reset password via emailed link (Mailhog UI).

**DoD**
- [x] Unauthenticated `/api/v1/accounts` → 401
- [x] Dashboard redirects to `/login` when logged out
- [x] Reset email received in local mail catcher

**Learning checkpoint:** Where does `tenant_id` come from on each request, and why must the client not supply it for authorization?

---

## Sprint 2 — Users, RBAC & Audit spine

**Goal:** Admin can invite/deactivate users and assign roles; every mutating call can write an audit row.

**Stories:** US-AUTH-03, US-ADM-01, US-ADM-03

**You will learn**
- Role-based permissions vs role checks alone  
- `require_permission("…")` dependency design  
- Append-only audit log pattern  
- Settings UI patterns in the dashboard shell  

**Build**

| Layer | Work |
|---|---|
| Backend | `users` module; roles: Admin, Sales Manager, Sales Rep, Read-only; permission map in `core/rbac.py` |
| Backend | `audit` module + service hook `audit.record(...)` used from user/auth mutations |
| Frontend | Sidebar + topbar shell; `/settings/users`; permission-gated nav |
| Frontend | `PermissionGate` component (UX only) |
| Tests | Rep cannot deactivate users; Admin can; audit row created on role change |

**Demo:** Login as Admin → create a Sales Rep → login as Rep → settings/users hidden or read-only → Admin sees audit entries.

**DoD**
- [x] Four roles enforced on at least one admin endpoint
- [x] Audit list API + basic settings/audit table (can be minimal)

**Learning checkpoint:** Difference between *authentication* (who you are) and *authorization* (what you’re allowed to do)?

---

## Sprint 3 — Accounts (E2E CRUD)

**Goal:** Full account list → create → detail → edit → soft-block delete rules stub.

**Stories:** US-CON-03, US-CON-04 (related lists stub empty)

**You will learn**
- Module template: router → service → repository → schemas → models  
- Pagination + sorting + filtering  
- shadcn `data-table` + detail page layout  
- Tenant-scoped unique constraints  

**Build**

| Layer | Work |
|---|---|
| Backend | `accounts` module CRUD; fields per SRS; owner_id; list filters |
| Frontend | `/accounts` list, create dialog or `/new`, `/accounts/[id]` |
| Shared | Reuse `PageHeader`, form patterns for later entities |
| Tests | CRUD + tenant isolation (A’s account id → 403/404 for B) |

**Demo:** Create “Acme Corp” → open detail → edit industry → see in list.

**DoD**
- [ ] OpenAPI shows account endpoints
- [ ] List pagination works with >1 page of seed data

**Learning checkpoint:** Why list endpoints should use keyset/cursor or limited OFFSET, not unbounded `SELECT *`?

---

## Sprint 4 — Contacts (E2E + link to Accounts)

**Goal:** Contacts CRUD linked to a primary account; account detail shows related contacts.

**Stories:** US-CON-01, US-CON-02 (primary account), US-CON-04 (contacts on account), US-CON-05 duplicate warn (basic)

**You will learn**
- Foreign keys and nested list APIs  
- Duplicate detection heuristics (email match)  
- Composing detail pages with tabs  

**Build**

| Layer | Work |
|---|---|
| Backend | `contacts` module; `account_id`; duplicate warning on create (non-blocking) |
| Backend | `GET /accounts/{id}` includes or embeds contact summary |
| Frontend | `/contacts` list/detail; account picker; warning banner on duplicate |
| Frontend | Account detail → Contacts tab |
| Tests | Contact must belong to same tenant as account |

**Demo:** From Acme → add contact → open contact → see account link → try duplicate email → see warning.

**DoD**
- [ ] Cannot attach a contact to another tenant’s account
- [ ] Account detail lists contacts

**Learning checkpoint:** How do you validate that `account_id` in the request body is both *valid* and *in-tenant*?

---

## Sprint 5 — Activities & Tasks (timeline)

**Goal:** Log activities on account/contact; create tasks with due dates; chronological timeline on record detail.

**Stories:** US-ACT-01, US-ACT-02, US-ACT-03 (US-ACT-04 reminders can be stub/logged only)

**You will learn**
- Polymorphic relations (`related_entity_type` + `id`)  
- Timeline aggregation query  
- Optional: first Celery/ARQ task for “due soon” log/email  

**Build**

| Layer | Work |
|---|---|
| Backend | `activities`, `tasks` modules; timeline endpoint per entity |
| Frontend | “Log activity” on detail; Tasks widget; shared `ActivityTimeline` |
| Workers | Optional reminder job skeleton |
| Tests | Timeline order; task assignee must be same-tenant user |

**Demo:** On a contact, log a call + create a task due tomorrow → timeline shows both → complete task.

**DoD**
- [ ] Timeline on Account and Contact detail
- [ ] Audit (optional) on activity create

**Learning checkpoint:** Pros/cons of polymorphic FKs vs separate join tables per entity type?

### ★ Milestone — P0 complete

You now have a **multi-tenant mini-CRM**: auth, users, accounts, contacts, activity history. Pause and refactor anything painful in the module template before P1.

---

## Sprint 6 — Leads + Conversion

**Goal:** Capture leads; change status; convert qualified lead → contact + optional account + optional opportunity shell.

**Stories:** US-LEAD-01, US-LEAD-02, US-LEAD-03, US-LEAD-05 (history retained)

**You will learn**
- Multi-step domain transaction (one service method, one DB transaction)  
- Idempotent conversion (`converted` flag)  
- Wizard / modal UX for conversion choices  

**Build**

| Layer | Work |
|---|---|
| Backend | `leads` module; configurable statuses (seed defaults); `convert` endpoint |
| Backend | Preserve lead row after conversion with links to created records |
| Frontend | `/leads` list/detail; status change; Convert dialog |
| Tests | Double-convert rejected; field carry-over verified |

**Demo:** Create lead → mark Qualified → convert to Contact + Account → open created records → lead still visible as converted.

**DoD**
- [ ] Conversion is transactional (all-or-nothing)
- [ ] Converted lead not editable as “active” lead (or clearly locked)

**Learning checkpoint:** Why must conversion run in a single DB transaction?

---

## Sprint 7 — Opportunities + Pipeline kanban

**Goal:** Deals with stages; drag-and-drop board; Won/Lost with loss reason; stage history.

**Stories:** US-OPP-01, US-OPP-02, US-OPP-04, US-OPP-05, US-PIPE-01, US-PIPE-02, US-PIPE-03

**You will learn**
- Stage machine / ordered stages per tenant  
- Optimistic UI updates for DnD  
- Recalculating simple pipeline totals  

**Build**

| Layer | Work |
|---|---|
| Backend | `pipelines` (seed default stages), `opportunities`; move-stage API; stage history; Won/Lost |
| Backend | Admin endpoints to rename/reorder stages |
| Frontend | `/opportunities` list/detail; `/pipeline` kanban (dnd-kit); loss-reason dialog |
| Frontend | `/settings/pipeline` for stage config |
| Tests | Move updates history; Lost without reason → 422; totals change on value/stage update |

**Demo:** Create opp on Acme → see on board → drag to Proposal → mark Lost with reason → board & history update.

**DoD**
- [ ] Default B2B stages seeded per new tenant
- [ ] Kanban reflects API state after refresh

**Learning checkpoint:** How do you keep DnD UX snappy without lying about server failures (rollback optimistic update)?

### ★ Milestone — P1 complete

Full **sales loop**: Lead → Convert → Opportunity → Pipeline → Close.

---

## Sprint 8 — Search + Import / Export

**Goal:** Global search box; CSV import with mapping + per-row errors; permission-safe CSV export.

**Stories:** US-DATA-01, US-DATA-03, US-DATA-04, US-DATA-05

**You will learn**
- Postgres full-text / `pg_trgm` basics  
- Async jobs: enqueue import → poll status → download error report  
- Chunked file processing  

**Build**

| Layer | Work |
|---|---|
| Backend | `search` module; `data_ops` import/export; worker `tasks/imports.py` |
| Frontend | Topbar search + `/search`; `/imports` wizard (upload → map columns → results) |
| Frontend | Export button on list pages |
| Tests | Import partial success; export omits other-tenant rows |

**Demo:** Import 50 contacts CSV (2 bad rows) → 48 created + error CSV → search finds one by email → export list.

**DoD**
- [ ] Large import does not block HTTP (202 + job id)
- [ ] Search returns mixed entity types with links

**Learning checkpoint:** When would you outgrow Postgres FTS and add OpenSearch/Elasticsearch?

---

## Sprint 9 — Dashboards & Reports

**Goal:** Manager dashboard: pipeline value, deals by stage, win rate, activity volume; filters; CSV export of report.

**Stories:** US-RPT-01, US-RPT-02, US-RPT-04 (US-RPT-03 weighted forecast = stretch)

**You will learn**
- Aggregate SQL (`GROUP BY` stage, date filters)  
- Chart library basics  
- Manager vs Rep scoping (own records vs team — start with owner filter) |

**Build**

| Layer | Work |
|---|---|
| Backend | `reporting` aggregates; filter by date/owner/pipeline |
| Frontend | `/dashboard` widgets; `/reports` with filters + export |
| Tests | Read-only role can view reports but not mutate deals |

**Demo:** Seed several opps → dashboard shows by-stage bars → filter last 30 days → export CSV.

**DoD**
- [ ] Numbers match a manual SQL check on seed data
- [ ] Filters reflected in export

**Learning checkpoint:** Why report queries often use separate read-optimized queries (or later materialized views) instead of reusing list endpoints?

### ★ Milestone — P2 complete

Must-priority product path is demoable end-to-end.

---

## Sprint 10 — Hardening, polish & P3 triage

**Goal:** Stabilize what you built; choose next Should/Could items deliberately.

**You will learn**
- Security pass (OWASP basics): authz tests, rate limits, CSRF posture if cookies  
- Performance smoke: indexes, explain on slow lists  
- Backlog grooming  

**Suggested hardening checklist**
- [ ] Tenant isolation test matrix for every module  
- [ ] Consistent error shape + toast mapping on web  
- [ ] Loading/error boundaries on all major routes  
- [ ] Seed script for a full demo tenant (sales story walkthrough)  
- [ ] Basic CI: lint + unit + integration on PR  

**P3 backlog (pick 1–2 after hardening)**

| Item | Story | Notes |
|---|---|---|
| Task reminders email | US-ACT-04 | Worker + SMTP |
| In-app notifications | US-NOT-01 | Bell + assignment events |
| Weighted forecast | US-RPT-03 | Stage probabilities |
| Duplicate merge | US-CON-06 | Careful data rewrite |
| MFA | US-AUTH-04 | |
| Custom fields | US-ADM-02 | |
| SSO | US-AUTH-06 | |
| Multi-pipeline | US-PIPE-04 | |

---

## Suggested weekly rhythm (learning-friendly)

| Day | Focus |
|---|---|
| **Mon** | Read sprint “You will learn”; sketch model + API on paper; write failing test or OpenAPI stub |
| **Tue–Wed** | Backend module to green tests |
| **Thu** | Frontend feature wired to API |
| **Fri** | Demo script, fix sharp edges, short retrospective note (“what was confusing?”) |

If you only have evenings: stretch each sprint to **two weeks**, keeping the same vertical slice (don’t do “all backend for 4 weeks then UI”).

---

## End-to-end demo scripts (use at milestones)

### After Sprint 5 (P0)

1. Bootstrap tenant + admin  
2. Create Sales Rep user  
3. Login as Rep → create Account → add Contact  
4. Log call + task on contact  
5. Login as Admin → confirm audit / user list  

### After Sprint 7 (P1)

1. Create Lead → qualify → convert  
2. Open Opportunity → move stages on kanban  
3. Mark one Won, one Lost (with reason)  

### After Sprint 9 (P2)

1. Import CSV of leads/contacts  
2. Search for an imported record  
3. Open dashboard → export report  

---

## Tracking board (copy into GitHub Projects / Notion)

| Sprint | Status | Started | Demoed | Notes |
|---|---|---|---|---|
| 0 Scaffold | Done | 2026-09-03 | 2026-09-03 | FastAPI + Next.js + Alembic baseline |
| 1 Auth + Tenants | Done | 2026-09-04 | 2026-09-04 | Multi-tenant auth, JWT, lockout, reset, RBAC |
| 2 Users + RBAC + Audit | Done | 2026-09-05 | 2026-09-05 | User admin, `require_permission`, append-only audit |
| 3 Accounts | | | | |
| 4 Contacts | | | | |
| 5 Activities + Tasks | | | | |
| 6 Leads + Convert | | | | |
| 7 Opps + Pipeline | | | | |
| 8 Search + Import/Export | | | | |
| 9 Reporting | | | | |
| 10 Hardening / P3 | | | | |

---

## What we are *not* doing in these sprints

- Native mobile apps, CTI, marketing automation, SSO (until P3 pick)  
- Perfect design system polish before features work  
- Microservices — stay modular monolith  

---

*End of document. When you’re ready, start **Sprint 0** and implement only that slice.*
