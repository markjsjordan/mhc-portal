# Web Route Audit Report (wdvf3acfjd)

**Audit Date:** November 1, 2026  
**Target:** MHC Portal (`packages/web`)  
**Scope:** Runtime navigation graph and static route integrity sweep across all defined application and showcase routes.

---

## 1. Executive Summary

A comprehensive sweep was conducted of all route declarations in `packages/web/src/App.tsx`, `ShowcaseRouter.tsx`, and all UI navigation triggers across page, vertical, and component directories.

- **Total Defined Routes in App.tsx:** 88 top-level routes + 8 nested family-portal routes = 96 route paths.
- **Immediate Dead Routes Remediated in this Batch:**
  1. `/admin/data` (BulkDataHub) — resolved in ticket `wdvf3acfhz`.
  2. `/schedule` (Onboarding) — resolved to `/scheduling/builder` in ticket `wdvf3acfj2`.
  3. `/exceptions` (AdministratorDashboard) — repointed to `/time-tracking/aggregator-submissions` in ticket `wdvf3acfj0`.
  4. `/admin/activity` (AdministratorDashboard) — built SystemActivityPage in ticket `wdvf3acfj1`.
  5. Showcase stubs `/caregivers` and `/settings` — resolved to live components in ticket `wdvf3acfj3`.

---

## 2. Inventory of Registered Web Routes

### Core App Routes (`App.tsx`)

