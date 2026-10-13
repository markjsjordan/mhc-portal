# QA Test Report: wdvf3abbw2
## "Create way to add new visits inside of Schedule"

**Test Date:** 2026-10-13  
**Status:** 🔴 **FAIL** (0/5 requirements met)  
**Commit:** 5e0a815d | Branch: develop  
**Ticket URL:** https://app.clickup.com/t/wdvf3abbw2

---

## Executive Summary

This ticket is **INCOMPLETE**. All 3 phases of the original 7-11 hour estimate remain unstarted:
- Phase 1 (2-3h): Add backend route ❌
- Phase 2 (1-2h): Frontend API ❌
- Phase 3 (4-6h): Modal/form ❌

The Schedule view has no way to add new visits. Clicking a calendar slot only displays a toast message indicating the feature is not implemented.

---

## Test Results

### ✗ Test 1: Can users add new visits from the Schedule view?
**Status:** FAIL  
**Evidence:**  
- CalendarView.tsx lines 452-463 define `handleSelectSlot()` as a no-op
- Only displays: `"Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet."`
- No actual visit creation occurs

**Code Reference:**
```typescript
const handleSelectSlot = useCallback((_slotInfo: SlotInfo) => {
  toast('Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet.', { duration: 4000 });
}, []);
```

---

### ✗ Test 2: Does the visit creation modal/form appear?
**Status:** FAIL  
**Evidence:**
- No CreateVisitModal component exists anywhere in the codebase
- Search results: 0 matches for "CreateVisitModal"
- No VisitForm component found
- CalendarView imports only read-only components: MiniCalendar, VisitStatusLegend, VisitCard

**File Search Results:**
```bash
find /Users/markjordan/folk-care -type f -name "*.tsx" | xargs grep -l "CreateVisitModal"
# Returns: 0 results
```

---

### ✗ Test 3: Are required fields validated?
**Status:** FAIL  
**Evidence:**
- No form exists to validate
- Cannot test field validation without the modal UI

**Impact:** Blocking test 1, 2, and 4

---

### ✗ Test 4: Does the new visit appear in the schedule after save?
**Status:** FAIL  
**Evidence:**
- **No POST /api/visits endpoint exists**
- Reviewed entire visits.ts route file (1825 lines)
- Found routes:
  - ✓ GET /api/visits/calendar
  - ✓ GET /api/visits/my-visits
  - ✓ GET /api/visits/:id
  - ✓ PUT /api/visits/:id/assign
  - ✓ POST /api/visits/patterns (recurring patterns only)
- **Missing:** POST /api/visits (for creating individual visits)

**File Reference:** packages/app/src/routes/visits.ts

---

### ✗ Test 5: Can it be cancelled without creating a visit?
**Status:** FAIL  
**Evidence:**
- No modal UI to cancel
- Cannot test without the modal from test 2

**Impact:** Blocking test 2

---

## Missing Implementation Details

### Backend Gaps (Phase 1-2)

| Item | File | Status | Impact |
|------|------|--------|--------|
| POST /api/visits endpoint | packages/app/src/routes/visits.ts | ❌ MISSING | Cannot save visits |
| Visit creation validation | verticals/scheduling-visits/src/api/ | ❌ MISSING | Cannot validate backend |
| Visit creation service logic | verticals/scheduling-visits/src/service/ | ❌ MISSING | No business logic |

### Frontend Gaps (Phase 3)

| Item | File | Status | Impact |
|------|------|--------|--------|
| CreateVisitModal component | packages/web/src/verticals/scheduling-visits/components/ | ❌ MISSING | Cannot render form |
| VisitApiService.createVisit() | packages/web/src/verticals/scheduling-visits/hooks/ | ❌ MISSING | Cannot call backend |
| Form state management | N/A | ❌ MISSING | Cannot manage form inputs |
| Field validation logic | N/A | ❌ MISSING | Cannot validate UI inputs |

---

## Test Environment

**Repository Path:** /Users/markjordan/folk-care  
**Codebase Branch:** develop  
**Commit Tested:** 5e0a815d  

**Review Scope:**
- ✓ packages/web/src/verticals/scheduling-visits/pages/CalendarView.tsx
- ✓ packages/app/src/routes/visits.ts (1825 lines)
- ✓ verticals/scheduling-visits/src/api/
- ✓ Codebase search for CreateVisitModal (0 results)
- ✓ ClickUp ticket metadata and description

---

## Architectural Context

The ticket description was documented explicitly in the codebase:

**CalendarView.tsx (lines 452-460):**
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

This indicates the developer intentionally left the feature incomplete and documented the gaps.

---

## Recommendation

**Status:** DO NOT MERGE  
**Action:** Return to development  
**Estimated Effort:** 7-11 hours (as per original ticket)

The ticket must complete all three phases before QA sign-off:
1. Add POST /api/visits route and validation
2. Implement VisitApiService.createVisit() on frontend
3. Build CreateVisitModal component with form and field validation

---

## Appendix: Component Inventory

**Existing Components (Read-Only):**
- MiniCalendar.tsx ✓
- VisitStatusLegend.tsx ✓
- VisitCard.tsx ✓
- VisitFilters.tsx ✓
- CalendarView.tsx ✓

**Required Components (Missing):**
- CreateVisitModal.tsx ✗
- VisitForm.tsx ✗
- VisitApiService ✗

---

**QA Tested By:** Automated QA Suite  
**Test Coverage:** 5 functional requirements  
**Pass Rate:** 0/5 (0%)  
**Overall Result:** 🔴 FAIL
