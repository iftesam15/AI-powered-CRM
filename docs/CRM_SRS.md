# Software Requirements Specification (SRS)
## Customer Relationship Management (CRM) System

| Field | Value |
|---|---|
| Document version | 1.0 |
| Status | Draft |
| Standard basis | ISO/IEC/IEEE 29148:2018 (aligned with IEEE 830) |
| Prepared for | *(Organization / stakeholder)* |
| Date | *(Fill in)* |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for a **standard sales-focused CRM system**. It is intended for product owners, architects, developers, QA engineers, and stakeholders who will design, build, verify, and sign off on the system. Each requirement is uniquely identified to support traceability from design through testing.

### 1.2 Scope
The CRM centralizes the management of customer and prospect relationships across the sales lifecycle. In scope:
- Contact, account, lead, and opportunity (deal) management
- Sales pipeline and activity tracking
- Reporting, dashboards, and analytics
- User, role, and permission administration
- Notifications, search, and data import/export

**Out of scope** for this baseline (candidates for later phases): full marketing automation, ticketing/help-desk, e-commerce, telephony/CTI, and native mobile apps. These are noted as extension points in §8.

### 1.3 Definitions, Acronyms, and Abbreviations
| Term | Meaning |
|---|---|
| **Lead** | An unqualified prospect (raw interest) not yet validated as a sales opportunity. |
| **Account** | An organization/company the business sells to. |
| **Contact** | A person, usually associated with an account. |
| **Opportunity / Deal** | A qualified, potential revenue-generating sale with a stage and value. |
| **Pipeline** | The ordered set of stages an opportunity moves through. |
| **RBAC** | Role-Based Access Control. |
| **PII** | Personally Identifiable Information. |
| **SLA** | Service-Level Agreement. |
| **CRUD** | Create, Read, Update, Delete. |

### 1.4 References
- ISO/IEC/IEEE 29148:2018 — Requirements engineering
- OWASP ASVS (application security verification)
- Applicable privacy regulation for the deployment region (e.g., GDPR, CCPA)

### 1.5 Overview
§2 gives the overall product context. §3 details functional requirements grouped by feature. §4 covers external interfaces, §5 non-functional requirements, §6 the data model, §7 verification, and §8 assumptions and extension points.

---

## 2. Overall Description

### 2.1 Product Perspective
A new, self-contained web application with a browser-based UI and a RESTful backend API. It is designed to integrate with common external services (email, calendar, authentication provider) via well-defined interfaces (§4.3) and to support multi-tenant operation.

### 2.2 Product Functions (summary)
- Manage the full contact/account/lead/opportunity data set (CRUD + relationships).
- Move opportunities through a configurable sales pipeline.
- Log and schedule activities (calls, emails, meetings, tasks) against records.
- Produce dashboards and reports on pipeline health and team performance.
- Administer users, roles, and permissions.
- Search, filter, import, and export data.

### 2.3 User Classes and Characteristics
| User class | Description | Key needs |
|---|---|---|
| **Sales Representative** | Primary daily user managing their own leads/deals. | Fast record entry, activity logging, personal pipeline view. |
| **Sales Manager** | Oversees a team. | Team dashboards, reassignment, forecasting. |
| **Administrator** | Configures the system. | User/role management, field/pipeline configuration, data governance. |
| **Read-only / Executive** | Consumes reports. | High-level dashboards, exports. |

### 2.4 Operating Environment
- **Client:** Current versions of major browsers (Chrome, Firefox, Edge, Safari), responsive down to tablet width.
- **Server:** Standard cloud/Linux hosting; containerized deployment.
- **Data store:** Relational database (e.g., PostgreSQL) as the system of record.

### 2.5 Design and Implementation Constraints
- Access control must be enforced server-side (never trust the client).
- All external communication over TLS 1.2+.
- The system must support horizontal scaling of the application tier.

### 2.6 Assumptions and Dependencies
- Users have reliable internet access and a supported browser.
- An external email/SMTP service and an identity provider (or built-in auth) are available.
- Region-specific privacy obligations are known before go-live.

---

## 3. Functional Requirements