| Path | Component | Auth/Role Gating | Status |
|------|-----------|------------------|--------|
| `/` | `LandingPage` | Public | PASS |
| `/login` | `Login` | Public | PASS |
| `/signup` | `Signup` | Public | PASS |
| `/logout` | `Logout` | Protected | PASS |
| `/accept-invite/:token` | `AcceptInvite` | Public | PASS |
| `/join/:token` | `AcceptInvite` | Public | PASS |
| `/onboarding` | `Onboarding` | Protected | PASS |
| `/dashboard` | `DashboardSelector` | Protected | PASS |
| `/nurse/dashboard` | `NurseDashboard` | Protected (`RN`, `LPN`, Admin) | PASS |
| `/caregiver/dashboard` | `CaregiverDashboard` | Protected (`CAREGIVER`, Admin) | PASS |
| `/caregiver/tasks` | `CaregiverTasksPage` | Protected | PASS |
| `/caregiver/messages` | `CaregiverMessagesPage` | Protected | PASS |
| `/caregivers` | `CaregiverList` | Protected | PASS |
| `/caregivers/new` | `CreateCaregiverPage` | Protected | PASS |
| `/caregivers/:id` | `CaregiverDetail` | Protected | PASS |
| `/caregivers/:id/training` | `CaregiverTrainingDashboard` | Protected | PASS |
| `/clients` | `ClientList` | Protected | PASS |
| `/clients/dashboard` | `ClientDashboard` | Protected | PASS |
| `/clients/intake` | `ClientIntakeWorkflow` | Protected | PASS |
| `/clients/new/intake` | `ClientIntakeWorkflow` | Protected | PASS |
| `/clients/:id` | `ClientDetail` | Protected | PASS |
| `/clients/:id/edit` | `ClientEditPage` | Protected | PASS |
| `/clients/:clientId/medications` | `MedicationListPage` | Protected | PASS |
| `/scheduling` | `VisitList` | Protected | PASS |
| `/scheduling/calendar` | `CalendarView` | Protected | PASS |
| `/scheduling/builder` | `ScheduleBuilderPage` | Protected | PASS |
| `/scheduling/visits/:id` | `VisitDetailPage` | Protected | PASS |
| `/shift-matching` | `OpenShiftList` | Protected | PASS |
| `/shift-matching/analytics` | `MatchAnalyticsDashboard` | Protected | PASS |
| `/shift-matching/:id` | `OpenShiftDetail` | Protected | PASS |
| `/care-plans` | `CarePlanList` | Protected | PASS |
| `/care-plans/new` | `CreateCarePlanPage` | Protected | PASS |
| `/care-plans/from-template` | `CreateFromTemplatePage` | Protected | PASS |
| `/care-plans/from-template/:templateId` | `CustomizeTemplatePage` | Protected | PASS |
| `/care-plans/:id` | `CarePlanDetail` | Protected | PASS |
| `/care-plans/:id/edit` | `EditCarePlanPage` | Protected | PASS |
| `/care-plans/:id/progress-notes` | `ProgressNotesPage` | Protected | PASS |
| `/tasks` | `TaskList` | Protected | PASS |
| `/tasks/:id` | `TaskDetailPage` | Protected | PASS |
| `/time-tracking` | `EVVRecordList` | Protected | PASS |
| `/time-tracking/aggregator-submissions` | `SubmissionTrackingDashboard` | Protected | PASS |
| `/time-tracking/:id` | `EVVRecordDetail` | Protected | PASS |
| `/billing` | `InvoiceList` | Protected | PASS |
| `/billing/new` | `InvoiceForm` | Protected | PASS |
| `/billing/:id` | `InvoiceDetail` | Protected | PASS |
| `/billing/:id/edit` | `InvoiceForm` | Protected | PASS |
| `/payroll` | `PayrollDashboard` | Protected | PASS |
| `/payroll/runs` | `PayRunList` | Protected | PASS |
| `/payroll/runs/:id` | `PayRunDetail` | Protected | PASS |
| `/payroll/pay-stubs` | `PayStubList` | Protected | PASS |
| `/payroll/pay-stubs/:id` | `PayStubDetail` | Protected | PASS |
| `/payroll/caregivers/:caregiverId/pay-stubs` | `CaregiverPayStubs` | Protected | PASS |
| `/payroll/pay-periods` | `PayPeriodManagement` | Protected | PASS |
| `/payroll/reports` | `PayrollReports` | Protected | PASS |
| `/admin` | `AdministratorDashboard` | Protected (Admin roles) | PASS |
| `/admin/data` | `BulkDataHub` | Protected (Admin roles) | PASS |
| `/admin/activity` | `SystemActivityPage` | Protected (Admin roles) | PASS |
| `/admin/agencies` | `AgencyManagement` | Protected (`SUPER_ADMIN`) | PASS |
| `/compliance` | `ComplianceDashboard` | Protected | PASS |
| `/quality-assurance` | `QADashboard` | Protected | PASS |
| `/quality-assurance/audits` | `AuditsPage` | Protected | PASS |
| `/quality-assurance/audits/new` | `CreateAuditPage` | Protected | PASS |
| `/quality-assurance/audits/:id` | `AuditDetailPage` | Protected | PASS |
| `/quality-assurance/corrective-actions` | `CorrectiveActionsPage` | Protected | PASS |
| `/incidents` | `IncidentListPage` | Protected | PASS |
| `/incidents/new` | `CreateIncidentPage` | Protected | PASS |
| `/settings/branding` | `BrandingSettings` | Protected (Admin roles) | PASS |
| `/settings/*` | `Settings` | Protected | PASS |
| `/messages` | `StaffMessagesPage` | Protected | PASS |
| `/messages/:threadId` | `StaffMessagesPage` | Protected | PASS |
| `/family-portal/*` | Nested family engagement | Protected | PASS |

---

## 3. Findings & Recommendations

### Finding 1: Mock Navigations in `NurseDashboard.tsx`
- **Location:** `packages/web/src/app/pages/NurseDashboard.tsx:311, 319`
- **Details:** Calls `navigate('/care-plans/robert-anderson')` and `navigate('/care-plans/linda-garcia')`.
- **Impact:** Routes with hardcoded mock client slug strings will attempt to load `CarePlanDetail` with id `'robert-anderson'`, resulting in an API 404 or record not found if not seeded.
- **Recommendation:** File follow-up ticket to replace static slug routes with dynamic IDs fetched from actual demo care plans.

### Standing CI Gate Recommendation
- Add an automated route-smoke suite to Playwright E2E tests (`packages/web/e2e/routes.smoke.spec.ts`) that asserts all listed routes mount `AppShell` and render their primary heading without crashing or rendering `<NotFound />`.
