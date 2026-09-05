# CRM

Multi-tenant B2B CRM. Next.js web app and a FastAPI backend, built in vertical slices
following [docs/CRM_SPRINT_PLAN.md](./docs/CRM_SPRINT_PLAN.md). Progress is tracked in
[docs/SPRINT_TRACKER.md](./docs/SPRINT_TRACKER.md).

**Current state**

| Sprint | Scope | Status |
|---|---|---|
| 0 | Scaffold: runnable API and web app, health probes, migration pipeline | Done |
| 1 | Tenants and authentication | Done (Web + API) |
| 2 | Users, RBAC and the audit spine | Done (Web + API) |
| 3+ | Accounts, contacts, activities, pipeline | Not started |

The web app's auth flow can run against an in-memory mock (`NEXT_PUBLIC_USE_MOCK_API=true`)
or directly against the live FastAPI backend (`NEXT_PUBLIC_USE_MOCK_API=false`).
The API implements the multi-tenant auth and session contract defined in
[auth-service.ts](./apps/web/src/server/auth-service.ts).

## Layout

```text
.
├── apps/
│   ├── web/                  # Next.js 16, TypeScript, Tailwind v4, shadcn/ui
│   └── api/                  # FastAPI, SQLAlchemy 2 async, Alembic
├── packages/                 # shared code, when there is any
├── scripts/api.mjs           # runs the API venv from anywhere, any platform
├── docs/                     # SRS, architecture, structures, sprint plan
├── docker-compose.yml        # postgres, redis, api
├── Makefile                  # mirrors the npm scripts below
└── preset_logistic_one.css   # design tokens, source of truth for theming
```

## Prerequisites

- Node.js 20.9+
- Python 3.12+
- PostgreSQL 16+ (or Docker, see below)

## Setup

```bash
# Web
npm install
cp apps/web/.env.example apps/web/.env.local

# API
cd apps/api
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # Windows
# .venv/bin/python -m pip install -e '.[dev]'       # macOS / Linux
cp .env.example .env
cd ../..

# Database
createdb crm_dev          # or: psql -U postgres -c "CREATE DATABASE crm_dev"
npm run api:migrate
```

Then run the two halves in separate terminals:

```bash
npm run dev     # web on http://localhost:3000
npm run api     # API on http://localhost:8000
```

Open <http://localhost:3000>. You are redirected to `/login`, where the panel on the left
shows the API connection status. <http://localhost:8000/docs> has the OpenAPI UI.

### With Docker instead

```bash
npm run up      # postgres, redis and the API; migrations run on start
npm run logs
npm run down
```

Compose publishes PostgreSQL on **5433** so it does not collide with a local install on 5432.
This path is written but unverified: it was built on a machine without Docker.

## Signing in

The mock is on by default (`NEXT_PUBLIC_USE_MOCK_API=true`), seeded with one tenant,
Calder Freightways, and one user per role. `npm run api:seed` creates the same set in a
real database.

| Email | Password | Role | Sees |
|---|---|---|---|
| `admin@calderfreight.test` | `Sprint1demo!` | Administrator | Everything, including the audit log |
| `manager@calderfreight.test` | `Sprint1demo!` | Sales manager | The user list, read-only; no audit log |
| `rep@calderfreight.test` | `Sprint1demo!` | Sales representative | No settings at all |
| `finance@calderfreight.test` | `Sprint1demo!` | Read only | Records, nothing writable |

Sign in as each to watch access change. Settings live in the account menu (bottom-left);
which entries appear, and which pages answer at all, both follow the role.

The mock reproduces the behaviours sprints 1 and 2 are judged on:

- Five wrong passwords locks the account for 15 minutes.
- **Forgot password** prints a reset token to the server console and, in mock mode only,
  shows the link on screen so no mail catcher is needed.
- A reset link works exactly once and expires after an hour.
- The same RBAC rules, tenant scoping and guardrails as the API, including the refusal to
  deactivate your own account or demote the last administrator.

Mock mode and the API are independent. The status indicator on the sign-in page reports
whether the backend is reachable either way, so you can develop a module's UI before its
backend exists. Modules with no mock handler answer 501 rather than looking empty.

## Commands

All from the repository root.

| Command | Does |
|---|---|
| `npm run dev` | Web app in development |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run api` | API with reload on :8000 |
| `npm run api:migrate` | Apply migrations to head |
| `npm run api:seed` | Create the demo tenant and one user per role |
| `npm run api:revision -- "message"` | Autogenerate a migration |
| `npm run api:test` | pytest |
| `npm run api:lint` / `api:typecheck` | ruff / mypy strict |
| `npm run up` / `down` / `logs` | Docker stack |

`make` targets mirror these for anyone who has it; `make help` lists them.

## Users, roles and the audit log

Four roles, defined once in [`core/rbac.py`](./apps/api/src/crm/core/rbac.py) and mirrored
in [`lib/permissions.ts`](./apps/web/src/lib/permissions.ts): Administrator, Sales manager,
Sales representative, Read only. Permissions are `<resource>:<action>` strings, and routes
depend on `require_permission("users:write")` rather than checking a role name — so adding
a role later does not mean editing every endpoint.

Authorization is re-derived from the session on **every** request, not baked into the token
at sign-in. Change someone's role and it takes effect on their next request; deactivate
them and their next request fails, without waiting for a token to expire.

Two guardrails exist because both are unrecoverable without another admin or direct
database access:

- You cannot deactivate the account you are signed in with.
- The last active administrator in a tenant cannot be demoted or deactivated.

Every mutation writes an append-only row to `audit_logs` — actor, action, entity, before
and after, IP and request id — on the *same transaction* as the change it describes, so a
rejected edit leaves no record claiming it happened. `/settings/audit` reads it back; there
is no write, update or delete route.

## How auth works

The access token lives in an httpOnly cookie set by Next route handlers, so browser
JavaScript never holds it. Every request to the backend goes through the authenticated
proxy at `/api/crm/*`, which attaches the bearer token server side. See
[docs/CRM_FRONTEND_STRUCTURE.md §9.3](./docs/CRM_FRONTEND_STRUCTURE.md).

## Switching the web app to the real API

Set `NEXT_PUBLIC_USE_MOCK_API=false` in `apps/web/.env.local`, then run the migrations and
seed. No component changes are needed: the mock answers in the same wire format as FastAPI,
so the switch is a no-op for every feature module.

## Design tokens

`preset_logistic_one.css` is the source of truth and is copied verbatim into
`apps/web/src/app/globals.css`, which carries both the light (`:root`) and dark (`.dark`)
token blocks. To change the theme, edit the preset and re-copy it. Do not hardcode colors
in components.

Every token pair the app renders was checked against WCAG AA in both themes and passes.
If you add a pair, check it: the preset's dark block has one trap, where
`--sidebar-primary-foreground` is near-white against an already-light `--sidebar-primary`.
See [docs/CRM_FRONTEND_STRUCTURE.md §9.6](./docs/CRM_FRONTEND_STRUCTURE.md).

## Theming

Light, dark and system, switchable from the toggle in the topbar and on the sign-in pages.
The choice persists per browser and there is no flash of the wrong theme on load.

## MCP

`.mcp.json` registers the shadcn MCP server for component lookup. It connects when a new
Claude Code session starts in this directory; approve it when prompted.
