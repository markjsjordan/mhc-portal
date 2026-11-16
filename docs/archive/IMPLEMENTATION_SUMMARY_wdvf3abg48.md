# Summary Report: Client Edit Route 404 Analysis

**Ticket**: wdvf3abg48  
**Date**: October 13, 2026  
**Status**: ✅ SPEC COMPLETE - Ready for Implementation

---

## Executive Overview

### The Issue
Users clicking the "Edit" button on a client card receive a **404 Not Found** error when navigating to `/clients/{id}/edit`.

### Root Cause
**The route `/clients/:id/edit` is not defined in `App.tsx` and no `ClientEditPage` component exists.**

### Fix Complexity
🟢 **LOW** - Straightforward addition of missing route + component reuse

### Implementation Effort
⏱️ **2-4 hours** - ~245 lines of code across 5 files

---

## What's Broken

```
Current Flow:
/clients                           ✅ Works (List)
  ↓
/clients/{id}                      ✅ Works (Detail)
  ↓
Click "Edit" button → /clients/{id}/edit  ❌ 404 Error
```

## Root Cause Tree

```
404 Error on /clients/:id/edit
│
├─ Route Not Defined in App.tsx
│  ├─ /clients/:id/edit missing from routes
│  └─ Only /clients/:id exists (detail view only)
│
└─ Component Missing
   └─ No ClientEditPage.tsx exists to handle route
```

---

## Proof of Issue

### Evidence 1: Link Exists But Route Missing
**ClientDetail.tsx (line 72)**:
```tsx
<Link to={`/clients/${client.id}/edit`}>  // ← Link to non-existent route
  <Button>Edit</Button>
</Link>
```

**App.tsx (lines 218-287)**:
```tsx
<Route path="/clients" ... />          // ✅
<Route path="/clients/intake" ... />   // ✅
<Route path="/clients/:id" ... />      // ✅
// ❌ <Route path="/clients/:id/edit" /> MISSING!
```

### Evidence 2: Comparison to Working Features
**Care Plans Edit (WORKING)**:
```tsx
// App.tsx line 481
<Route path="/care-plans/:id/edit" element={<EditCarePlanPage />} />
```

**Clients Edit (BROKEN)**:
```tsx
// App.tsx - NO SUCH ROUTE
// /clients/:id/edit returns 404
```

### Evidence 3: No Component Exists
```bash
$ ls packages/web/src/verticals/client-demographics/pages/
ClientDashboard.tsx    ✅
ClientDetail.tsx       ✅
ClientList.tsx         ✅
ClientEditPage.tsx     ❌ MISSING
```

---

## The Fix (Overview)

### Component Creation
Create `ClientEditPage.tsx` that:
1. Loads existing client data via `useClient(id)` hook
2. Pre-populates form with client data
3. Submits update via `useUpdateClient()` hook
4. Navigates back to detail on success

### Route Addition
Add to `App.tsx`:
```tsx
<Route 
  path="/clients/:id/edit"
  element={<ClientEditPage />}
/>
```

**IMPORTANT**: Must come BEFORE `/clients/:id` route for proper matching order.

### Form Component Enhancement
Modify `ClientIntakeWorkflow` to:
- Accept `isEditMode` prop
- Accept `initialData` prop for pre-population
- Conditionally create vs update

### Utilities
Create data mapper to transform between:
- `Client` (database type) → `IntakeData` (form type)

---

## Files to Create/Modify

| File | Action | LOC |
|------|--------|-----|
| `ClientEditPage.tsx` | Create | 80 |
| `mappers.ts` | Create | 100 |
| `App.tsx` | Modify (add route & import) | +15 |
| `ClientIntakeWorkflow.tsx` | Modify (add edit props) | +50 |
| `pages/index.ts` | Modify (add export) | +1 |
| **TOTAL** | | **~245 LOC** |

---

## Infrastructure Ready ✅

All required dependencies already exist:

✅ **Hooks**:
- `useClient(id)` - Fetch client data
- `useUpdateClient()` - Update client via API
- `useCreateClient()` - Create client

✅ **Types**:
- `Client` interface
- `UpdateClientInput` interface
- All type definitions present

✅ **Form Component**:
- `ClientIntakeWorkflow` can be reused
- Works for both create and edit modes

✅ **API**:
- Backend supports `PUT /api/clients/:id`
- Returns updated client data

---

## Testing Plan