> **Convention:** `FR-<area>.<n>`. Priority: **M** = Must, **S** = Should, **C** = Could (MoSCoW).

### 3.1 Authentication & Authorization
| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH.1 | The system shall authenticate users via email/username and password before granting access. | M |
| FR-AUTH.2 | The system shall support password reset via a verified email link with a time-limited, single-use token. | M |
| FR-AUTH.3 | The system shall enforce role-based access control so that users can only access records and actions permitted by their role. | M |
| FR-AUTH.4 | The system shall support optional multi-factor authentication (MFA). | S |
| FR-AUTH.5 | The system shall lock an account or apply rate-limiting after a configurable number of failed login attempts. | M |
| FR-AUTH.6 | The system shall support single sign-on (SSO) via an external identity provider (e.g., OAuth 2.0 / OIDC). | C |

### 3.2 Contact & Account Management
| ID | Requirement | Priority |
|---|---|---|
| FR-CON.1 | The system shall allow authorized users to create, read, update, and delete contact records. | M |
| FR-CON.2 | A contact record shall capture at minimum: name, email, phone, job title, and associated account. | M |
| FR-CON.3 | The system shall allow contacts to be linked to exactly one primary account, with support for additional related accounts. | S |
| FR-CON.4 | The system shall allow authorized users to CRUD account records capturing name, industry, size, website, and address. | M |
| FR-CON.5 | The system shall display, on an account, all related contacts, opportunities, and activities. | M |
| FR-CON.6 | The system shall detect and warn about potential duplicate contacts/accounts (by email/name/domain) on creation. | S |
| FR-CON.7 | The system shall support merging duplicate records while preserving related activities and history. | C |

### 3.3 Lead Management
| ID | Requirement | Priority |
|---|---|---|
| FR-LEAD.1 | The system shall allow users to capture leads with source, status, and owner. | M |
| FR-LEAD.2 | The system shall support lead statuses (e.g., New, Contacted, Qualified, Disqualified) that are configurable by an administrator. | M |
| FR-LEAD.3 | The system shall allow a qualified lead to be **converted** into a contact, account, and/or opportunity, carrying over relevant field values. | M |
| FR-LEAD.4 | The system shall allow leads to be assigned or reassigned to users, manually or by rule. | S |
| FR-LEAD.5 | The system shall retain the originating lead's history after conversion for auditability. | S |

### 3.4 Opportunity (Deal) Management
| ID | Requirement | Priority |
|---|---|---|
| FR-OPP.1 | The system shall allow users to CRUD opportunities with name, associated account/contact, monetary value, currency, expected close date, and stage. | M |
| FR-OPP.2 | The system shall associate each opportunity with a pipeline stage and record stage-change history with timestamps. | M |
| FR-OPP.3 | The system shall allow assigning a probability (%) to each stage for weighted forecasting. | S |
| FR-OPP.4 | The system shall support marking opportunities as Won or Lost, with a required reason on loss. | M |
| FR-OPP.5 | The system shall recalculate pipeline and forecast totals whenever an opportunity's value or stage changes. | M |

### 3.5 Sales Pipeline
| ID | Requirement | Priority |
|---|---|---|
| FR-PIPE.1 | The system shall provide a visual pipeline (e.g., kanban) showing opportunities grouped by stage. | M |
| FR-PIPE.2 | The system shall allow users to move an opportunity between stages via drag-and-drop or an explicit action, subject to permissions. | M |
| FR-PIPE.3 | An administrator shall be able to configure pipeline stages (add, rename, reorder, remove). | M |
| FR-PIPE.4 | The system shall support multiple named pipelines (e.g., New Business vs. Renewals). | C |

### 3.6 Activity & Task Management
| ID | Requirement | Priority |
|---|---|---|
| FR-ACT.1 | The system shall allow users to log activities (call, email, meeting, note) against contacts, accounts, leads, and opportunities. | M |
| FR-ACT.2 | The system shall allow users to create tasks with due dates, assignees, priorities, and completion status. Tasks created in record contexts or from the global task view shall support linking to an account (company) and/or contact. | M |
| FR-ACT.2a | The system shall display the associated account (company) and contact on task listings with direct navigation links to the related entity. | M |
| FR-ACT.3 | The system shall display a chronological activity timeline on each record. | M |
| FR-ACT.4 | The system shall send reminders for upcoming or overdue tasks. | S |
| FR-ACT.5 | The system shall optionally sync meetings/tasks with an external calendar. | C |

