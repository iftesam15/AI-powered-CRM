# CRM User Stories

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Draft |
| Source | [CRM_SRS.md](./CRM_SRS.md) |
| Tenancy assumption (v1) | **Single-tenant** |
| Priority | **M** = Must, **S** = Should, **C** = Could (MoSCoW) |

---

## Personas

| Persona | Description |
|---|---|
| **Sales Representative** | Daily user managing own leads, deals, and activities |
| **Sales Manager** | Oversees a team; dashboards, reassignment, forecasting |
| **Administrator** | Configures users, roles, pipeline, fields, data governance |
| **Read-only / Executive** | Consumes dashboards and exports |

---

## 1. Authentication & Authorization

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-AUTH-01 | Sales Representative | to log in with email/username and password | only authorized users access the CRM | M | FR-AUTH.1 |
| US-AUTH-02 | User | to reset my password via a verified, time-limited email link | I can recover access safely | M | FR-AUTH.2 |
| US-AUTH-03 | System / all users | role-based access enforced on every request | users only see and do what their role allows | M | FR-AUTH.3 |
| US-AUTH-04 | User | optional multi-factor authentication (MFA) | my account is harder to compromise | S | FR-AUTH.4 |
| US-AUTH-05 | Administrator | accounts locked or rate-limited after failed logins | brute-force attacks are limited | M | FR-AUTH.5 |
| US-AUTH-06 | User | single sign-on via an external IdP (OIDC/OAuth 2.0) | I can use my company identity | C | FR-AUTH.6 |

### Acceptance criteria

- **US-AUTH-01:** Invalid credentials are rejected; successful login establishes an authenticated session; unauthenticated API calls return 401.
- **US-AUTH-02:** Reset token is single-use and expires; password is stored with a strong salted adaptive hash (e.g. Argon2/bcrypt).
- **US-AUTH-03:** Authorization is enforced server-side; Sales Rep, Manager, Admin, and Read-only receive different allowed results for the same resource.
- **US-AUTH-05:** After a configurable number of failures, further attempts are blocked or throttled until unlock/cooldown.

---

## 2. Contact & Account Management

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-CON-01 | Sales Representative | to create, read, update, and delete contacts (name, email, phone, title, account) | people records stay current | M | FR-CON.1, FR-CON.2 |
| US-CON-02 | Sales Representative | a contact linked to one primary account, with optional related accounts | company relationships are accurate | S | FR-CON.3 |
| US-CON-03 | Sales Representative | to CRUD accounts (name, industry, size, website, address) | companies are tracked | M | FR-CON.4 |
| US-CON-04 | Sales Representative | an account page showing related contacts, opportunities, and activities | I see the full relationship in one place | M | FR-CON.5 |
| US-CON-05 | Sales Representative | a warning when creating a likely duplicate (email/name/domain) | we avoid dirty data | S | FR-CON.6 |
| US-CON-06 | Administrator / Manager | to merge duplicate records while preserving related history | the database stays clean without losing context | C | FR-CON.7 |

### Acceptance criteria

- **US-CON-01 / US-CON-03:** Required fields validated; unauthorized users cannot mutate records.
- **US-CON-04:** Account detail lists linked contacts, opportunities, and a chronological activity view.
- **Delete rule:** Deleting an account is blocked (or explicitly cascade-controlled) when related open opportunities exist.

---

## 3. Lead Management

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-LEAD-01 | Sales Representative | to capture leads with source, status, and owner | inbound interest is tracked | M | FR-LEAD.1 |
| US-LEAD-02 | Administrator | configurable lead statuses (e.g. New, Contacted, Qualified, Disqualified) | the process matches our sales motion | M | FR-LEAD.2 |
| US-LEAD-03 | Sales Representative | to convert a qualified lead into a contact, account, and/or opportunity with fields carried over | I do not re-enter data | M | FR-LEAD.3 |
| US-LEAD-04 | Sales Manager | to assign or reassign leads manually or by rule | workload is balanced | S | FR-LEAD.4 |
| US-LEAD-05 | Manager / Auditor | lead history retained after conversion | the path to a deal is auditable | S | FR-LEAD.5 |

