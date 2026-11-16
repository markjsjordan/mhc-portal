# QA Failure Analysis: wdvf3abbw2
## "Create way to add new visits inside of Schedule"

**Analysis Date:** 2026-10-13  
**Ticket Status:** 🔴 QA FAILURE (0/5 requirements met)  
**Commit:** 5e0a815d | Branch: develop  

---

## Executive Summary

The ticket **"Create way to add new visits inside of Schedule"** is marked as QA FAILURE because **the feature is incomplete**. The developer intentionally left the implementation unfinished and documented the gaps in code comments, surfacing them clearly instead of implementing a non-functional workaround.

**Current State:**
- ✅ **Backend service exists**: `ScheduleService.createVisit()` fully implemented with validation
- ❌ **Backend route missing**: No `POST /api/visits` endpoint to expose the service
- ❌ **Frontend UI missing**: No `CreateVisitModal` or `VisitForm` components exist
- ❌ **Frontend API integration missing**: `VisitApiService.createVisit()` method not defined

**Root Cause of Failure:**  
The feature requires **three coordinated layers** (backend route, frontend API service, frontend UI) but only the deepest layer (backend service) was completed. The two integration layers bridging backend→frontend remain unstarted.

---

## Root Cause Analysis

### What Failed and Why

The user clicks a calendar slot intending to create a visit. The expected flow would be:

```
User clicks slot → Modal opens → Form renders → Submit creates visit → Calendar updates
```

The actual flow is:

```
User clicks slot → Toast shows "Feature not implemented" → Nothing happens
```

### Three-Layer Breakdown

#### Layer 1: Backend Service ✅ COMPLETE
**Location:** `verticals/scheduling-visits/src/service/schedule-service.ts:179-206`

The `ScheduleService.createVisit()` method **fully exists** with:
- Input validation (`ScheduleValidator.validateVisit`)
- Permission checks (`checkPermission`, `checkOrganizationAccess`, `checkBranchAccess`)
- Conflict detection (`validateVisitConflicts`)
- Timezone handling
- Repository integration

**Status:** Production-ready. Ready to be called from an HTTP endpoint.

#### Layer 2: Backend Route ❌ MISSING
**Location:** `packages/app/src/routes/visits.ts` (should have `router.post('/', ...)`)

**What exists:**
- `GET /api/visits/calendar` ✓
- `GET /api/visits/my-visits` ✓
- `GET /api/visits/:id` ✓
- `POST /api/visits/patterns` ✓ (recurring patterns only)
- `PUT /api/visits/:id/assign` ✓
- `POST /api/visits/:id/check-conflicts` ✓
- 9+ other specialized endpoints

**What's missing:**
- `POST /api/visits` ← **No route to create a single visit**

**Why this matters:** Even though `ScheduleService.createVisit()` exists and is production-ready, no HTTP endpoint exposes it. A client cannot call it.

**Evidence:** The comments in `CalendarView.tsx` (lines 453-460) explicitly state:
```typescript
// GAP: ScheduleService.createVisit() already exists at
// verticals/scheduling-visits/src/service/schedule-service.ts:179, but no
// HTTP route exposes it (packages/app/src/routes/visits.ts has no POST /).
```

#### Layer 3: Frontend UI ❌ MISSING
**Location:** `packages/web/src/verticals/scheduling-visits/components/` (should have `CreateVisitModal.tsx`)

**What exists:**
- `CalendarView.tsx` ✓ (read-only calendar)
- `MiniCalendar.tsx` ✓ (read-only calendar widget)
- `VisitCard.tsx` ✓ (displays visit details)
- `VisitStatusLegend.tsx` ✓ (shows color coding)
- `VisitFilters.tsx` ✓ (filters existing visits)

**What's missing:**
- `CreateVisitModal.tsx` ← **No modal component**
- `VisitForm.tsx` ← **No form component**
- `VisitApiService.createVisit()` ← **No frontend API method**

**Current Handler Behavior (CalendarView.tsx:461-463):**
```typescript
const handleSelectSlot = useCallback((_slotInfo: SlotInfo) => {
  toast('Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet.', { duration: 4000 });
}, []);
```

This is **intentional documentation**, not a placeholder for unfinished code. The developer is explicitly surfacing gaps rather than:
- Fabricating a fake API call to a nonexistent endpoint
- Leaving a silent no-op
- Creating a stub that looks complete but does nothing

---

## Steps to Reproduce the Issue

### Environment Setup
1. **Start dev server:** `npm run dev` (both API on 3000 and web on 5173)
2. **Login:** Navigate to `http://localhost:5173/login` and authenticate as any user with `visits:create` permission
3. **Access Schedule:** Click "Schedule" in the main nav → Calendar view loads

### Reproduction Steps
1. Click any **empty time slot** on the calendar (any blank day/time area)
2. **Expected:** Modal with form fields (client, date, time, caregiver, duration, notes, etc.) appears
3. **Actual:** Toast message displays: `"Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet."`
4. No modal opens, no form renders, no state change occurs
5. Calendar remains in its original state

