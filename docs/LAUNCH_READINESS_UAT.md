# E7 — Launch Readiness & UAT Guide (wdvf3adf66)

This document is the pre-production launch readiness runbook for MHC Portal (Folk). It covers UAT scripts, demo data cleanup, secrets rotation, performance baselines, onboarding/API guides, HIPAA & state EVV compliance verification, and go-live sign-off.

---

## 1. UAT Scenarios & Screenshot Checklists

### Scenario A — End-to-End Coordinator Flow
1. Log in as a **Coordinator** on the Web App.
2. Navigate to **Scheduling → Visits** and click **Create Visit**.
   - Select client, service type, scheduled start/end time, and save.
   - *Screenshot checkpoint 1*: Visit appears in schedule list.
3. Open the newly created visit and **Assign Caregiver** (verify availability/credential guardrails pass).
   - *Screenshot checkpoint 2*: Assigned caregiver badge visible on visit detail.
4. Have the assigned caregiver complete the visit on the **Mobile App** (Scenario B).
5. Navigate to **Compliance → Audit Logs** (or call `GET /api/audit/logs`).
   - Verify immutable audit entries exist for visit creation, caregiver assignment, and visit completion.
   - *Screenshot checkpoint 3*: Audit log table showing the visit lifecycle events.

### Scenario B — End-to-End Caregiver Mobile Flow
1. Launch the mobile app on iOS Simulator (`cd packages/mobile && npx expo start --ios`) or Android Emulator (`npx expo start --android`).
2. Log in as the **Caregiver** assigned in Scenario A.
3. Verify the assigned visit appears in **My Visits**.
   - *Screenshot checkpoint 1*: Caregiver visit list.
4. Tap the visit and press **Clock In** (confirm GPS capture within state geofence tolerance).
   - *Screenshot checkpoint 2*: Active visit with clock-in timestamp & GPS status.
5. Complete required care plan tasks, add visit notes, and press **Clock Out / Submit**.
   - *Screenshot checkpoint 3*: Completed visit confirmation.

### Scenario C — Family Member Isolation Flow
1. Log in as a **Family Member** linked to Client A.
2. Verify Client A's profile and visit history are visible.
   - *Screenshot checkpoint 1*: Family portal showing Client A visits.
3. Attempt to navigate directly to Client B's URL or call `GET /api/clients/<client-b-id>`.
   - Verify HTTP `403 Forbidden` (or `404 Not Found`) with a user-friendly message and **no** stack trace or sensitive path.
   - *Screenshot checkpoint 2*: Access denied state.

---

## 2. Demo Data Cleanup Runbook

Before production launch, remove all demo/seed records while preserving one operations admin account:

```bash
# 1. Dry-run first to inspect row counts
npx tsx scripts/cleanup-demo-data.ts --dry-run --preserve-admin ops@agency.com

# 2. Execute cleanup inside a transaction
npx tsx scripts/cleanup-demo-data.ts --confirm --preserve-admin ops@agency.com
```

Verify post-cleanup:
- `users` table contains only the preserved ops admin (and any real onboarded staff).
- `visits`, `clients`, `caregivers`, `invoices` have `0` rows where `is_demo_data = true`.

---

## 3. Pre-Launch Secrets Rotation

Rotate all production secrets prior to go-live and update Vercel Production environment variables (`vercel env ls`):

| Secret | Rotation Action | Verification |
| --- | --- | --- |
| `JWT_SECRET` | Generate 64-byte CSPRNG hex (`openssl rand -hex 64`) | Existing sessions invalidated; fresh login succeeds |
| `DATABASE_URL` | Rotate Neon production role password via Neon API/Console | `psql "$DATABASE_URL" -c "SELECT 1"` succeeds over TLS 1.2+ |
| `ENCRYPTION_KEY` / PHI KEK | Confirm production KMS/envelope key is distinct from preview/dev | Encrypted PHI round-trip test passes |
| Third-party API keys (Resend, Sentry, Stripe) | Regenerate production keys and revoke staging/dev keys | Smoke test email/error reporting |

---

## 4. Performance Baseline Verification

