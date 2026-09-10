# CRM Frontend Folder Structure

| Field            | Value                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document version | 1.1                                                                                                                                                |
| Status           | **Implemented through Sprint 1** (see §9 for what is built and what changed)                                                                        |
| Stack            | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query v5 · Zod v4                                              |
| Related          | [CRM_ARCHITECTURE.md](./CRM_ARCHITECTURE.md), [CRM_BACKEND_STRUCTURE.md](./CRM_BACKEND_STRUCTURE.md), [CRM_USER_STORIES.md](./CRM_USER_STORIES.md), [CRM_SPRINT_PLAN.md](./CRM_SPRINT_PLAN.md) |

This document defines the web app layout. The FastAPI backend is a separate package (`crm` / `src/crm`). The web app talks to it via a typed API client (OpenAPI-generated types optional).

> **Repo layout decision (supersedes the `crm-web/` path used below).** Per
> [CRM_ARCHITECTURE.md §9](./CRM_ARCHITECTURE.md), the project is a monorepo. The web app lives at
> **`apps/web/`** and the backend will land at **`apps/api/`**, with `packages/` reserved for shared
> code. Everything else in §1 applies unchanged relative to `apps/web/`.

---

## 1. Recommended tree

Baseline is your proposed layout. Additions for multi-tenant SaaS and SRS coverage are marked **(+)**.

```text
crm-web/
├── package.json
├── next.config.ts
├── tsconfig.json                       # "@/*" → src/*
├── .env.example
├── eslint.config.mjs
├── .prettierrc
├── components.json                     # shadcn/ui
├── Dockerfile
├── playwright.config.ts                # (+) e2e (optional v1)
│
├── public/                             # favicons, static assets
│
└── src/
    ├── app/                            # ROUTING ONLY — thin pages
    │   ├── layout.tsx                  # html, fonts, providers
    │   ├── globals.css
    │   ├── not-found.tsx
    │   ├── error.tsx                   # (+) root error boundary
    │   │
    │   ├── (auth)/                     # unauthenticated shell
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── reset-password/page.tsx # (+) token from email link
    │   │
    │   ├── (dashboard)/                # authenticated app
    │   │   ├── layout.tsx              # sidebar + topbar; auth guard
    │   │   ├── page.tsx                # (+) redirect → /dashboard (optional)
    │   │   ├── dashboard/page.tsx
    │   │   ├── contacts/
    │   │   │   ├── page.tsx            # list → features/contacts
    │   │   │   ├── loading.tsx
    │   │   │   ├── error.tsx
    │   │   │   ├── new/page.tsx        # (+) create (or dialog-only — pick one)
    │   │   │   └── [contactId]/
    │   │   │       ├── page.tsx        # detail
    │   │   │       └── loading.tsx
    │   │   ├── accounts/               # same list/detail/loading/error pattern
    │   │   ├── leads/
    │   │   ├── opportunities/
    │   │   ├── pipeline/page.tsx       # kanban
    │   │   ├── activities/
    │   │   ├── tasks/                  # (+) if tasks are first-class in UI
    │   │   ├── search/page.tsx         # (+) global search results
    │   │   ├── reports/
    │   │   ├── imports/                # (+) CSV import wizard (admin/rep)
    │   │   └── settings/
    │   │       ├── page.tsx            # settings hub
    │   │       ├── users/page.tsx
    │   │       ├── roles/page.tsx      # or merge into users
    │   │       ├── pipeline/page.tsx   # stage config
    │   │       ├── tenant/page.tsx     # (+) currency, org profile
    │   │       └── audit/page.tsx      # (+) audit log viewer
    │   │
    │   └── api/
    │       ├── health/route.ts
    │       └── auth/                   # (+) BFF cookie bridge if using httpOnly cookies
    │           └── [...path]/route.ts # optional proxy — only if needed
    │
    ├── features/                       # ONE folder per domain — mirrors backend
    │   ├── auth/
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   ├── api/
    │   │   │   ├── actions.ts          # 'use server' (sparingly — see §4)
    │   │   │   └── queries.ts
    │   │   ├── schemas.ts              # zod (mirror Pydantic)
    │   │   ├── types.ts
    │   │   └── index.ts                # (+) public exports for the feature
    │   ├── tenants/                    # (+) org settings, currency display
    │   ├── users/                      # (+) settings users/roles UI
    │   ├── contacts/
    │   ├── accounts/
    │   ├── leads/                      # convert-to-opportunity UI
    │   ├── opportunities/
    │   ├── pipeline/                   # kanban board + DnD
    │   ├── activities/                 # timeline + log activity
    │   ├── tasks/                      # (+) task list / reminders UI
    │   ├── search/                     # (+) global search UI
    │   ├── data-ops/                   # (+) import mapping wizard + export triggers
    │   ├── reporting/
    │   ├── audit/                      # (+) settings audit table
    │   └── notifications/              # bell, prefs later
    │
    ├── components/
    │   ├── ui/                         # shadcn primitives only
    │   │   ├── button.tsx
    │   │   ├── dialog.tsx
    │   │   ├── data-table.tsx
    │   │   └── ...
    │   ├── layout/                     # AppSidebar, Topbar, PageHeader, AppShell
    │   └── shared/                     # (+) EmptyState, ConfirmDialog, PermissionGate
    │
    ├── lib/
    │   ├── api-client.ts               # fetch wrapper: base URL, auth header/cookie
    │   ├── query-client.ts             # TanStack Query defaults
    │   ├── auth.ts                     # session read/clear helpers
    │   ├── utils.ts                    # cn(), formatMoney, formatDate
    │   ├── constants.ts
    │   └── permissions.ts              # (+) client-side nav/action gates (UX only)
    │
    ├── hooks/                          # global only (useDebounce, useMediaQuery)
    ├── providers/                      # QueryProvider, ThemeProvider, Toaster, AuthProvider
    ├── config/
    │   ├── env.ts                      # (+) zod-validated public env
    │   ├── navigation.ts               # (+) sidebar items + required permissions
    │   └── routes.ts                   # (+) typed path helpers
    ├── types/                          # cross-feature shared types
    ├── styles/                         # tokens / extras if not all in globals.css
    └── middleware.ts                   # (+) protect (dashboard)/*, redirect unauthenticated
```