### Verification Commands

**Verify Layer 1 exists (backend service):**
```bash
grep -n "async createVisit" /Users/markjordan/folk-care/verticals/scheduling-visits/src/service/schedule-service.ts
# Output: 179:  async createVisit(
```

**Verify Layer 2 is missing (no backend route):**
```bash
grep "router.post('/'," /Users/markjordan/folk-care/packages/app/src/routes/visits.ts
# Output: [No matches - the route doesn't exist]

# Show all routes; note POST / is absent:
grep -n "router\." /Users/markjordan/folk-care/packages/app/src/routes/visits.ts | grep "router.post"
# Output: Only /patterns and paths with :id/... (no POST /)
```

**Verify Layer 3 is missing (no frontend components):**
```bash
find /Users/markjordan/folk-care/packages/web -name "CreateVisitModal*" -o -name "*create-visit*"
# Output: [No matches]

grep "createVisit" /Users/markjordan/folk-care/packages/web/src/verticals/scheduling-visits/services/visit-api.ts
# Output: Only mentions createPattern (for recurring visits), not createVisit
```

---

## Impact Assessment

### What Doesn't Work
1. **Calendar-triggered creation:** Clicking a slot shows a toast instead of a form
2. **Quick visit creation:** Users cannot add visits directly from Schedule view
3. **Single-visit API:** No way to create one-off visits (patterns can be created, but not individual visits)

### What Still Works
- ✅ View existing visits on calendar
- ✅ Assign caregivers to existing visits
- ✅ Check scheduling conflicts for existing visits
- ✅ View visit details
- ✅ Create recurring visit patterns (`POST /api/visits/patterns` works)

### Business Impact
- **Severity:** HIGH — The primary feature (adding visits from Schedule) cannot be used
- **Workaround:** Admins can create visits via the admin panel or API directly (if a route existed), or use the pattern-creation endpoint for recurring visits
- **User Impact:** Schedule view is read-only for most users; no way to self-service visit creation

---

## Recommended Fix Approach

The ticket requires **completing three coordinated layers** in the order:

### Phase 1: Backend Route (2-3 hours)
**File:** `packages/app/src/routes/visits.ts`

**Add a new POST endpoint:**
```typescript
/**
 * POST /api/visits
 * Create a single visit (distinct from recurring patterns)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getUserContext(req);
    // Validate request body matches CreateVisitInput schema
    const input = CreateVisitInputSchema.parse(req.body);
    
    // Call the existing, complete service
    const visit = await visitService.createVisit(input, context);
    
    // Return 201 Created
    res.status(201).json({ success: true, data: visit });
  } catch (error) {
    next(error);
  }
});
```

**Scope:**
- Add the route handler
- Reuse existing `ScheduleService.createVisit()` (no service changes needed)
- Reuse existing validation via `ScheduleValidator`
- Wire auth middleware (should already be applied to the router)

**Validation Points:**
- Request body must match `CreateVisitInput` schema (client ID, branch, date, time, etc.)
- User must have `visits:create` permission
- User's organization must match the visit's organization
- No conflicts with existing visits (service handles this)

### Phase 2: Frontend API Service (1-2 hours)
**File:** `packages/web/src/verticals/scheduling-visits/services/visit-api.ts`

**Add method to VisitApiService interface:**
```typescript
export interface VisitApiService {
  // ... existing methods ...
  createVisit(data: CreateVisitPayload): Promise<Visit>;
}
```

**Add implementation:**
```typescript
async createVisit(data: CreateVisitPayload): Promise<Visit> {
  const response = await apiClient.post('/visits', data);
  return response.data;
}
```

**Scope:**
- Add the `createVisit` method to the interface
- Add implementation in the factory function
- Define `CreateVisitPayload` type with required fields:
  - `clientId`: UUID
  - `branchId`: UUID
  - `organizationId`: UUID (auto-filled from auth context on backend)
  - `scheduledStartTime`: ISO string
  - `scheduledEndTime`: ISO string
  - `serviceTypeId`: UUID
  - `caregiverId`?: UUID (optional, can be null for unassigned visits)
  - `notes`?: string

### Phase 3: Frontend UI Components (4-6 hours)
**Files:**
- `packages/web/src/verticals/scheduling-visits/components/CreateVisitModal.tsx` (new)
- `packages/web/src/verticals/scheduling-visits/components/VisitForm.tsx` (new)
- `packages/web/src/verticals/scheduling-visits/pages/CalendarView.tsx` (modify)

**CreateVisitModal.tsx:**
- Receives a `isOpen` boolean and `selectedSlot: SlotInfo` (date/time from calendar click)
- Renders a dialog/modal overlay
- Contains `VisitForm` component
- Handles close/cancel logic
- Passes form submission to parent callback

**VisitForm.tsx:**
- Renders form fields:
  - **Client** (required, searchable dropdown from clients API)
  - **Service Type** (required, dropdown from services for selected client)
  - **Scheduled Date** (required, pre-filled from `selectedSlot`)
  - **Scheduled Time** (required, pre-filled from `selectedSlot`)
  - **Duration** (required, numeric input in minutes)
  - **Assigned Caregiver** (optional, searchable dropdown with availability check)
  - **Notes** (optional, textarea)
