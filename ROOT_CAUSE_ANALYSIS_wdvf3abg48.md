# Root Cause Analysis: Client Edit Route 404

**Ticket**: wdvf3abg48  
**Issue**: Clicking edit on a client card from /clients returns a 404  
**Date**: October 13, 2026

---

## Quick Summary

| Aspect | Finding |
|--------|---------|
| **Root Cause** | Missing route definition in `App.tsx` + missing `ClientEditPage` component |
| **Route Path** | `/clients/:id/edit` (NOT defined) |
| **Bug Location** | `packages/web/src/App.tsx` (line 260-267) |
| **Broken Link Source** | `ClientDetail.tsx` (line 72) links to non-existent route |
| **Severity** | High - Feature completely broken |
| **Fix Complexity** | Low - Reuse existing components |
| **Estimated Effort** | 2-4 hours |

---

## The Problem: Route Not Defined

### What User Experiences

1. User navigates to `/clients` → Works ✅
2. User clicks a client card → Goes to `/clients/{id}` → Works ✅
3. User clicks "Edit" button → Goes to `/clients/{id}/edit` → **404 Error** ❌

### Why It Happens

**App.tsx does NOT have a route for `/clients/:id/edit`**

Current routes in `App.tsx` (lines 218-287):
```tsx
<Route path="/clients" ... />              // List
<Route path="/clients/intake" ... />       // Create (new)
<Route path="/clients/dashboard" ... />    // Dashboard
<Route path="/clients/new/intake" ... />   // Create (alternative)
<Route path="/clients/:id" ... />          // Detail (VIEW ONLY)
<Route path="/clients/:clientId/medications" /> // Medications
// ❌ MISSING: <Route path="/clients/:id/edit" ... />
```

**BUT** the Edit button exists in `ClientDetail.tsx` (line 72):
```tsx
<Link to={`/clients/${client.id}/edit`}>
  <Button>Edit</Button>
</Link>
```

This link points to a route that doesn't exist → React Router returns 404.

---

## Evidence Trail

### 1. Route Definition Gap
```bash
# Show all client routes
$ grep -n 'path="/clients' packages/web/src/App.tsx

218:        path="/clients"                 ← List
228:        path="/clients/intake"          ← Create
240:        path="/clients/dashboard"       ← Dashboard  
260:        path="/clients/:id"             ← Detail
270:        path="/clients/new/intake"      ← Create (alt)
280:        path="/clients/:clientId/medications"
# ❌ No /clients/:id/edit
```

### 2. Link Exists But Route Missing
```bash
$ grep -n "clients.*edit" packages/web/src/verticals/client-demographics/pages/ClientDetail.tsx

72:    <Link to={`/clients/${client.id}/edit`}>
# This link exists but route doesn't!
```

### 3. Comparison to Similar Features
```bash
# Care-plans have working edit route
$ grep -A3 'path="/care-plans/:id/edit' packages/web/src/App.tsx
481:        path="/care-plans/:id/edit"
482:        element={
483:          <ProtectedRoute>
484:            <AppShell>
485:              <EditCarePlanPage />  ← Component exists!

# Billing has working edit route
$ grep -A3 'path="/billing/:id/edit' packages/web/src/App.tsx
603:        path="/billing/:id/edit"
```

### 4. No ClientEditPage Component
```bash
$ ls packages/web/src/verticals/client-demographics/pages/
ClientDashboard.tsx
ClientDetail.tsx
ClientList.tsx
# ❌ No ClientEditPage.tsx
```

---

## Root Cause Confirmed

### Primary Issue
✗ **Route `/clients/:id/edit` is NOT defined in `App.tsx`**

### Secondary Issue
✗ **No `ClientEditPage` component exists to handle the route**

### Why This Happened
- **Edit button was added** to `ClientDetail.tsx` (line 72)
- **Route was never added** to `App.tsx`
- **Component was never created** for the edit page
- **No tests caught it** (missing route would be caught by E2E tests)

---

## Good News: Solution Is Simple

### 1. Route Is Easy to Add
React Router route definition is just 7 lines:
```tsx
<Route
  path="/clients/:id/edit"
  element={<ClientEditPage />}
/>
```