---

## 2. Layer rules

| Layer                | Responsibility                             | Must not                                                                           |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `app/**/page.tsx`    | Compose feature components; set metadata   | Own fetch logic or business rules                                                  |
| `app/**/layout.tsx`  | Shell, providers, auth gate                | Domain forms or API calls beyond session check                                     |
| `features/<domain>/` | UI, hooks, schemas, API for that domain    | Import another feature’s internals (use `index.ts` or lift to `components/shared`) |
| `components/ui/`     | Design-system primitives                   | Know about contacts/leads/etc.                                                     |
| `lib/api-client.ts`  | HTTP, auth attachment, error normalization | Feature-specific endpoints (those live in `features/*/api`)                        |

**Canonical feature shape** (match backend modules):

```text
features/<name>/
├── components/
├── hooks/
├── api/
│   ├── queries.ts      # TanStack Query queryFns / queryOptions
│   └── mutations.ts    # (+) prefer over dumping everything in actions.ts
├── schemas.ts
├── types.ts
├── store.ts            # only if client UI state cannot live in URL/query cache
└── index.ts
```

---

## 3. Feature ↔ backend ↔ routes map

| Feature       | Backend module | Primary routes                                  |
| ------------- | -------------- | ----------------------------------------------- |
| auth          | auth           | `/login`, `/forgot-password`, `/reset-password` |
| tenants       | tenants        | `/settings/tenant`                              |
| users         | users          | `/settings/users`                               |
| contacts      | contacts       | `/contacts`, `/contacts/[id]`                   |
| accounts      | accounts       | `/accounts`, `/accounts/[id]`                   |
| leads         | leads          | `/leads`, convert dialog/flow                   |
| opportunities | opportunities  | `/opportunities`, `/opportunities/[id]`         |
| pipeline      | pipelines      | `/pipeline`                                     |
| activities    | activities     | embedded on record detail + `/activities`       |
| tasks         | tasks          | `/tasks` or widgets on dashboard                |
| search        | search         | `/search` + topbar command                      |
| data-ops      | data_ops       | `/imports`                                      |
| reporting     | reporting      | `/reports`, `/dashboard` widgets                |
| audit         | audit          | `/settings/audit`                               |
| notifications | notifications  | topbar bell                                     |