### Acceptance criteria

- **US-LEAD-03:** Conversion creates the chosen records, marks the lead converted, carries over mapped fields, and cannot be run twice on the same lead.
- **US-LEAD-05:** Original lead record remains available for audit after conversion.

---

## 4. Opportunity (Deal) Management

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-OPP-01 | Sales Representative | to CRUD opportunities (name, account/contact, value, currency, expected close date, stage) | deals are managed end to end | M | FR-OPP.1 |
| US-OPP-02 | Sales Representative | stage changes recorded with timestamps | deal progress is auditable | M | FR-OPP.2 |
| US-OPP-03 | Sales Manager | a probability (%) on each stage for weighted forecasting | pipeline forecasts are realistic | S | FR-OPP.3 |
| US-OPP-04 | Sales Representative | to mark opportunities Won or Lost (loss reason required) | outcomes are clear and reportable | M | FR-OPP.4 |
| US-OPP-05 | Sales Manager | pipeline and forecast totals to recalculate when value or stage changes | dashboards stay accurate | M | FR-OPP.5 |

### Acceptance criteria

- **US-OPP-01:** Every opportunity belongs to exactly one active pipeline stage.
- **US-OPP-04:** Lost without a reason is rejected; Won/Lost status appears in reports.
- **US-OPP-05:** Changing value or stage updates aggregated pipeline/forecast figures.

---

## 5. Sales Pipeline

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-PIPE-01 | Sales Representative | a visual pipeline (kanban) of opportunities by stage | I see my pipeline at a glance | M | FR-PIPE.1 |
| US-PIPE-02 | Sales Representative | to move an opportunity between stages via drag-and-drop or an explicit action | stages update quickly | M | FR-PIPE.2 |
| US-PIPE-03 | Administrator | to add, rename, reorder, and remove pipeline stages | the board matches our process | M | FR-PIPE.3 |
| US-PIPE-04 | Administrator | multiple named pipelines (e.g. New Business vs Renewals) | different sales motions stay separate | C | FR-PIPE.4 |

### Acceptance criteria

- **US-PIPE-02:** A move updates the stage, writes stage-change history, refreshes the board, and recalculates totals; unauthorized moves fail.
- **US-PIPE-03:** Stage configuration changes are reflected on the board for all permitted users.

---

## 6. Activity & Task Management

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-ACT-01 | Sales Representative | to log activities (call, email, meeting, note) against contacts, accounts, leads, and opportunities | interaction history is centralized | M | FR-ACT.1 |
| US-ACT-02 | Sales Representative | to create tasks with due dates, priorities, assignees, and company/contact associations (both in-context and from the global task view) | follow-ups are tracked with clear company context | M | FR-ACT.2, FR-ACT.2a |
| US-ACT-03 | Sales Representative | a chronological activity timeline on each record | I can see what happened and when | M | FR-ACT.3 |
| US-ACT-04 | Sales Representative | reminders for upcoming or overdue tasks | I do not miss follow-ups | S | FR-ACT.4 |
| US-ACT-05 | Sales Representative | optional sync of meetings/tasks with an external calendar | my calendar and CRM stay aligned | C | FR-ACT.5 |

### Acceptance criteria

- **US-ACT-02:** Tasks can be created directly from an account/contact record or from the global task view. When created globally, users can optionally associate a company (account) from a selectable list. Both global and record-level task lists clearly display the linked company (with direct navigation link to the account) and contact name.
- **US-ACT-03:** Timeline is chronological (newest first) and includes activities (and related task events) for that record.
- **US-ACT-04:** Reminders are delivered via the notification channel(s) enabled for the user.

---

## 7. Reporting & Analytics

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-RPT-01 | Sales Manager | dashboards for pipeline value, deals by stage, win rate, and activity volume | I can monitor sales health | M | FR-RPT.1 |
| US-RPT-02 | Sales Manager | to filter reports by date range, owner, team, and pipeline | I can drill into my team | M | FR-RPT.2 |
| US-RPT-03 | Manager / Executive | a sales forecast based on weighted opportunity values | I can plan revenue | S | FR-RPT.3 |
| US-RPT-04 | Executive | to export report data to CSV/Excel | I can share or analyze offline | M | FR-RPT.4 |
| US-RPT-05 | Power user | user-defined custom reports on core entities | I can answer ad-hoc questions | C | FR-RPT.5 |