### 2. Component Can Reuse Existing Code
- `ClientIntakeWorkflow` already exists (creates clients)
- Can be adapted for editing with minimal changes
- No new database schema needed

### 3. Hooks Already Exist
✅ `useClient()` - Fetch existing client data  
✅ `useCreateClient()` - Create new clients  
✅ `useUpdateClient()` - Update existing clients  
✅ All hooks are already implemented

### 4. Backend API Ready
The backend already supports PUT requests:
```
PUT /api/clients/:id
```
Just need to use the existing `useUpdateClient()` hook.

---

## Route Ordering Matters

**Critical**: Must place edit route BEFORE detail route:

```tsx
❌ WRONG (this is current state):
<Route path="/clients/:id" />        ← Catches "edit" as :id
<Route path="/clients/:id/edit" />   ← Never reached!

✅ CORRECT (what we need):
<Route path="/clients/:id/edit" />   ← Specific route first
<Route path="/clients/:id" />        ← General route second
```

React Router matches routes in order. If `:id` route comes first, it matches ANY path after `/clients/`, including `/clients/edit`.

---

## Implementation Path

### Step 1: Create Edit Page (80 lines)
File: `packages/web/src/verticals/client-demographics/pages/ClientEditPage.tsx`

Responsibilities:
- Load existing client via `useClient(id)`
- Pass data to form component
- Handle update submission
- Navigate to detail on success

### Step 2: Update ClientIntakeWorkflow (50 lines)
File: `packages/web/src/pages/clients/ClientIntakeWorkflow.tsx`

Changes:
- Add `isEditMode` prop
- Add `initialData` prop for pre-population
- Conditionally call create vs update mutation

### Step 3: Add Route to App.tsx (15 lines)
File: `packages/web/src/App.tsx`

Changes:
- Add lazy import of `ClientEditPage`
- Add route for `/clients/:id/edit` (BEFORE `/clients/:id`)

### Step 4: Create Data Mapper (100 lines)
File: `packages/web/src/verticals/client-demographics/utils/mappers.ts`

Purpose:
- Convert `Client` database type to `IntakeData` form type
- Handle null/undefined values
- Prepare data for form pre-population

---

## Testing Strategy

### Unit Tests
- ClientEditPage loads data correctly
- Form pre-populates with client data
- Form submission calls updateClient hook
- Navigation works after successful update

### E2E Tests
- Navigate to /clients
- Click client detail
- Click Edit button
- Verify URL is `/clients/:id/edit` (NOT 404)
- Edit a field
- Submit form
- Verify success toast
- Verify updated data on detail page

### Manual Test
```bash
# 1. Start dev server
npm run dev

# 2. Navigate in browser
http://localhost:5173/clients
↓
Click a client
↓
Click "Edit" button
↓
Verify: URL should be /clients/{id}/edit
Verify: Form should show client data
Verify: No 404 error
```

---

## Files Affected

| File | Changes | Impact |
|------|---------|--------|
| `App.tsx` | Add route, reorder | Routes |
| `ClientEditPage.tsx` | Create new | Feature |
| `ClientIntakeWorkflow.tsx` | Add edit props | Logic |
| `mappers.ts` | Create new | Utility |
| `index.ts` (pages) | Add export | Exports |

**Total New Code**: ~180 lines  
**Total Modified Code**: ~65 lines  
**Total Impact**: Small, focused change

---

## Risk Level: LOW

✅ Reusing tested components  
✅ No database changes  
✅ No API changes needed  
✅ Similar pattern used in other features (care-plans)  
✅ All required hooks already exist  

---

## Next Steps

1. **Review this spec** ← You are here
2. **Approve implementation approach**
3. **Create ClientEditPage.tsx**
4. **Update App.tsx routes**
5. **Run tests**
6. **Manual QA on dev/preview**
7. **Deploy to production**

---

**Status**: ✅ Root cause identified and confirmed  
**Confidence**: 100% (route definition gap is clear)  
**Spec Ready**: Yes, implementation plan detailed in TECHNICAL_SPEC_wdvf3abg48.md