---

## 4. Suggested improvements (vs original sketch)

### Must-have for locked product decisions

1. **`middleware.ts` auth gate** — Protect `(dashboard)/*` at the edge; don’t rely only on layout checks (layout alone is easy to miss on nested routes).
2. **`reset-password/page.tsx`** — SRS Must (FR-AUTH.2); forgot-password alone is incomplete.
3. **`features/tenants` + settings/tenant** — Multi-tenant SaaS: show org name, default currency; admin edits tenant settings.
4. **`features/users` under settings** — Mirrors backend split (auth vs users); don’t overload `features/auth` with user admin tables.
5. **Global search UI** — Topbar search + `/search` results (FR-DATA.1).
6. **Import/export UI (`features/data-ops`)** — CSV mapping wizard is a Must; needs its own feature, not buried in contacts only.
7. **Audit settings page** — FR-ADM.3 Must for admins.
8. **`PermissionGate` / nav permissions** — Hide actions the role can’t use (UX only; API still enforces). Align with `core/rbac.py` permission names.

### Strongly recommended

9. **Prefer TanStack Query mutations over many `'use server'` actions** — With an external FastAPI backend, the straightforward path is: browser/client → `api-client` → FastAPI. Use server actions only when you intentionally want a BFF (cookie exchange, secrets). Mixing both without a rule creates duplicate API paths.
10. **Auth session strategy — pick one and document in `.env.example`:**
    - Access token in httpOnly cookie set by BFF after login.  
      Avoid storing long-lived tokens in `localStorage` if you can.

11. **List route conventions** — Same pattern for every entity: `page.tsx` + `loading.tsx` + `error.tsx` + `[id]/page.tsx`. Add `new/` **or** create-via-dialog consistently (prefer one pattern).
12. **`features/*/index.ts`** — Public barrel so `app/` imports `@/features/contacts` not deep internals.
13. **`components/shared/`** — Empty states, confirm delete, duplicate-warning banner, activity timeline shell reused on account/contact/lead/opp.
14. **Record detail composition** — Shared `RecordDetailLayout` (header, tabs: Overview / Activity / Tasks) to avoid four divergent detail pages.
15. **Pipeline DnD** — Keep kanban in `features/pipeline`; use a small library (e.g. dnd-kit); optimistic stage moves via mutation + invalidate.
16. **Env validation** — `config/env.ts` with zod (`NEXT_PUBLIC_API_URL`, etc.) fail fast at startup.
17. **Command palette (optional P2)** — Same search API; improves “find record fast” UX.

### Gaps to avoid

| Gap                                                      | Risk                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| No tenant context in client                              | Wrong org branding/currency; harder debugging                                                     |
| Business logic in `page.tsx`                             | Unreachable reuse; fat routes                                                                     |
| Cross-imports `features/a` → `features/b/components/...` | Tangled graph; lift shared UI instead                                                             |
| Client-only RBAC                                         | False sense of security — always enforce on API                                                   |
| Missing `tasks` / only “activities”                      | Hard to build due-date lists and reminders UI                                                     |
| No import feature folder                                 | CSV Must will get bolted onto contacts awkwardly                                                  |
| `store.ts` everywhere                                    | Prefer URL search params + Query cache; Zustand only for ephemeral UI (kanban drag overlay, etc.) |

### Optional later (P3)

- MFA challenge UI under `features/auth`
- Notification preferences page
- Custom fields settings UI
- Playwright e2e for login → create contact → log activity
- OpenAPI → `openapi-typescript` generated types under `src/types/api`

---

## 5. Data fetching pattern (recommended)

```text
User interaction
  → feature hook (useContacts / useCreateContact)
  → TanStack Query (queryKey includes tenant-agnostic keys; server scopes by token)
  → lib/api-client.ts (Authorization / cookies)
  → FastAPI /api/v1/...
```