### 3.7 Reporting & Analytics
| ID | Requirement | Priority |
|---|---|---|
| FR-RPT.1 | The system shall provide dashboards summarizing pipeline value, deals by stage, win rate, and activity volume. | M |
| FR-RPT.2 | The system shall allow filtering reports by date range, owner, team, and pipeline. | M |
| FR-RPT.3 | The system shall provide a sales forecast based on weighted opportunity values. | S |
| FR-RPT.4 | The system shall allow exporting report data to CSV/Excel. | M |
| FR-RPT.5 | The system shall support user-defined custom reports on core entities. | C |

### 3.8 Search, Import & Export
| ID | Requirement | Priority |
|---|---|---|
| FR-DATA.1 | The system shall provide global search across contacts, accounts, leads, and opportunities. | M |
| FR-DATA.2 | The system shall support saved filters/views per user. | S |
| FR-DATA.3 | The system shall allow bulk import of contacts/accounts/leads via CSV with field mapping and validation. | M |
| FR-DATA.4 | The system shall report per-row import errors without aborting the entire import. | S |
| FR-DATA.5 | The system shall allow exporting records to CSV, respecting the user's access permissions. | M |

### 3.9 Administration & Configuration
| ID | Requirement | Priority |
|---|---|---|
| FR-ADM.1 | An administrator shall be able to create, deactivate, and manage user accounts and roles. | M |
| FR-ADM.2 | An administrator shall be able to define custom fields on core entities. | S |
| FR-ADM.3 | The system shall maintain an audit log of security-relevant and data-changing actions. | M |
| FR-ADM.4 | An administrator shall be able to configure notification rules. | C |

### 3.10 Notifications
| ID | Requirement | Priority |
|---|---|---|
| FR-NOT.1 | The system shall notify users of assignments, mentions, and due tasks (in-app and email). | S |
| FR-NOT.2 | Users shall be able to configure which notifications they receive. | C |

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- Responsive web UI; primary layouts: list views, record detail views, and the pipeline board.
- Consistent navigation, keyboard-accessible controls, and clear validation messaging.
- WCAG 2.1 AA accessibility target.

### 4.2 Hardware Interfaces
- No specialized hardware; standard client devices and server infrastructure.

### 4.3 Software Interfaces
- **REST API** (JSON over HTTPS) exposing all core entities for integration and the front end.
- **Email/SMTP** service for transactional email and notifications.
- **Identity provider** (OIDC/OAuth 2.0) for optional SSO.
- **Calendar** provider for optional activity sync.

### 4.4 Communications Interfaces
- All traffic over HTTPS (TLS 1.2+). Webhooks (if enabled) signed and verifiable.

---

## 5. Non-Functional Requirements

> **Convention:** `NFR-<category>.<n>`. Written to be measurable and testable.

### 5.1 Performance
| ID | Requirement |
|---|---|
| NFR-PERF.1 | 95% of interactive page/API responses shall complete within **2 seconds** under nominal load. |
| NFR-PERF.2 | The system shall support at least **500 concurrent active users** per tenant without SLA breach. |
| NFR-PERF.3 | List and search queries over up to **1,000,000 records** shall return the first page within **3 seconds**. |

### 5.2 Security
| ID | Requirement |
|---|---|
| NFR-SEC.1 | Passwords shall be stored using a strong, salted, adaptive hash (e.g., bcrypt/Argon2). |
| NFR-SEC.2 | The system shall enforce authorization server-side on every request. |
| NFR-SEC.3 | PII shall be encrypted in transit (TLS) and at rest. |
| NFR-SEC.4 | The system shall mitigate OWASP Top 10 vulnerabilities (injection, XSS, CSRF, broken access control, etc.). |
| NFR-SEC.5 | Audit logs shall be tamper-evident and retained per policy. |

