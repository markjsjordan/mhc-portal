# QA Failure Diagnosis: wdvf3abbw2 — Schedule Visit Creation

## Status: 🔴 QA FAILURE — Feature Incomplete

---

## 1. Root Cause of Failure

**The feature requires three coordinated implementation layers; only the deepest layer (backend service) is complete:**

| Layer | Component | Status | Impact |
|-------|-----------|--------|--------|
| **Backend Service** | `ScheduleService.createVisit()` | ✅ DONE | Ready to call from HTTP endpoint |
| **Backend Route** | `POST /api/visits` endpoint | ❌ MISSING | Service unreachable; no HTTP entry point |
| **Frontend API** | `VisitApiService.createVisit()` method | ❌ MISSING | No way to call backend from UI |
| **Frontend UI** | `CreateVisitModal`, `VisitForm` components | ❌ MISSING | No form to collect user input |

**Current Behavior:** User clicks calendar slot → Toast says "Feature not implemented" → Nothing happens

**Expected Behavior:** User clicks slot → Modal opens → Form renders → Submit creates visit → Calendar updates

---

## 2. Steps to Reproduce

### Setup
- Navigate to `http://localhost:5173/schedule` (requires valid login)

### Steps
1. Click any **empty calendar time slot**
2. Toast displays: `"Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet."`
3. No modal appears, no form renders

### Why It Fails
- `CalendarView.tsx` lines 461–463: `handleSelectSlot` callback only shows a toast; no modal logic
- No `CreateVisitModal.tsx` component exists (0 search results across codebase)
- No `VisitApiService.createVisit()` method defined (only `createPattern` for recurring visits)
- No `POST /api/visits` route in `visits.ts` (has `POST /patterns` but not `POST /`)

---

## 3. Recommended Fix Approach

### Phase 1: Add Backend Route (2–3h)
**File:** `packages/app/src/routes/visits.ts`

Add a new `POST /` endpoint that:
- Accepts `CreateVisitInput` payload (client ID, branch, date, time, caregiver, notes, etc.)
- Calls existing `ScheduleService.createVisit()` (already complete and validated)
- Returns 201 Created with the new Visit
- Reuses existing validation, auth, permission checks

**Why fast:** Service is done; route is a thin wrapper calling it.

### Phase 2: Add Frontend API Service Method (1–2h)
**File:** `packages/web/src/verticals/scheduling-visits/services/visit-api.ts`

Add `createVisit(data: CreateVisitPayload): Promise<Visit>` method:
- Calls `POST /api/visits` from Phase 1
- Returns the created Visit for UI refresh

**Why fast:** Boilerplate service method; mirrors existing patterns in codebase.

### Phase 3: Build Frontend UI Components (4–6h)
**Files:**
- `CreateVisitModal.tsx` (new) — Dialog showing the form
- `VisitForm.tsx` (new) — Form with fields (client, service type, date, time, duration, caregiver, notes)
- `CalendarView.tsx` (modify) — Replace toast-only `handleSelectSlot` with modal open logic

**Components need:**
- Pre-fill date/time from clicked slot
- Field validation (required fields, no past dates, valid times)
- API call via `VisitApiService.createVisit()`
- Success/error toasts
- Calendar refresh after success

---

## 4. Evidence & Code References

### Service Exists (Complete)
```
verticals/scheduling-visits/src/service/schedule-service.ts:179
  async createVisit(input: CreateVisitInput, context: UserContext): Promise<Visit>
```
- Validates input with `ScheduleValidator.validateVisit()`
- Checks permissions, org, branch access
- Validates no scheduling conflicts
- Calls repository to persist
- ✅ Production-ready

### Route Missing (No POST /)
```bash
$ grep "router.post\|router.put\|router.get" packages/app/src/routes/visits.ts
# Found: POST /patterns, POST /:id/check-conflicts, POST /:id/check-assignment, etc.
# NOT found: router.post('/', ...)
```

### Frontend Components Missing
```bash
$ find packages/web -name "*CreateVisit*" -o -name "*create-visit*"
# [No results]

$ grep "createVisit" packages/web/src/verticals/scheduling-visits/services/visit-api.ts
# Only createPattern (for recurring patterns); no createVisit method
```

### Developer Left Clear Documentation
```typescript
// CalendarView.tsx lines 453–460:
// GAP: ScheduleService.createVisit() already exists at
// verticals/scheduling-visits/src/service/schedule-service.ts:179, but no
// HTTP route exposes it (packages/app/src/routes/visits.ts has no POST /).
// No VisitForm/CreateVisitModal component exists anywhere in the web
// package either (verified via search). Wiring a full create-visit route +
// modal is backend+frontend work beyond this ticket's thin-wiring scope for
// the scheduling-visits vertical; surfacing the gap clearly instead of a
// silent no-op or a fabricated call to a nonexistent endpoint.
```
This is intentional and good: surfacing gaps clearly rather than hiding them.

---

## 5. Impact Summary

| Aspect | Impact |
|--------|--------|
| **Feature Works** | ❌ Cannot create visits from Schedule view |
| **Severity** | 🔴 HIGH — Primary feature is non-functional |
| **Workaround** | Users can still create recurring patterns (`POST /api/visits/patterns`); individual visits require admin tools |
| **Risk** | LOW — Codebases not affected; can implement independently |
| **Blockage** | Phase 1 blocks Phase 2/3; otherwise no external blockers |

---

## Files Modified
- ✅ **Created:** `/Users/markjordan/folk-care/QA_FAILURE_ANALYSIS_wdvf3abbw2.md` (detailed technical breakdown)

---

## Verdict
**Return to development.** Feature is 33% complete (backend service only); requires all three implementation phases to meet acceptance criteria. Estimated 7–11 hours total effort as per original ticket.