### Acceptance criteria

- **US-RPT-01 / US-RPT-02:** Results respect the viewer’s role and ownership/team scope.
- **US-RPT-04:** Export contains only rows the user is permitted to see.

---

## 8. Search, Import & Export

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-DATA-01 | Sales Representative | global search across contacts, accounts, leads, and opportunities | I find records quickly | M | FR-DATA.1 |
| US-DATA-02 | Sales Representative | saved filters/views | I reopen common lists quickly | S | FR-DATA.2 |
| US-DATA-03 | Administrator / Rep | bulk CSV import of contacts/accounts/leads with field mapping and validation | I can onboard external data | M | FR-DATA.3 |
| US-DATA-04 | Importer | per-row import errors without aborting the entire file | valid rows still load | S | FR-DATA.4 |
| US-DATA-05 | User | to export records to CSV respecting my permissions | I do not leak restricted data | M | FR-DATA.5 |

### Acceptance criteria

- **US-DATA-03 / US-DATA-04:** User maps columns → system validates → import runs (preferably async) → summary of success/fail with a downloadable error report for failed rows.
- **US-DATA-05:** Export filters by the same access rules as list views.

---

## 9. Administration & Configuration

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-ADM-01 | Administrator | to create, deactivate, and manage user accounts and roles | access is controlled | M | FR-ADM.1 |
| US-ADM-02 | Administrator | to define custom fields on core entities | we capture org-specific data | S | FR-ADM.2 |
| US-ADM-03 | Administrator / Auditor | an audit log of security-relevant and data-changing actions | we can investigate and comply | M | FR-ADM.3 |
| US-ADM-04 | Administrator | to configure notification rules | the team is alerted on key events | C | FR-ADM.4 |

### Acceptance criteria

- **US-ADM-01:** Deactivated users cannot log in; role changes take effect on subsequent requests.
- **US-ADM-03:** Audit entries include actor, action, entity, entity id, before/after (where applicable), and timestamp; not editable by normal users.

---

## 10. Notifications

| ID | As a… | I want… | So that… | Priority | FR |
|---|---|---|---|---|---|
| US-NOT-01 | Sales Representative | in-app and email notifications for assignments, mentions, and due tasks | I stay on top of work | S | FR-NOT.1 |
| US-NOT-02 | User | to configure which notifications I receive | I am not overloaded | C | FR-NOT.2 |

### Acceptance criteria

- **US-NOT-01:** Assignment of a record or task produces a notification to the assignee (subject to preferences when US-NOT-02 exists).

---

## Persona → module map

| Persona | Primary story modules |
|---|---|
| Sales Representative | Auth, Contacts/Accounts, Leads, Opportunities, Pipeline, Activities, Search |
| Sales Manager | Team dashboards, reassignment, forecast, pipeline oversight |
| Administrator | Users/roles, stages, custom fields, import, audit |
| Read-only / Executive | Dashboards, filters, export |

---

## Suggested delivery phases

| Phase | Focus | Stories (Must-first) |
|---|---|---|
| **P0** | Auth + CRM core | US-AUTH-01–03, 05; US-CON-01, 03, 04; US-ACT-01–03; US-ADM-01, 03 |
| **P1** | Sales loop | US-LEAD-01–03; US-OPP-01, 02, 04, 05; US-PIPE-01–03 |
| **P2** | Insights + data ops | US-RPT-01, 02, 04; US-DATA-01, 03, 05 |
| **P3** | Should / Could | MFA, SSO, duplicates/merge, custom fields, notifications, multi-pipeline, calendar |

---

## Traceability notes

- Each story maps to one or more `FR-*` IDs in `CRM_SRS.md`.
- Acceptance for release: all **Must (M)** stories pass; no open critical/high defects; NFR thresholds from SRS §5 demonstrated under representative load.
- Story IDs use `US-<AREA>-<n>` for stable references in design, tickets, and tests.

---

*End of document.*