### E2E Test Flow
```bash
1. Login to system
2. Navigate to /clients
3. Click a client card
4. Click "Edit" button
5. ✅ Verify: URL is /clients/{id}/edit (NOT 404)
6. ✅ Verify: Form pre-populated with client data
7. Edit a field (e.g., first name)
8. Submit form
9. ✅ Verify: Success toast appears
10. ✅ Verify: Navigated to /clients/{id}
11. ✅ Verify: Updated data displayed on detail page
```

### Manual Test Checklist
- [ ] Dev server starts: `npm run dev`
- [ ] Can navigate to `/clients`
- [ ] Can click client card → `/clients/{id}`
- [ ] Can click Edit → `/clients/{id}/edit` (NOT 404)
- [ ] Form loads with pre-filled data
- [ ] Can edit fields
- [ ] Submit works
- [ ] Navigation back to detail works
- [ ] Updated data is displayed
- [ ] Permission checks work (clients:write)

---

## Risk Assessment

### Risk Level: LOW 🟢

**Why Low Risk?**
- ✅ Reusing tested components
- ✅ No database schema changes
- ✅ No API contract changes
- ✅ Similar pattern exists (care-plans)
- ✅ All hooks/types already available
- ✅ Isolated to client module

**Potential Issues & Mitigations**:

| Issue | Mitigation |
|-------|-----------|
| Route match order wrong | Place edit before detail in route definition |
| Form validation fails in edit | Test validation in both create/edit modes |
| Data transformation bugs | Unit test the mapper utility |
| Update API fails silently | Add error handling and logging |
| Permission bypass | Verify clients:write guard on route |

---

## Success Criteria

After implementation, verify:

✅ Navigate to `/clients/{id}/edit` → Shows form (NOT 404)  
✅ Form pre-populates with existing client data  
✅ Can edit fields and submit  
✅ Backend receives PUT request with updated data  
✅ Success notification displays  
✅ Redirected to `/clients/{id}` after save  
✅ Detail page shows updated values  
✅ Users without `clients:write` can't access  
✅ No console errors or warnings  
✅ All existing features still work  

---

## Implementation Sequence

### Phase 1: Component Development (1-2 hours)
1. Create `ClientEditPage.tsx`
2. Create `mappers.ts` utility
3. Update `ClientIntakeWorkflow.tsx` for edit mode
4. Export new component

### Phase 2: Routing (15 minutes)
1. Add lazy import in `App.tsx`
2. Add `/clients/:id/edit` route BEFORE `/clients/:id`

### Phase 3: Testing (1-2 hours)
1. Unit tests for components
2. E2E tests for edit flow
3. Manual testing on dev/preview

### Phase 4: Review & Merge (30 minutes)
1. Code review
2. QA approval
3. Merge to develop
4. Deploy to preview/production

---

## Supporting Documentation

### Files Created Today
1. **`TECHNICAL_SPEC_wdvf3abg48.md`** (17 KB)
   - Comprehensive implementation guide
   - Step-by-step instructions
   - Code examples and patterns
   - Testing checklist

2. **`ROOT_CAUSE_ANALYSIS_wdvf3abg48.md`** (8 KB)
   - Detailed root cause explanation
   - Evidence trail
   - Route ordering explanation
   - Quick reference guide

3. **`IMPLEMENTATION_SUMMARY_wdvf3abg48.md`** (this file)
   - Executive summary
   - Quick facts
   - Risk assessment
   - Success criteria

---

## Key Learnings

### What Went Wrong
- Edit button was added to ClientDetail component
- Route was never added to main App.tsx
- No component was created to handle the route
- No E2E tests caught the missing route

### Lessons for Future
- Routes should be added at the same time as link creation
- Component creation and routing should be paired
- E2E tests should verify all navigable routes
- Similar features (care-plans edit) should serve as template

---

## Quick Links

- **GitHub Issue**: wdvf3abg48
- **Live URL**: https://mhc-family-portal.vercel.app/clients/{id}/edit
- **Test on Local**: http://localhost:5173/clients

---

## Sign-Off

**Analysis Status**: ✅ COMPLETE  
**Root Cause**: CONFIRMED - Route not defined, component missing  
**Solution**: DESIGNED - 245 lines across 5 files  
**Complexity**: LOW - Straightforward component reuse  
**Effort**: 2-4 hours  
**Risk**: LOW - Isolated change, tested patterns  

**Next Step**: Forward to development team for implementation.

---

**Document Version**: 1.0  
**Created**: October 13, 2026  
**Analyst**: AI Agent  
**Status**: Ready for Development