### 5.3 Reliability & Availability
| ID | Requirement |
|---|---|
| NFR-REL.1 | The system shall target **99.9% monthly uptime** (excluding scheduled maintenance). |
| NFR-REL.2 | Automated backups shall run at least daily with a defined RPO ≤ 24h and RTO ≤ 4h. |
| NFR-REL.3 | No single application-node failure shall cause data loss or full outage. |

### 5.4 Scalability
| ID | Requirement |
|---|---|
| NFR-SCAL.1 | The application tier shall scale horizontally behind a load balancer. |
| NFR-SCAL.2 | The data model and queries shall support growth to millions of records per tenant. |

### 5.5 Usability
| ID | Requirement |
|---|---|
| NFR-USA.1 | A new sales rep shall be able to create a contact and log an activity within their first session without training. |
| NFR-USA.2 | The UI shall provide inline validation and undo/confirmation for destructive actions. |

### 5.6 Maintainability & Portability
| ID | Requirement |
|---|---|
| NFR-MNT.1 | Code shall follow a documented style guide with automated linting and ≥ 80% coverage on core business logic. |
| NFR-MNT.2 | The system shall be deployable via containers to any standard cloud/Linux environment. |

### 5.7 Compliance & Privacy
| ID | Requirement |
|---|---|
| NFR-CMP.1 | The system shall support data-subject rights (export and deletion of personal data) where legally required. |
| NFR-CMP.2 | Data retention and deletion policies shall be configurable per tenant. |

---

## 6. Data Requirements

### 6.1 Core Entities (logical model)
- **User** (id, name, email, role, status)
- **Account** (id, name, industry, size, website, address, owner_id)
- **Contact** (id, name, email, phone, title, account_id, owner_id)
- **Lead** (id, name, email, source, status, owner_id, converted_flag)
- **Opportunity** (id, name, account_id, primary_contact_id, value, currency, stage_id, probability, expected_close_date, status, owner_id)
- **Pipeline / Stage** (pipeline_id, stage_id, name, order, probability)
- **Activity** (id, type, subject, body, related_entity_type, related_entity_id, owner_id, timestamp)
- **Task** (id, title, due_date, assignee_id, status, related_entity_id)
- **AuditLog** (id, actor_id, action, entity, entity_id, before, after, timestamp)

### 6.2 Key Relationships
- Account **1—N** Contact, Opportunity, Activity
- Contact **N—1** Account; Contact **1—N** Activity
- Opportunity **N—1** Account, Pipeline Stage; **1—N** Activity
- Lead **1—1** conversion → Contact/Account/Opportunity
- User **1—N** owned records (Account/Contact/Lead/Opportunity)

### 6.3 Data Integrity Rules
- Deleting an account shall be blocked or cascade-controlled when related open opportunities exist.
- Every opportunity must belong to exactly one active pipeline stage.
- Email fields shall be validated for format; duplicates flagged per §3.2.

---

## 7. Verification & Acceptance
- Each `FR-*` and `NFR-*` shall map to at least one test case (traceability matrix maintained separately).
- **Acceptance criteria** are met when all **Must (M)** requirements pass, no critical/high defects remain open, and NFR thresholds (§5) are demonstrated under representative load.

---

## 8. Assumptions, Open Items & Extension Points

### 8.1 Baseline assumptions (adjust as needed)
- Web-based, sales-oriented CRM; English-first UI; single default currency configurable per tenant.
- Built-in authentication with optional SSO; multi-tenant-capable.

### 8.2 Tailoring levers (decide before build)
1. **Deployment model** — single-tenant vs. multi-tenant SaaS.
2. **Scale target** — team size and record volume (drives §5 thresholds).
3. **Industry focus** — generic B2B vs. vertical (real estate, SaaS, etc.), which changes fields and pipeline stages.
4. **Integrations** — which email/calendar/marketing/telephony systems are mandatory.
5. **Regulatory scope** — applicable privacy regimes and data-residency needs.

### 8.3 Future phases (out of current scope)
Marketing automation, help-desk/ticketing, quote/CPQ, native mobile apps, telephony/CTI, and AI-assisted lead scoring.

---
*End of document.*
