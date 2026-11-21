# E2E Decisions and Concerns (autonomous session, 2026-10-17)

Goal: get preview building and let the owner log in to preview as markjsjordan@gmail.com.

## Root cause of the E2E failures (verified)

1. **UI tests drove the API server, not the web app.** `playwright.config.ts` sets
   `baseURL` to `http://localhost:3000`, which is `packages/app` (API only). That
   server has no static-file path, so `/login` never renders the React form and
   every UI test fails at `input[type="email"]`. This is the shared cause of the
   billing/UI failures.
   - Decision: serve the built web app with `vite preview` (already a script in
     `packages/web`) on its own port, and point the UI tests at it. The API stays
     on 3000 for `/api` calls. Chosen over changing the tests, because the tests
     correctly describe user behavior.

2. **Admin seed was missing.** Specs log in as `admin@folkcare.example`
   (`Admin123!`). Nothing created it, so login returned 401.
   - Decision: seed this admin in global setup, hashed with the project's own
     `PasswordUtils`, idempotently (`ON CONFLICT DO NOTHING`, any unique key).
     Chosen over changing the specs to a fixture account, to keep the test contract.

3. **Schema drift in seeds.** Several seeds were written against an older schema
   (stale columns, missing NOT NULL values, JSON fields given strings). Fixed the
   visit-lifecycle, texas-visit, florida-visit-mco, and evv-clock caregiver/client
   inserts. Verified positional column/value alignment by script.

4. **8 specs retired** (`e2e/retired/`), because they depend on the `visit-lifecycle`
   seed, which models an outdated visits table. Owner decision. Kept in git history.

5. **"CI hang" was not a hang.** Timestamped proof: the migration step returns in
   360 ms; setup completes; the job then fails on real test failures rather than
   stalling. The earlier silent-stall reading was wrong. Diagnostic logging added
   (DEBUG env, server probe, migration timestamps). **These diagnostics must be
   removed** once the suite is green.

## Concerns (open)

- **Preview login for markjsjordan@gmail.com is NOT verified.** The preview
  database URL exists only as a GitHub secret (`PREVIEW_DATABASE_URL`) and cannot
  be read from the local machine. Confirming the account exists, and that it has a
  password the owner controls, has to happen in the preview environment itself.
  The seed does not create this account (it is a test admin, not a real user), and
  must not be used to seed production-like data.
- **Preview must be built from the integration branch.** `origin/preview` is still
  `15180901` (the old red head). Promotion goes through PR #59
  (`fix/rc-preview-gate` into `preview`), which is open and UNSTABLE.
- **Claude review workflow removed** (owner decision). It never ran (missing
  `CLAUDE_CODE_OAUTH_TOKEN`), so it was not gating anything.
- **Lint warnings** are at 996 (under the 1000 cap); the cap is a repo-wide gate.
- **Test-data personal fields** are clearly fake fixtures (`*.invalid` emails, test
  addresses), never real people.

## Diagnostics to remove before merge

- `DEBUG: pw:webserver,pw:test*` on the Run E2E tests step.
- The inline server probe (`/tmp/e2e-server.log`, /health poll) in the test step.
- `[diag]` timestamps in `e2e/setup/global-setup.ts`.

## Status at merge of web-serve + diagnostics-removal (combined head 4b5d1f04)

- Combined CI run 39011022105: job ended at ~12.5 min against a 15 min
  timeout-minutes limit, with the test phase still running. No JUnit/report
  artifact was written, so no per-test verdict exists yet.
- Interpretation: the suite is slower than the CI budget, not failing fast. The
  report is only written at the end, so a timeout hides every result.
- Open decision for owner: raise the E2E job timeout-minutes (15 -> e.g. 30) so the
  suite can finish and report, OR keep 15 and shard/limit the suite. Recommended:
  raise to 30 now (unblocks preview), then shard later. Not changed autonomously
  because it alters CI cost/limits.
- Billing lifecycle tests skip on a clean DB (no seeded invoices); login is
  proven, the lifecycle itself is not yet validated end to end.

## E2E-4 (wdvf3acxhq): Rebuild visit lifecycle on current seed (2026-11-21)

**Branch:** `fix/wdvf3acxhq-visit-lifecycle-e2e-v2`

### What was done