**Query key convention:** `['contacts', 'list', filters]`, `['contacts', 'detail', id]` — invalidate on mutation success.

**Server Components:** Use sparingly for static shells; CRM screens are highly interactive (tables, filters, kanban) → Client components + Query is the default inside features.

---

## 6. Auth & multi-tenant UX

- After login, session carries **user + tenant** (name, default currency, role).
- Sidebar `config/navigation.ts` filters items by permission.
- Format money with **tenant default currency** (`lib/utils.ts` / tenant context).
- 401 → clear session → `/login`. 403 → toast / forbidden empty state (no cross-tenant leakage).

---

## 7. What to scaffold first (P0 UI)

1. `app` shells: `(auth)` + `(dashboard)` layouts, middleware
2. `providers`, `lib/api-client`, `config/env`, shadcn `ui/` + `data-table`
3. `features/auth` (login, forgot/reset password)
4. `features/contacts` + `features/accounts` list/detail
5. Shared activity timeline on detail pages
6. `settings/users` (admin) + basic dashboard placeholder

Defer: pipeline kanban, leads conversion, reports charts, import wizard, search page polish.

---

## 8. Alignment with other docs

| Doc                        | Relationship                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `CRM_BACKEND_STRUCTURE.md` | Feature folders should mirror backend `modules/` names where possible |
| `CRM_ARCHITECTURE.md`      | Next.js + FastAPI; SMTP-driven reset flows need reset-password UI     |
| `CRM_USER_STORIES.md`      | Route inventory should cover Must stories in P0–P2                    |

This document is the **source of truth for `crm-web` folder layout**.

---

## 9. Sprint 1 implementation record

Sprint 1 of [CRM_SPRINT_PLAN.md](./CRM_SPRINT_PLAN.md) is built on the frontend side. This section records what exists, the decisions that were locked, and where the code deviates from §1–§8 above.

### 9.1 Locked decisions

| Decision | Choice | Consequence |
|---|---|---|
| Repo layout | Monorepo: `apps/web`, `apps/api`, `packages/`, npm workspaces | Run everything from the repo root |
| Auth session | **BFF httpOnly cookie** (§4.10, option 1) | The browser never holds a token; see §9.3 |
| Backend stand-in | In-memory mock behind `NEXT_PUBLIC_USE_MOCK_API` | The Sprint 1 flow is clickable before FastAPI exists |
| Design tokens | `style-presets/claude_blue_2.css` copied verbatim to `src/app/globals.css` | Do not hand-edit colors; edit the preset and re-copy |
| Component source | shadcn/ui `new-york`, fetched from the registry | 24 primitives in `src/components/ui/` |
| Icons | `lucide-react` | One family only, see §9.6 |

### 9.2 What is built

```text
apps/web/src/
├── proxy.ts                          # edge auth gate (was middleware.ts, see §9.4)
├── app/
│   ├── layout.tsx                    # Inter via next/font, AppProviders
│   ├── globals.css                   # the Logistic One preset, unmodified
│   ├── page.tsx  error.tsx  not-found.tsx
│   ├── (auth)/                       # split-panel shell
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # server-side session check, redirects on failure
│   │   ├── error.tsx
│   │   └── dashboard/{page,loading}.tsx
│   └── api/
│       ├── health/route.ts
│       ├── auth/{login,logout,session,forgot-password,reset-password}/route.ts
│       └── crm/[...path]/route.ts    # authenticated proxy to FastAPI
├── features/
│   ├── auth/{components,hooks,api,schemas.ts,types.ts,index.ts}
│   └── dashboard/components/
├── components/
│   ├── ui/                           # 24 shadcn primitives
│   ├── layout/                       # AppShell, AppSidebar, Topbar
│   └── shared/                       # PageHeader, EmptyState, FormAlert,
│                                     #   SubmitButton, PermissionGate
├── lib/                              # api-client, query-client, permissions,
│                                     #   constants, utils
├── config/                           # env (zod-validated), routes, navigation
├── providers/                        # AppProviders, Query, Theme, Session
├── server/                           # server-only: upstream, session, auth-service,
│                                     #   mock/store
├── hooks/                            # use-mobile, use-debounce
└── types/                            # session, api
```

