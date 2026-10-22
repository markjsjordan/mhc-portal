# MHC Portal

> **Marquette Home Care — Client & Care Management Portal**

🔄 *Last updated: October 22, 2026*

---

## What Is This?

The MHC Portal is a private, web-based care management system built for Marquette Home Care. It gives the whole team — administrators, coordinators, caregivers, nurses, and families — one secure place to manage clients, schedules, visits, care plans, billing, payroll, and family communication.

The system is built on open-source software from [Folk Care](https://folk.care) and has been customized for Marquette Home Care's specific needs. It runs on modern cloud infrastructure with enterprise-grade security and HIPAA-compliant data handling.

### At a Glance

| | |
|---|---|
| **Production URL** | [mhc-portal-markjsjordans-projects.vercel.app](https://mhc-portal-markjsjordans-projects.vercel.app/) |
| **Status** | Core features built; security hardening and compliance work in progress |
| **Priority actions** | Secure test accounts, add role checks to every page, confirm state submission retries, complete HIPAA hardening |

---

## Who Uses It?

Every person who logs in is assigned a **role**. That role controls what they can see and do. Permissions only add access — they never take it away.

### Roles

| Role | Who | What They Can Do | Read-Only Areas |
|------|-----|-----------------|-----------------|
| **Super Admin** | System owner | Full control of the entire system | None |
| **Org Admin** | Agency leadership | Manage all clients, caregivers, staff, schedules, billing, reports, settings | Compliance (read and write) |
| **Branch Admin** | Branch manager | Manage clients, caregivers, and schedules within their branch | Staff, reports, compliance |
| **Coordinator** | Care coordinator | Update clients, schedule visits, assign caregivers, manage care plans | Caregivers, compliance |
| **Scheduler** | Scheduling staff | Build and manage visit schedules | Clients, caregivers, visits |
| **RN Clinical** | Registered Nurse | Clinical assessments, medication management, client health oversight, EVV documentation review | Clients, care plans, incidents |
| **Caregiver** | Field caregiver | View clients and schedules, clock in/out, complete tasks, write visit notes | Clients, care plans |
| **Family** | Client's family member | View care plans, visit notes, messages, and schedules via the family portal | All records shown to family |
| **Client** | The care recipient | Sign in to the family portal to see their own care information | Only what is specifically granted |
| **Billing** | Billing staff | Manage invoices and billing records | Clients, visits, reports |
| **HR** | Human resources | Manage staff records, credentials, training, certifications, payroll | — |
| **Auditor** | Compliance auditor | View-only access to all records, compliance reports, and audit logs | All areas (no changes) |
| **Read Only** | General viewer | View clients and reports | All areas (no changes) |

---

## Portal Sections

The portal is organized into fourteen sections. The **Access** column shows whether the page checks your role or just that you're signed in.

| Section | What It Covers | Access | Status |
|---------|---------------|--------|--------|
| **Clients** | Records, intake, dashboard, medications | Partly role-checked | Core built |
| **Caregivers** | Directory, profiles, training | Role-checked | Core built |
| **Scheduling** | Visit calendar, schedule builder, shift matching | Sign-in only | Core built |
| **Care Plans & Tasks** | Care plans, templates, progress notes, tasks | Partly role-checked | Core built |
| **Time Tracking (EVV)** | Electronic Visit Verification records, state submissions | Sign-in only | Built; retries unconfirmed |
| **Billing** | Invoices and billing records | Role-checked | Partly built |
| **Payroll** | Pay runs, pay periods, pay stubs, reports | Sign-in only | Partly built |
| **Incidents** | Incident reports | Sign-in only | Core built |
| **Quality Assurance** | Audits and corrective actions | Role-checked | Partly built |
| **Compliance** | Compliance dashboard | Sign-in only | Dashboard built; live data unconfirmed |
| **Analytics** | Admin, coordinator, and report dashboards | Sign-in only | Core built |
| **Admin & Settings** | Administration tools, team settings | Sign-in only | Core built |
| **Dashboards** | Caregiver and nurse home screens | Sign-in only | Core built |
| **Family Portal** | Care updates, activity, messages, schedule, health updates | Role-checked | Core built; client path untested |

### Access Rules

| Rule | How It Works |
|------|-------------|
| **Sign-in** | Most pages require sign-in. Unauthenticated visitors are sent to the login page. |
| **Landing page** | Family and client users land on the family portal after signing in. |
| **Organization & branch limits** | Partly enforced. The server scopes data by organization and checks branch access on some routes. Full database-level enforcement is not yet confirmed. |
| **Audit trail** | Many parts of the system record changes. Full coverage has not been confirmed. |

---

## Databases & Environments

The portal uses separate databases for different purposes. Test data is always completely separate from real client information.

### Environments

| Environment | Purpose | URL | Database | Who Uses It |
|-------------|---------|-----|----------|-------------|
| **Production** | Live system | [mhc-portal-markjsjordans-projects.vercel.app](https://mhc-portal-markjsjordans-projects.vercel.app/) | Neon PostgreSQL — Production branch | Staff and clients |
| **Preview** | Test new features before they go live | [mhc-family-portal-preview.vercel.app](https://mhc-family-portal-preview.vercel.app/) | Neon PostgreSQL — Preview branch (separate) | Developers and testers |
| **Local Dev** | Developer workstations | `localhost:3000` | Developer's local PostgreSQL | Developers only |

### Database Details

The database is hosted on **[Neon](https://neon.tech)** — a cloud PostgreSQL service with automatic scaling and branching.

| Database | Neon Branch | Contains Real Client Data? | Notes |
|----------|-------------|---------------------------|-------|
| **Production** | `production` | ⚠️ **Yes** (when launched) | Handle with extreme care. Never run test scripts here. |
| **Preview** | `preview` | **No** — test/demo data only | Safe to experiment. Completely separate from production. |
| **Backups** | `production-backup-*` | Yes (snapshots) | Point-in-time copies created before major changes |

> **Key point:** Production and preview are completely separate databases. Anything you do in preview cannot affect production data, and vice versa.

### What's in the Database?

The system stores data in 21+ tables, organized by function:

| Category | What's Stored | Example Tables |
|----------|--------------|----------------|
| **People** | Clients, caregivers, family members, all user accounts | `users`, `clients`, `caregivers`, `family_members` |
| **Organization** | Agency structure and branch locations | `organizations`, `branches` |
| **Care Delivery** | Visits (past/future), care plans, tasks, progress notes | `visits`, `care_plans`, `task_instances`, `progress_notes` |
| **EVV Records** | Clock in/out times, GPS locations, signatures | `evv_records` |
| **Scheduling** | Caregiver assignments, open shifts | `assignment_proposals`, `open_shifts` |
| **Billing & Pay** | Invoices, payments, insurance/payer info | `invoices`, `payments`, `payers` |
| **Family Portal** | Activity feed, notifications, visit summaries, messages | `family_activity_feed`, `family_notifications`, `messages`, `message_threads` |

---

## How Work Gets Done

Every change to the portal follows a structured process to maintain quality.

```
  IDEA
    │  A new feature or fix is identified
    ▼
  THOUGHT
    │  Requirements gathered
    ▼
  REQ GATHERING
    │  Technical spec written (names the branch and PR title)
    ▼
  READY
    │  Approved, ready to build
    ▼
  IN PROGRESS
    │  Code written, pushed to feature branch
    ▼
  REVIEW READY
    │  Automated tests + accessibility scan run
    │
    ├─ CI passes → QA READY (human reviews)
    └─ CI fails  → Fix and resubmit
    │
    ▼
  PASSED
    │  Human reviewer approved
    ▼
  MERGED → DONE ✓
    Code merged, CI confirms green, ticket closed
```

**Rules:**
- Real client data is **never** used in testing — only test accounts.
- Every change runs through automated checks before a human sees it.
- If the same ticket fails twice, automation pauses and a person steps in.

### Deployment Pipeline

Code flows through environments in order:

```
  feature/* branch → No deployment (development only)
        │
        ▼  merge
  develop branch ──→ Showcase demo (GitHub Pages, no database)
        │
        ▼  merge
  preview branch ──→ Preview (mhc-family-portal-preview.vercel.app)
        │              Test here before going live
        ▼  merge
  production branch → Production (Vercel + Production database)
                       This is the live system
```

Automated checks (lint, type check, tests, build) must all pass before any merge is allowed. This cannot be bypassed.

---

## Test Accounts

> 🚨 **These accounts exist only in Preview and Local Dev environments.** All test passwords must be changed or accounts removed before loading real client data into production.

| Name | Role | Email | Password |
|------|------|-------|----------|
| Super Admin | Super Admin | `admin@folkcare.example` | `Admin123!` |
| Maria Rodriguez | Org Admin | `admin@tx.folkcare.example` | `Demo123!` |
| James Thompson | Coordinator | `coordinator@tx.folkcare.example` | `Demo123!` |
| Sarah Chen | Caregiver | `caregiver@tx.folkcare.example` | `Demo123!` |
| David Williams | RN Clinical | `nurse@tx.folkcare.example` | `Demo123!` |
| Emily Johnson | Family Member | `family@tx.folkcare.example` | `Demo123!` |

The seed script also creates demo users for all 50 US states (5 roles × 50 states = 250 additional test users) with email patterns like `caregiver@ca.folkcare.example`.

---

## Risks & Priority Actions

Items ranked by their effect on client safety and data protection. **High** items must be resolved before real client information is entered.

| Priority | Issue | Status | Recommended Action |
|----------|-------|--------|--------------------|
| 🔴 HIGH | Test passwords are hardcoded in setup scripts | 🔄 In progress | Add environment checks; rotate all passwords before production |
| 🔴 HIGH | ~24 pages check only sign-in, not user role | 🔄 In progress | Add role checks to client records, medications, incidents pages |
| 🔴 HIGH | Organization/branch data isolation not confirmed | ❓ Unknown | Verify database rules exist; add them if not |
| 🔴 HIGH | No multi-factor authentication (MFA) | 🔄 In progress | Implement authenticator app (TOTP) for all production accounts |
| 🔴 HIGH | Audit trail coverage incomplete | 🔄 In progress | Implement immutable append-only audit for all data changes |
| 🔴 HIGH | Sensitive data (ePHI) may leak in logs | 🔄 In progress | Scrub PHI from all log outputs and error reports |
| 🔴 HIGH | Mobile/offline storage not encrypted | 🔄 In progress | Encrypt offline data on caregiver devices |
| 🔴 HIGH | Application-level encryption not implemented | 🔄 In progress | Add AES-256-GCM encryption for sensitive database fields |
| 🟡 MEDIUM | Client login path not tested end-to-end | ⬜ Not started | Test with client account in preview environment |
| 🟡 MEDIUM | EVV state submission retries may not run in production | ❓ Unknown | Confirm retry worker starts in production; add monitoring |
| 🟡 MEDIUM | Invoice approval incomplete; PDF is placeholder | ⬜ Not started | Complete invoice approval flow and PDF generator |
| 🟡 MEDIUM | Payroll reports show "coming soon" | ⬜ Not started | Complete payroll report generation |
| 🟢 LOW | QA exports use placeholder auditor names | ⬜ Not started | Replace with real auditor names |

---

## Open Questions

| Question | Why It Matters | Status |
|----------|---------------|--------|
| Does every data change get recorded in the audit log? | Complete history needed for compliance and investigations | 🔄 Being built |
| Are failed EVV state submissions retried automatically? | Missed submissions create billing gaps and compliance problems | ❓ Needs confirmation |
| Does the client/family login work end-to-end? | Families depend on this path | ⬜ Not tested |
| Does the compliance dashboard show live data? | Compliance reporting must use real data | ❓ Not verified |
| Are organization/branch isolation rules enforced in the database? | One org must never see another org's data | ❓ Not confirmed |
| Is there a backup and disaster recovery strategy? | Data loss would be catastrophic | 🔄 Being built |
| When will offline mode be ready for caregivers? | Caregivers need to work without internet | 🔄 In development |
| What defines "production ready"? | No clear go-live acceptance criteria | ⬜ Needs definition |

---

## Compliance & Security

### Regulatory Framework

The portal is designed to comply with:

- **HIPAA** — Security and Privacy Rules for protected health information (PHI)
- **21st Century Cures Act** — Electronic Visit Verification (EVV) mandates
- **State-specific regulations** — Texas HHSC (26 TAC §558), Florida AHCA (Chapter 59A-8), and other state home health laws

### EVV (Electronic Visit Verification)

EVV captures six federally required data elements for every home care visit:

1. **Type of service** performed
2. **Individual receiving** the service
3. **Individual providing** the service
4. **Date** of the service
5. **Time** the service begins and ends
6. **Location** of service delivery (GPS verification)

### Security Status

| Measure | Status | Description |
|---------|--------|-------------|
| HTTPS encryption (in transit) | ✅ Active | All data encrypted between browser and server |
| Role-based access control | ✅ Active | Users see only what their role allows |
| Audit logging | 🔄 In progress | Recording all data access and changes |
| Multi-factor authentication (MFA) | 🔄 In progress | Authenticator app support for login |
| Database field encryption (at rest) | 🔄 In progress | AES-256-GCM for sensitive fields |
| ePHI scrubbing from logs | 🔄 In progress | Preventing patient data from appearing in system logs |
| Offline storage encryption | 🔄 In progress | Securing data stored on mobile devices |
| HttpOnly session cookies | 🔄 In progress | Preventing session theft via browser scripts |

---

## Site Authoring & Content Management

The MHC Portal is a code-driven application. Content changes are made through code, not a CMS editor. Here's how different updates are handled:

| What You Want to Change | How It's Done | Who Does It |
|------------------------|---------------|-------------|
| Company branding (name, logo, colors) | Update theme files in `packages/web/` | Developer |
| Page text and labels | Update React component files | Developer |
| User roles and permissions | Modify `packages/core/src/types/base.ts` | Developer (careful review needed) |
| Test/demo data | Edit `packages/core/scripts/seed-demo.ts` | Developer |
| Add a new portal section | Create new module in `verticals/` | Developer |
| Database structure changes | Create migration in `scripts/migrations/` | Developer (DB expertise needed) |

### Automated Quality Gates

Every code change automatically passes through four checks:

1. **Lint** — Catches style issues and common mistakes
2. **Type Check** — Verifies all data types are correct
3. **Tests** — Runs the full automated test suite
4. **Build** — Confirms the application compiles

All four must pass. This cannot be bypassed.

---

## Technical Reference

*Non-technical readers can skip this section.*

### Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript (strict mode) | Type-safe across all packages |
| Runtime | Node.js 22.x | Required by Vercel hosting |
| Frontend | React | Web user interface |
| Mobile | React Native + Expo | Caregiver iOS/Android app |
| Database | PostgreSQL (Neon) | Cloud-hosted, auto-scaling |
| Cache | Redis (optional) | Rate limiting; falls back to in-memory |
| Hosting | Vercel | Serverless application hosting |
| CI/CD | GitHub Actions | Automated testing and deployment |
| Build | Turborepo | Monorepo orchestration |
| Validation | Zod | Runtime data validation |
| Testing | Vitest | Unit and integration tests |

### Repository Structure

```
mhc-portal/
├── packages/
│   ├── core/                Shared business logic, database, permissions
│   ├── app/                 Express API server
│   ├── web/                 React web frontend
│   ├── mobile/              React Native mobile app (Expo)
│   └── shared-components/   UI components shared between web and mobile
│
├── verticals/               Feature modules
│   ├── ai-services/              AI-powered features
│   ├── analytics-reporting/      Dashboards and reports
│   ├── billing-invoicing/        Invoice management
│   ├── care-plans-tasks/         Care plan workflows
│   ├── caregiver-burnout-prediction/  Predictive analytics
│   ├── caregiver-staff/          Staff management
│   ├── client-demographics/      Client records
│   ├── clinical-documentation/   Clinical notes
│   ├── family-engagement/        Family portal features
│   ├── incident-reporting/       Incident tracking
│   ├── integrations/             External system connections
│   ├── medication-management/    Medication tracking
│   ├── payroll-processing/       Payroll features
│   ├── quality-assurance-audits/ QA and auditing
│   ├── scheduling-visits/        Visit scheduling
│   ├── shift-matching/           Caregiver-client matching
│   ├── time-tracking-evv/        EVV compliance
│   └── visit-notes/              Visit documentation
│
├── api/                     Vercel serverless functions
├── scripts/                 Database migrations and utilities
├── showcase/                Static demo site (GitHub Pages)
└── .github/workflows/       CI/CD automation
```

### Key Code Locations

| Area | Path |
|------|------|
| Permissions & access control | `packages/core/src/permissions/permission-service.ts` |
| Authentication service | `packages/core/src/service/auth-service.ts` |
| Role definitions (all 14 roles) | `packages/core/src/types/base.ts` |
| Frontend routing & guards | `packages/web/src/App.tsx` |
| Multi-tenant data scoping | `packages/core/src/db/scoped-database.ts` |
| Demo accounts / seed data | `packages/core/scripts/seed-demo.ts` |
| EVV services & state submissions | `verticals/time-tracking-evv/src/services/` |
| Billing & invoicing | `verticals/billing-invoicing/` |
| Payroll processing | `verticals/payroll-processing/` |
| Compliance dashboard | `packages/web/src/app/pages/ComplianceDashboard.tsx` |
| Database migrations | `scripts/migrations/` |

### Local Development Quick Start

```bash
git clone https://github.com/markjsjordan/mhc-portal.git
cd mhc-portal
npm install
cp .env.example .env          # Edit with your database credentials
npm run db:migrate             # Create database schema
npm run db:seed                # Create org, branch, admin user
npm run db:seed:demo           # Generate demo data
npm run dev                    # Start development servers
# Open http://localhost:5173 and log in with admin@folkcare.example / Admin123!
```

### Useful Commands

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start all packages in development mode |
| `npm run build` | Production build (must pass before committing) |
| `npm run lint` | Check for code issues |
| `npm run typecheck` | Verify type safety |
| `npm run test` | Run all automated tests |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed:demo` | Generate demo data |

---

## Getting Help

| Need | Where to Go |
|------|-------------|
| Bug or feature request | [GitHub Issues](https://github.com/markjsjordan/mhc-portal/issues) |
| Urgent production issue | Contact the system administrator |
| Access or permission changes | Contact your organization admin |
| Update this document | Edit this README and commit the change |

---

## License

Built on [Folk Care](https://folk.care) open-source software (AGPL-3.0). Extended and customized for Marquette Home Care.

---

*Built with care by the MHC Portal team.*