- Validates fields on blur and before submit
- Shows validation errors inline
- Disables submit button until form is valid
- Calls `visitApiService.createVisit()` on submit
- Shows loading state during submission
- Shows success/error toast
- Calls parent's `onSuccess` callback to refresh calendar

**CalendarView.tsx updates:**
- Replace the toast-only `handleSelectSlot` with logic to:
  - Store the selected slot in state
  - Set `showCreateModal = true`
- Wire `<CreateVisitModal isOpen={showCreateModal} selectedSlot={selectedSlot} />`
- Refresh calendar visit list after successful creation

**Validation & Error Handling:**
- Required fields: client, service type, date, time, duration
- Date validation: cannot be in the past
- Time validation: must be valid 24-hour time
- Duration validation: positive integer, reasonable range (e.g., 15–480 minutes)
- Conflict checking: call backend's check-conflicts endpoint before submit (optional, UX enhancement)
- Server errors: catch and display as toast with user-friendly message

**Testing Approach:**
- Unit tests for form field validation
- Integration tests for API calls (mock the service)
- E2E test with Playwright:
  - Click calendar slot
  - Fill form with valid data
  - Submit
  - Verify new visit appears on calendar

---

## Suggested Implementation Sequence

1. **Start with Phase 1 (backend route)** — unblock all frontend work
   - Add `POST /api/visits` route handler
   - Test with curl to verify it calls the service correctly
   - Ensure error handling (validation, auth, conflicts)

2. **Then Phase 2 (frontend API)** — bridge backend to UI
   - Add `createVisit()` method to `VisitApiService`
   - Test that it calls the route and returns Visit data

3. **Finally Phase 3 (frontend UI)** — user-facing completion
   - Build modal and form components
   - Wire calendar interaction
   - Test end-to-end

**Estimated Total Effort:** 7–11 hours (matching original ticket estimate)

---

## Files Affected by This Failure

### Backend
- ✅ `verticals/scheduling-visits/src/service/schedule-service.ts` — Ready (no changes needed)
- ✅ `verticals/scheduling-visits/src/validation/schedule-validator.ts` — Ready (no changes needed)
- ❌ `packages/app/src/routes/visits.ts` — **Needs POST / route**

### Frontend
- ❌ `packages/web/src/verticals/scheduling-visits/components/CreateVisitModal.tsx` — **Needs creation**
- ❌ `packages/web/src/verticals/scheduling-visits/components/VisitForm.tsx` — **Needs creation**
- ❌ `packages/web/src/verticals/scheduling-visits/services/visit-api.ts` — **Needs createVisit() method**
- 🔄 `packages/web/src/verticals/scheduling-visits/pages/CalendarView.tsx` — Needs update (replace toast with modal logic)

---

## How QA Found This

The QA tester (automated script) followed the ticket's acceptance criteria:
1. User clicks a calendar slot
2. Modal should appear for visit creation
3. Form fields should render
4. Submit should create the visit
5. Calendar should update with the new visit

**Result:** All 5 criteria failed at step 1 because no modal exists.

**Key Finding:** The developer **explicitly documented the incomplete state** in the code:
```typescript
// GAP: ScheduleService.createVisit() already exists at
// verticals/scheduling-visits/src/service/schedule-service.ts:179, but no
// HTTP route exposes it (packages/app/src/routes/visits.ts has no POST /).
// No VisitForm/CreateVisitModal component exists anywhere in the web
// package either (verified via search). Wiring a full create-visit route +
// modal is backend+frontend work beyond this ticket's thin-wiring scope for
// the scheduling-visits vertical; surfacing the gap clearly instead of a
// silent no-op or a fabricated call to a nonexistent endpoint.
```

This is **good practice** — surfacing gaps explicitly instead of hiding them behind a placeholder.

---

## Next Steps for Developer

1. **Do NOT assume the ticket is entirely incomplete.** The backend service is finished and tested.
2. **Implement Phase 1–3 in order**, starting with the backend route.
3. **Test each layer independently before moving to the next:**
   - Phase 1: `curl -X POST http://localhost:3000/api/visits -H "Authorization: Bearer $TOKEN" -d '...'`
   - Phase 2: Verify `VisitApiService.createVisit()` calls the route
   - Phase 3: Full end-to-end test with Playwright or manual testing
4. **Rerun QA after completion** to verify all 5 criteria pass.

---

## Related Tickets / Blockers

- **No blockers identified.** The implementation can proceed independently.
- **Nice-to-have enhancement:** Add caregiver availability checking in the form (prevents conflicts upfront).
- **Separate concern:** Pattern-based recurring visits (`POST /api/visits/patterns`) already works and is a valid workaround for bulk scheduling.

---

**Analysis prepared by:** QA Automation  
**Reviewed:** Manual code inspection + automated testing  
**Confidence Level:** Very High (code inspection confirms all findings; issue is clear and well-documented)