### 9.3 Auth data flow (as built)

```text
Login
  browser  -> POST /api/auth/login          (Next route handler)
           -> server/auth-service.login()
           -> FastAPI POST /api/v1/auth/login   [or the mock store]
           <- httpOnly crm_session + crm_refresh cookies, session JSON in the body

Every later request
  browser  -> lib/api-client  ->  /api/crm/<path>   (Next proxy route)
           -> attaches Bearer from the cookie, server side
           -> FastAPI /api/v1/<path>
           on 401: one refresh, one replay, then 401 through to the client
```

Two consequences worth stating plainly:

1. **`lib/api-client.ts` targets `/api/crm`, not `NEXT_PUBLIC_API_URL` directly.** With the token in an httpOnly cookie the browser cannot authenticate to FastAPI itself, so the proxy is load-bearing, not optional. §1 listed it as "optional proxy — only if needed"; the cookie decision makes it needed.
2. **The gate is in two halves.** `proxy.ts` only checks that a cookie is *present*, because the edge cannot validate a token without an API call. `(dashboard)/layout.tsx` then verifies the token with the API before rendering. Neither half is sufficient alone.

Server actions are not used. Per §4.9 the app has one path to the API, and that path is the proxy.

### 9.4 Deviations from §1

| §1 says | Built as | Why |
|---|---|---|
| `src/middleware.ts` | `src/proxy.ts` | Next 16 deprecated the `middleware` file convention. Same gate, current name. Migrated with `@next/codemod middleware-to-proxy` |
| `api/auth/[...path]/route.ts` | Five named routes under `api/auth/`, plus `api/crm/[...path]` | Named routes validate their own bodies with the same Zod schemas the forms use. A catch-all could not |
| `lib/auth.ts` | `server/session.ts` | Cookie helpers are server-only. Keeping them under `server/` makes an accidental client import a build error rather than a runtime surprise |
| `features/auth/api/actions.ts` | `features/auth/api/mutations.ts` | §4.9 prefers Query mutations over server actions with an external API |
| `styles/` | not created | The preset covers all tokens; a second styling location invites drift |
| `data-table.tsx` in `components/ui` | not yet | Nothing lists records until Sprint 3. `@tanstack/react-table` is installed and ready |

### 9.5 Sprint-aware navigation

`config/navigation.ts` carries the whole information architecture, and each item declares the sprint that delivers it. Items above `CURRENT_SPRINT` render disabled with a sprint badge instead of linking to a route that does not exist. **Raise `CURRENT_SPRINT` as each sprint lands.**

Visibility is filtered by `lib/permissions.ts`, whose permission names follow the `<resource>:<action>` convention that `core/rbac.py` must match. Once the backend returns an explicit permission list on `/auth/me`, that list wins and the local role map is only a bootstrap default. These gates are UX only; the API remains the sole enforcement boundary.

**Settings live in the account menu, not as a sidebar group.** Measured in headless Chrome, the
sidebar nav with a Settings group needed 734px and so scrolled on any viewport under about 890px,
which is most laptops. Moving those four entries into the footer dropdown drops the requirement to
537px, and the nav now fits down to roughly a 660px viewport. Permission filtering is unchanged: an
administrator sees the four settings entries in the menu, a sales rep sees none.

**Budget for it.** Each nav row costs about 31px and each group label about 31px more, against
roughly 615px of usable column at a 768px viewport. Adding a fifth group, or more than about four
further rows, puts the scrollbar back. `SidebarContent` still scrolls below that, with the scrollbar
styled thin and in `--sidebar-border` so it reads as part of the panel rather than browser chrome.

### 9.6 Design system and theming

**Tokens.** `globals.css` is `style-presets/claude_blue_2.css` byte for byte, plus one `tw-animate-css` import that the shadcn animations need. Colors, radius, shadows and fonts all come from the preset, and no component hardcodes a color. Note that the build re-encodes `oklch()` into a hex fallback plus `lab()`; the values are preserved, so grepping the built CSS for the preset's literal `oklch(...)` strings will not match.