- **New seed:** `e2e/setup/seeds/visit-lifecycle-v2.seed.ts` — creates 1 client
  (Austin TX, geocoded for geofence) + 2 caregivers (one CLEARED, one PENDING/no
  background_check). Seeds with `ON CONFLICT DO UPDATE` so it is idempotent.
  IDs use prefix `ee40` (distinct from `ee20` used by evv-clock-persistence).
- **Seed runner:** `scripts/run-visit-lifecycle-seed.ts` — one-off script that
  connects to `DATABASE_URL`, runs the seed, and exits cleanly.
- **New spec:** `e2e/tests/visit-lifecycle.spec.ts` — single `test.describe` tagged
  `@full` (not `@smoke-eligible` because a multi-step journey with an external
  Postgres DB is unlikely to stay under 90 s):
  1. Positive full journey: POST schedule → PUT assign → POST clock-in (inside
     geofence) → POST clock-out → GET EVV (verify 6 Cures Act elements) →
     GET visit (status=COMPLETED, billable flag checked if present).
  2. N1: Clock-in with NYC coordinates — asserts EVV verification.passed=false.
  3. N2: Assign non-cleared caregiver with `checkCompliance=true` — asserts a
     compliance issue is returned (422 / 400 / body.complianceIssues).

### Auth dependency note (E2E-3)

The ticket calls for E2E-3 persona storageState (branch
`feature/wdvf3acxhp-real-persona-logins`). That branch is in QA, not on
preview. This spec uses the same `loginAsAdmin` / `apiGet` / `apiPost` /
`apiPut` pattern as `evv-clock-persistence.spec.ts`. When E2E-3 merges:
replace `loginAsAdmin` with `coordinatorContext` / `caregiverContext`
storageState and split the visit steps across two separate browser contexts.

### Retired spec decisions

| Spec (in e2e/retired/) | Decision | Reason |
|---|---|---|
| `visit-lifecycle.spec.ts` | **REBUILT** (this ticket) | New seed + API-driven journey replacing old page-object spec |
| `critical-journeys.spec.ts` | **STAY RETIRED** | Depends on old `visit-lifecycle` seed + VisitDetailPage POM; needs dedicated ticket |
| `multi-user-workflows.spec.ts` | **STAY RETIRED** | Requires real multi-role storageState (E2E-3 not yet merged) |
| `mobile-workflows.spec.ts` | **STAY RETIRED** | Mobile viewport + touch events POM; not blocked by seed but scope beyond this ticket |
| `data-integrity.spec.ts` | **STAY RETIRED** | Depends on old seed; pure-logic tests belong in vitest |
| `error-scenarios.spec.ts` | **STAY RETIRED** | Depends on old seed; API error cases partially covered by vitest |
| `security.spec.ts` | **STAY RETIRED** | Depends on old seed; auth/authz unit tests cover the logic |
| `accessibility.spec.ts` | **STAY RETIRED** | Needs axe-playwright integration work; not seed-blocked but separate effort |

### Notes on evv-compliance.spec.ts and caregiver-assignment.spec.ts

Reviewed for the split decision:
- **evv-compliance.spec.ts**: Drives `/api/evv/*` endpoints via `apiPost`/`apiGet`
  (no page objects). Fully API-level — appropriate for E2E (EVV persistence across
  requests is integration-level). Keep in `e2e/tests/`.
- **caregiver-assignment.spec.ts**: Mixes UI page-object calls with API calls.
  The UI assertions use `VisitDetailPage` POM which references the web app. Keep
  in `e2e/tests/` but mark as needing a live web server (uses `baseURL`).

## Verified full-suite result (run 39034305439, commit 4be79a15, chromium)

- 131 unique tests: **34 passed, 10 skipped, 87 failed**.
- The JUnit artifact is now uploaded, but Playwright writes it with 0 testcases in
  this configuration. The CI step log carries the real per-test results. Fixing the
  reporter so the JUnit file contains per-test entries is a follow-up.
- Failure groups (likely shared causes):
  1. Visual regression (~30): "should match baseline" fails. Baselines must be
     generated for this environment. Test-infrastructure, not product.
  2. EVV, caregiver-assignment, billing/payroll (~40): need seeded fixture data
     beyond the current seed set (seed drift).
  3. Performance (8), shift-matching/scheduling (~10), smoke/API (2): need their
     own investigation.
