# QA Testing Methodology: wdvf3abbw2

## Objective
Verify that users can create new visits from the Schedule view calendar.

## Test Cases

### Test 1: Schedule View Interaction
**Setup:** Navigate to Schedule/Calendar view  
**Action:** Click on an empty calendar slot  
**Expected:** CreateVisitModal appears with form  
**Actual:** Toast message displays: "Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet."  
**Result:** ✗ FAIL

---

### Test 2: Modal/Form Rendering
**Setup:** Calendar view loaded  
**Action:** Select a time slot on the calendar  
**Expected:** Modal component renders with visit creation form  
**Actual:** No modal component exists in codebase  
**Code Search:**
```bash
$ find packages/web/src -name "*.tsx" | xargs grep -l "CreateVisitModal"
[No results]
```
**Result:** ✗ FAIL

---

### Test 3: Form Field Validation
**Setup:** CreateVisitModal open (prerequisite: Test 2 passes)  
**Actions:**
  - Leave required fields empty
  - Submit form
**Expected:** Validation errors appear for required fields  
**Actual:** N/A - modal doesn't exist  
**Result:** ✗ FAIL (blocked by Test 2)

---

### Test 4: Visit Persistence
**Setup:** Form filled with valid data  
**Action:** Click Save/Create button  
**Expected:** 
  - POST /api/visits endpoint receives request
  - New visit appears in calendar
  - Success toast displays
**Actual:** 
  - No POST /api/visits endpoint exists in visits.ts
  - Verified by reviewing all 1825 lines of route definitions
  - Only found: POST /api/visits/patterns (for recurring patterns)
**Code Evidence:**
```typescript
// From packages/app/src/routes/visits.ts
router.post('/patterns', async (req, res) => {
  // Creates recurring patterns, NOT individual visits
});
// No matching: router.post('/', ...)
```
**Result:** ✗ FAIL

---

### Test 5: Modal Cancellation
**Setup:** CreateVisitModal open with partial form data  
**Action:** Click Cancel button  
**Expected:** Modal closes without creating visit  
**Actual:** N/A - modal doesn't exist  
**Result:** ✗ FAIL (blocked by Test 2)

---

## Code Review Findings

### Backend Analysis
**File:** packages/app/src/routes/visits.ts (1,825 lines)

**Existing Endpoints:**
```
GET    /api/visits/calendar            ✓ Retrieve visits for date range
GET    /api/visits/my-visits           ✓ Retrieve assigned visits
GET    /api/visits/:id                 ✓ Get single visit
PUT    /api/visits/:id/assign          ✓ Assign caregiver
POST   /api/visits/:id/check-conflicts ✓ Check scheduling conflicts
POST   /api/visits/:id/check-assignment✓ Check assignment eligibility
POST   /api/visits/:id/notes           ✓ Add visit note
POST   /api/visits/patterns            ✓ Create recurring pattern
GET    /api/visits/patterns            ✓ List patterns
GET    /api/visits/patterns/:id        ✓ Get pattern details
PUT    /api/visits/patterns/:id        ✓ Update pattern
```

**Missing Endpoints:**
```
POST   /api/visits/                    ✗ CREATE single visit
```

### Frontend Analysis
**File:** packages/web/src/verticals/scheduling-visits/pages/CalendarView.tsx (1,056 lines)

**Current Implementation:**
```typescript
// Lines 452-463: handleSelectSlot function
const handleSelectSlot = useCallback((_slotInfo: SlotInfo) => {
  toast('Creating a visit from the calendar needs a new POST /api/visits route and a visit form - neither exists yet.', { duration: 4000 });
}, []);
```

**Expected Implementation:**
```typescript
// What should exist:
const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
  // Open modal with form
  setShowCreateVisitModal(true);
  setSelectedSlot(slotInfo);
}, []);
```

**Missing Components:**
- CreateVisitModal.tsx ✗
- VisitForm.tsx ✗

**Missing Hooks:**
- useVisitApi().createVisit() ✗

---

## Summary

| Test # | Requirement | Result | Blocker |
|--------|-------------|--------|---------|
| 1 | Add visits from Schedule | ✗ FAIL | Modal doesn't exist |
| 2 | Modal appears | ✗ FAIL | Component missing |
| 3 | Field validation | ✗ FAIL | Blocked by Test 2 |
| 4 | Visit persistence | ✗ FAIL | API endpoint missing |
| 5 | Cancel capability | ✗ FAIL | Blocked by Test 2 |

**Overall:** 0/5 requirements met → **FAIL**

---

## Artifacts

- [Full QA Report](./QA_REPORT_wdvf3abbw2.md)
- Code Reference: CalendarView.tsx:452-463
- Route Analysis: visits.ts (1,825 lines reviewed)
- Component Inventory: Verified via codebase search

## Test Execution Environment

- **OS:** macOS 26.5.2
- **Repository:** /Users/markjordan/folk-care
- **Branch:** develop
- **Commit:** 5e0a815d
- **Test Date:** 2026-10-13

## Status

**🔴 FAIL - Not QA Ready**

The feature is incomplete and cannot be approved for merge. All three implementation phases remain unstarted.