**Light and dark.** `next-themes` with `attribute="class"`, matching the preset's `@custom-variant dark (&:is(.dark *))`. Changing one without the other breaks theming silently. `enableColorScheme` is left on so native controls and scrollbars follow the theme, and `disableTransitionOnChange` prevents a colour sweep on switch.

`components/shared/theme-toggle.tsx` offers light / dark / system and appears in the topbar and on the auth pages. Its trigger swaps icons with the `dark:` variant rather than from `useTheme()`: the server cannot know the visitor's theme, so rendering the icon from state would either mismatch on hydration or blank the button behind a mounted flag. Both icons are in the DOM and CSS picks one. The menu body reads the active theme safely because it only mounts on open. The theme control is not duplicated in the user menu.

**Font.** Inter, via `next/font`, because the preset names it in `--font-sans`.

### 9.6.1 Design audit (design-taste-frontend-v1)

Applied, with results:

| Rule | Outcome |
|---|---|
| Contrast on every rendered token pair | **One real defect fixed.** The preset's dark block pairs a light-blue `--sidebar-primary` with a near-white `--sidebar-primary-foreground` (3.14:1). The brand mark and avatar now pair `--primary-foreground`, which inverts correctly per theme: 9.57:1 light, 6.05:1 dark. Both are preset tokens, so the preset itself is untouched |
| Anti card-overuse | Dashboard tiles were four card containers holding no data, and in dark mode `--card` sits 1.03:1 from `--background`, so they were near-invisible. Now grouped by hairline rules (`gap-px` over a border-coloured parent) with no card chrome |
| Tactile `:active` feedback | Moved onto the base `Button` variant so every button gets it, with a `motion-reduce` opt-out |
| Viewport stability | `min-h-svh` to `min-h-dvh` on all full-height shells |
| Layout containment | Shell container `max-w-6xl` to `max-w-7xl` |
| No stock placeholder brands | Mock tenant renamed from Northwind Freight, a Microsoft sample-database name, to Calder Freightways |
| No emoji in markup | Verified across all 85 source files: zero |
| Loading / empty / error states | Present on every route built so far |
| Label above input, no placeholder-as-label | Held throughout |
| Grid over flex percentage math | Held throughout |

Deliberate deviations, each because an explicit instruction or a locked decision outranks the rule:

| Rule | Why not applied |
|---|---|
| "Inter is banned, use Geist or Satoshi" | The preset sets `--font-sans: Inter`, and the preset is the specified source of truth for styling |
| "Icons must be `@phosphor-icons/react` or `@radix-ui/react-icons`" | shadcn primitives import `lucide-react` directly. Switching only app-level icons would put two icon families in one tree, which is worse than the rule it would satisfy. One family, consistently |
| "The blue/indigo accent is banned" | The accent is the preset's brand colour, not an AI default reach |
| Perpetual micro-animation, magnetic hover, spring physics | Wrong for a CRM that will carry dense tables and a kanban board. The v2 revision of this same skill states dashboards and dense product UI are out of its scope, and its landing-page rules were likewise not applied |
| "No 3-column card rows" | Not triggered: the tiles are no longer cards |

**Honest placeholders.** The tiles and the disabled search control name the sprint that fills them rather than showing invented figures.

### 9.7 Verified against a running server

Production build, then live checks: guard redirects with `?next=` preservation, signed-out `401`s, login success and failure, lockout after five failed attempts, single-use and expiry-checked reset tokens, password policy rejection, logout invalidating the session, and role-scoped navigation (a sales rep sees no admin-only items). Build, `tsc --noEmit` and `eslint` are all clean. After the design pass in §9.6.1 the suite was re-run, plus a scripted contrast audit over the built stylesheet: 0 failures across both themes.

Two lint errors in shadcn's own generated code were fixed rather than suppressed: `use-mobile.ts` set state inside an effect (now `useSyncExternalStore`), and `SidebarMenuSkeleton` called `Math.random()` during render (now derived from `useId`).

### 9.8 Not built, deliberately

Everything above Sprint 1: record lists and detail pages, the activity timeline, pipeline kanban, search, imports, reports, and the settings pages. `features/` holds only `auth` and `dashboard`; the remaining feature folders are created when their sprint starts, not in advance.

---

_End of document._
