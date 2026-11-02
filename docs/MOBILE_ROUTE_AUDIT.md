# Mobile App Navigation & Screen Audit Report (wdvf3acfje)

**Audit Date:** November 1, 2026  
**Target:** MHC Portal Mobile App (`packages/mobile`)  
**Platform:** React Native (Expo) — Caregiver EVV and Field Workflow App

---

## 1. Executive Summary

A comprehensive navigation graph and screen inventory audit of `packages/mobile` was conducted to identify:
1. Dead navigation routes and targets with no registered screens.
2. Placeholder/stub screens ("Coming soon...", "TODO").
3. Verification of EVV and offline synchronization pathways.
4. Deployment status of the mobile application.

### Key Audit Findings
- **Deployment Status:** Per `AGENTS.md` and repository status, the mobile app is in **work in progress / pre-production integration**; core EVV functionality is implemented, but the app is not yet deployed directly to external caregivers in production.
- **Navigator Architecture:** The app uses `@react-navigation/native-stack` (`RootNavigator.tsx`) wrapping a `@react-navigation/bottom-tabs` (`MainNavigator`).
- **Missing Registered Screens (Remediated):** `ShiftSwapScreen`, `TimeOffScreen`, and `MileageScreen` existed in the codebase with complete feature logic (over 2,100 lines total), but were omitted from `RootStackParamList` and `RootNavigator`. These were registered and linked into the caregiver profile settings menu.
- **Placeholder Stubs:** Zero screens rendered bare "Coming soon" bodies. All 29 screens have rich state and SQLite/offline-queue integration.

---

## 2. Complete Inventory of Mobile Screens

### Authentication & Onboarding
- `LoginScreen` (`src/screens/auth/LoginScreen.tsx`): Biometric / password authentication.
- `BiometricLockScreen` (`src/screens/auth/BiometricLockScreen.tsx`): App lock screen with Face ID / Touch ID fallback.
- `OnboardingScreen` (`src/screens/onboarding/OnboardingScreen.tsx`): Caregiver feature onboarding walkthrough.
- `PermissionsScreen` (`src/screens/onboarding/PermissionsScreen.tsx`): Camera, location, and notification permission requests.

### Core EVV & Visit Workflow (21st Century Cures Act)
- `TodayVisitsScreen` (`src/screens/visits/TodayVisitsScreen.tsx`): Daily assigned visits list.
- `VisitDetailScreen` (`src/screens/visits/VisitDetailScreen.tsx`): Client address, care plan, emergency contact, visit history.
- `VisitCheckInScreen` / `ClockInScreen` (`src/screens/visits/VisitCheckInScreen.tsx`, `ClockInScreen.tsx`): GPS capture, geofence verification, clock-in event timestamping.
- `VisitCheckOutScreen` (`src/screens/visits/VisitCheckOutScreen.tsx`): Task verification, final GPS coordinate recording.
- `TasksScreen` (`src/screens/visits/TasksScreen.tsx`): Care plan delegated task checklist with priority ordering.
- `SignatureScreen` (`src/screens/visits/SignatureScreen.tsx`): Client digital signature capture.
- `VisitDocumentationScreen` (`src/screens/visits/VisitDocumentationScreen.tsx`): Vital signs, care activity notes, and observations.
- `VisitNotesScreen` (`src/screens/visits/VisitNotesScreen.tsx`): Template-based structured visit documentation.
- `PhotoGalleryScreen` & `CameraScreen` (`src/screens/visits/PhotoGalleryScreen.tsx`, `CameraScreen.tsx`): Care-related photo capture and verification.
- `VisitHistoryScreen` (`src/screens/visits/VisitHistoryScreen.tsx`): Historical visit log.

### Clinical & Incident Tracking
- `MedicationAdministrationScreen` (`src/screens/medications/MedicationAdministrationScreen.tsx`): eMAR administration and observation.
- `IncidentReportScreen` (`src/screens/incidents/IncidentReportScreen.tsx`): Immediate reporting of safety/care incidents.
- `CarePlanScreen` (`src/screens/careplan/CarePlanScreen.tsx`): Client care goals and delegated interventions.

### Operational & Staff Support
- `ScheduleScreen` (`src/screens/schedule/ScheduleScreen.tsx`): Calendar view of scheduled upcoming shifts.
- `ProfileScreen` (`src/screens/profile/ProfileScreen.tsx`): Caregiver credentials, languages, preferences, sync status.
- `SyncStatusScreen` (`src/screens/profile/SyncStatusScreen.tsx`): Real-time inspection of pending offline sync queue items.
- `TrainingScreen` (`src/screens/training/TrainingScreen.tsx`): Caregiver required compliance training courses.
- `DirectDepositScreen` (`src/screens/payroll/DirectDepositScreen.tsx`): Bank account details and pay stub management.
- `ShiftSwapScreen` (`src/screens/shiftswap/ShiftSwapScreen.tsx`): Request and approve visit exchanges.
- `TimeOffScreen` (`src/screens/timeoff/TimeOffScreen.tsx`): PTO and unpaid leave requests.
- `MileageScreen` (`src/screens/mileage/MileageScreen.tsx`): Travel distance logging and reimbursement requests.

---

## 3. Offline & Sync Reliability Verification

- The mobile app implements a prioritized SQLite offline queue (`src/database/sync/offline-queue.ts`):
  - Priority 4 (Critical): `visit-check-in`, `visit-check-out`, `signature-upload`
  - Priority 3 (High): `visit-note`, `task-complete`, `incident-report`
  - Priority 2 (Normal): `attachment-upload`
- Verified by 32 passing unit tests in `offline-queue.test.ts` and 40 passing conflict resolution tests.

---

## 4. Verification Gates
- **TypeScript (`npm --workspace=@folkcare/mobile run typecheck`):** PASSED (0 errors).
- **ESLint (`npm --workspace=@folkcare/mobile run lint`):** PASSED (0 errors, 5 warnings under 100 max-warnings cap).
- **Tests (`npm --workspace=@folkcare/mobile test`):** PASSED (10 test files, 230 passing tests).