MVP launch budgets:
- **Audit log query (1-year window)**: `< 500ms`
- **Visit list query**: `< 200ms`

Run the automated baseline check against the target environment:

```bash
npx tsx scripts/benchmark-launch-baseline.ts
```

For build profiling:
```bash
npm run build -- --trace-performance
```

---

## 5. Cross-Browser & Mobile Verification Matrix

| Platform | Target | Status | Notes |
| --- | --- | --- | --- |
| Web — Chrome | Latest desktop + mobile viewport | [ ] | Zero console errors, responsive layout |
| Web — Safari | Latest macOS / iOS WebKit | [ ] | Zero console errors, responsive layout |
| Web — Firefox | Latest desktop | [ ] | Zero console errors, responsive layout |
| Mobile — iOS Simulator | iPhone 15 Pro (Expo) | [ ] | All Scenario B UAT flows pass |
| Mobile — Android Emulator | Pixel API 34 (Expo) | [ ] | All Scenario B UAT flows pass |

---

## 6. Operations & Onboarding Guides

### How to Onboard a Coordinator
1. Log in as the preserved **Ops Admin**.
2. Go to **Team Settings → Invite Member**.
3. Enter the coordinator's work email, assign the **Coordinator** role, and send the invite link.
4. Coordinator opens the invite link, sets a strong password, and enrolls in MFA.
5. Verify the coordinator can access **Clients**, **Caregivers**, and **Scheduling**, and cannot access **Admin-only Billing/System Settings**.

### How to Test a Caregiver Mobile Flow
1. Start the API server and Expo dev server:
   ```bash
   cd packages/mobile && npx expo start --ios
   ```
2. Ensure the simulator has a mock GPS location set near the test client's address (within 100m for TX, 150m for FL).
3. Sign in with the test caregiver account, clock in, complete tasks, and clock out.
4. Confirm the resulting EVV record appears in the web coordinator portal.

### Quick API Guide
- **Authentication**: `POST /api/auth/login` → returns JWT access token; pass `Authorization: Bearer <token>`.
- **Visits**: `GET /api/visits`, `POST /api/visits`, `PATCH /api/visits/:id/assign`.
- **EVV**: `POST /api/evv/clock-in`, `POST /api/evv/clock-out`.
- **Audit Logs**: `GET /api/audit/logs?startDate=<ISO>&endDate=<ISO>&limit=100` (Admin/Compliance roles only).
- **Error Contract**: All errors return `{ "success": false, "error": "<safe message>" }`; stack traces and filesystem paths are stripped by `packages/app/src/middleware/error-handler.ts`.

---

## 7. Compliance Checklist (HIPAA & State EVV)

### HIPAA Security Rule — Audit Controls (45 CFR §164.312(b))
| Requirement | Implementation | Verification |
| --- | --- | --- |
| Record and examine activity in systems containing ePHI | `phi-access-audit.ts` middleware writes to immutable `audit_logs` table | [ ] Verified in UAT Scenario A |
| Tamper-evident / append-only audit trail | DB triggers/permissions block `UPDATE`/`DELETE` on `audit_logs` | [ ] Verified via `audit_logs` migration tests |
| No ePHI or stack traces leaked in application/error logs | `error-handler.ts` scrubs SSNs, stack frames, and sensitive paths | [ ] Verified via `error-handler.test.ts` |
| Encryption in transit | Strict TLS 1.2+ enforced for PostgreSQL (`hipaa-004`) and HTTPS | [ ] Verified |

### State EVV Rules
- **Texas (HHSC, 26 TAC §558)**: 100m base geofence + GPS accuracy allowance, 10-minute grace period, HHAeXchange aggregator format, Employee Misconduct Registry check.
- **Florida (AHCA, Chapter 59A-8)**: 150m base geofence + GPS accuracy allowance, 15-minute grace period, Level 2 background screening (5-year lifecycle), 60-day RN supervision tracking.

---

## 8. Go-Live Sign-Off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Engineering / Launch Lead | | [ ] Approved | |
| Compliance / HIPAA Officer | | [ ] Approved | |
| Stakeholder / Product Owner | | [ ] Approved | |
