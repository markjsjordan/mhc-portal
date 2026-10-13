# Technical Specification: Fix Client Edit Route 404

**Ticket**: wdvf3abg48  
**Title**: Clicking edit on a client card from /clients returns a 404  
**Issue URL**: https://mhc-family-portal.vercel.app/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit  
**Status**: SPEC (Ready for Implementation)  
**Date**: October 13, 2026

---

## Executive Summary

Users navigating to the client edit page via the Edit button on a client detail card receive a 404 error. The root cause is a **missing route definition** in `App.tsx` and a **missing ClientEditPage component**. This spec provides a complete implementation plan to enable client editing with full feature parity to the client creation intake workflow.

---

## 1. Root Cause Analysis

### 1.1 Problem Statement
- **User Action**: Navigate to `/clients`, click on a client card, then click the "Edit" button
- **Expected Behavior**: Route to `/clients/{id}/edit` and display an editable client form
- **Actual Behavior**: Route returns HTTP 404 Not Found (Next.js/React Router cannot match the route)

### 1.2 Root Cause Identified

**The `/clients/:id/edit` route is completely missing from the routing configuration.**

#### Evidence

1. **ClientDetail.tsx (line 72)** renders the Edit button with a link:
   ```tsx
   <Link to={`/clients/${client.id}/edit`}>
     <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
       Edit
     </Button>
   </Link>
   ```

2. **App.tsx routes (line 220-287)** does NOT have a matching route:
   ```tsx
   // WORKING ROUTES:
   <Route path="/clients" ... />              // Line 219 → ClientList
   <Route path="/clients/intake" ... />       // Line 228 → ClientIntakeWorkflow (new)
   <Route path="/clients/dashboard" ... />    // Line 240 → ClientDashboard
   <Route path="/clients/new/intake" ... />   // Line 270 → ClientIntakeWorkflow (new)
   <Route path="/clients/:id" ... />          // Line 260 → ClientDetail
   <Route path="/clients/:clientId/medications" /> // Line 280 → MedicationListPage
   
   // MISSING:
   // <Route path="/clients/:id/edit" ... />  ← NOT DEFINED
   ```

3. **Comparison to Working Edit Routes**:
   - Care Plans have a working edit route (line 481):
     ```tsx
     <Route path="/care-plans/:id/edit" element={<EditCarePlanPage />} />
     ```
   - Billing has a working edit route (line 603):
     ```tsx
     <Route path="/billing/:id/edit" element={<InvoiceForm />} />
     ```

4. **No ClientEditPage Component**:
   - Directory `packages/web/src/verticals/client-demographics/pages/` contains:
     - `ClientDetail.tsx` (view only)
     - `ClientList.tsx` (list view)
     - `ClientDashboard.tsx` (dashboard)
     - **MISSING**: `ClientEditPage.tsx` or equivalent

### 1.3 Impact
- **Severity**: High
- **Scope**: All users attempting to edit existing clients
- **Affected Path**: `/clients/:id/edit`
- **Current Workaround**: None (feature is broken)

---

## 2. Proposed Solution Architecture

### 2.1 Design Approach

**Reuse and Adapt the ClientIntakeWorkflow**

The `ClientIntakeWorkflow` (used for new client creation at `/clients/new/intake`) is feature-rich with:
- Multi-step form wizard (5 steps)
- Validation and error handling
- Auto-save with toast notifications
- Proper TypeScript types

**Solution**: Create a `ClientEditPage` that:
1. Loads existing client data via the `useClient()` hook
2. Reuses the `ClientIntakeWorkflow` component in "edit mode"
3. Pre-populates the form with existing data
4. Updates (PUT) instead of creates (POST)
5. Navigates back to detail view on success

### 2.2 Route Architecture

```
Current State (BROKEN):
  /clients/:id → ClientDetail (view only)
  
Target State (FIXED):
  /clients/:id → ClientDetail (view only, has Edit button)
  /clients/:id/edit → ClientEditPage (edit form, new route)
```

**Route Ordering** (important for React Router):
- Must place `/clients/:id/edit` BEFORE `/clients/:id` in route definition
- React Router matches routes in order; otherwise `:id` catches "edit"

---

## 3. Implementation Plan

### 3.1 Phase 1: Create ClientEditPage Component

**File**: `packages/web/src/verticals/client-demographics/pages/ClientEditPage.tsx`

**Responsibilities**:
- Load existing client data via `useClient(id)` hook
- Pass data to ClientIntakeWorkflow in edit mode
- Handle form submission for PUT request
- Navigate to detail view after successful update
- Show loading/error states

**Pseudocode**:
```tsx
export const ClientEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading, error } = useClient(id);
  const navigate = useNavigate();
  
  if (isLoading) return <LoadingSpinner />;
  if (error || !client) return <ErrorMessage />;
  
  return (
    <ClientIntakeWorkflow 
      initialData={mapClientToIntakeData(client)}
      isEditMode={true}
      onSuccess={(updatedClient) => {
        navigate(`/clients/${updatedClient.id}`);
      }}
    />
  );
};
```

**Key Functions**:
- `mapClientToIntakeData(client: Client): IntakeData`
  - Transform the client database object to the form's IntakeData structure
  - Handle null/undefined values with sensible defaults
  - Ensure phone, address, and nested objects are properly structured

### 3.2 Phase 2: Modify ClientIntakeWorkflow for Edit Mode

**File**: `packages/web/src/pages/clients/ClientIntakeWorkflow.tsx`

**Changes**:
1. Add optional props:
   ```tsx
   interface ClientIntakeWorkflowProps {
     initialData?: IntakeData;  // Pre-filled data for edit mode
     isEditMode?: boolean;       // Toggle between create and edit behavior
     onSuccess?: (client: Client) => void; // Custom success callback
   }
   ```

2. In form submission, conditionally call:
   ```tsx
   if (isEditMode && id) {
     await updateClient.mutateAsync({ id, data: formData });
   } else {
     await createClient.mutateAsync(formData);
   }
   ```

3. Use `useUpdateClient()` hook (or create it if missing)

### 3.3 Phase 3: Add Route to App.tsx

**File**: `packages/web/src/App.tsx`

**Changes** (lines 54-56, add new lazy load):
```tsx
// Lazy loaded vertical pages
const ClientList = React.lazy(() => import('./verticals/client-demographics/pages/ClientList').then((m) => ({ default: m.ClientList })));
const ClientDetail = React.lazy(() => import('./verticals/client-demographics/pages/ClientDetail').then((m) => ({ default: m.ClientDetail })));
const ClientEditPage = React.lazy(() => import('./verticals/client-demographics/pages/ClientEditPage').then((m) => ({ default: m.ClientEditPage }))); // NEW
const ClientDashboard = React.lazy(() => import('./verticals/client-demographics/pages/ClientDashboard').then((m) => ({ default: m.ClientDashboard })));
```

**Changes** (lines 259-278, reorder routes and add edit):
```tsx
// IMPORTANT: /clients/:id/edit MUST come BEFORE /clients/:id
<Route
  path="/clients/:id/edit"
  element={
    <ProtectedRoute permission="clients:write">
      <AppShell>
        <ClientEditPage />
      </AppShell>
    </ProtectedRoute>
  }
/>
<Route
  path="/clients/:id"
  element={
    <ProtectedRoute>
      <AppShell>
        <ClientDetail />
      </AppShell>
    </ProtectedRoute>
  }
/>
```

### 3.4 Phase 4: Create Helper Function for Data Transformation

**File**: `packages/web/src/verticals/client-demographics/utils/mappers.ts` (new)

**Purpose**: Map between Client database type and ClientIntakeWorkflow IntakeData form type

```typescript
export function mapClientToIntakeData(client: Client): IntakeData {
  return {
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    middleName: client.middleName || '',
    preferredName: client.preferredName || '',
    dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth).toISOString().split('T')[0] : '',
    gender: client.gender || '',
    
    // Address mapping
    address: {
      line1: client.primaryAddress?.line1 || '',
      line2: client.primaryAddress?.line2 || '',
      city: client.primaryAddress?.city || '',
      state: client.primaryAddress?.state || '',
      postalCode: client.primaryAddress?.postalCode || '',
    },
    
    // Phone mapping
    phone: client.primaryPhone?.number || '',
    
    // Email
    email: client.email || '',
    
    // ... continue for other fields
  };
}
```

### 3.5 Phase 5: Update Export Index

**File**: `packages/web/src/verticals/client-demographics/pages/index.ts`

Add export:
```typescript
export { ClientEditPage } from './ClientEditPage';
```

---

## 4. Testing Plan

### 4.1 Unit Tests

**Test File**: `ClientEditPage.test.tsx`

```typescript
describe('ClientEditPage', () => {
  it('should load client data on mount', async () => {
    render(<ClientEditPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    });
  });

  it('should pre-populate form with client data', async () => {
    render(<ClientEditPage />);
    const firstNameInput = await screen.findByDisplayValue('John');
    expect(firstNameInput).toBeInTheDocument();
  });

  it('should call updateClient on form submission', async () => {
    render(<ClientEditPage />);
    const submitButton = await screen.findByRole('button', { name: /update|save/i });
    fireEvent.click(submitButton);
    // Verify updateClient mutation was called
  });

  it('should navigate to detail page after successful update', async () => {
    const mockNavigate = jest.fn();
    useNavigate.mockReturnValue(mockNavigate);
    // Submit form
    // Verify navigate was called with /clients/{id}
  });

  it('should show error message on update failure', async () => {
    // Mock updateClient to reject
    // Verify error message is displayed
  });
});
```

### 4.2 Integration Tests (E2E with Playwright)

**Test File**: `e2e/client-edit.spec.ts`

```typescript
test('should edit client successfully', async ({ page }) => {
  // 1. Login
  await page.goto('/login');
  await fillLoginForm(page);
  
  // 2. Navigate to clients list
  await page.goto('/clients');
  
  // 3. Click on a client detail
  await page.click('text=John Doe');
  
  // 4. Verify on detail page
  await expect(page).toHaveURL(/\/clients\/[a-f0-9-]+$/);
  
  // 5. Click Edit button
  await page.click('button:has-text("Edit")');
  
  // 6. Verify route is /clients/:id/edit (NOT 404)
  await expect(page).toHaveURL(/\/clients\/[a-f0-9-]+\/edit$/);
  
  // 7. Verify form is populated with existing data
  const firstNameInput = page.locator('input[name="firstName"]');
  await expect(firstNameInput).toHaveValue('John');
  
  // 8. Update a field
  await firstNameInput.clear();
  await firstNameInput.fill('Jane');
  
  // 9. Submit form
  await page.click('button:has-text("Save")');
  
  // 10. Verify success toast and navigation
  await expect(page.locator('text=Client updated successfully')).toBeVisible();
  await expect(page).toHaveURL(/\/clients\/[a-f0-9-]+$/);
  
  // 11. Verify updated data is displayed
  await expect(page.locator('text=Jane')).toBeVisible();
});

test('should show 404 error page if client not found', async ({ page }) => {
  await page.goto('/clients/invalid-id/edit');
  await expect(page.locator('text=Not Found')).toBeVisible();
});
```

### 4.3 Manual Testing Checklist

- [ ] Server starts without errors: `npm run dev`
- [ ] Navigate to `/clients` and see client list
- [ ] Click a client card → goes to `/clients/:id`
- [ ] Click "Edit" button → goes to `/clients/:id/edit` (NOT 404)
- [ ] Form loads with pre-filled client data
- [ ] Edit a field (e.g., first name)
- [ ] Submit form → shows success toast
- [ ] Navigate back to detail page → displays updated data
- [ ] Invalid client ID `/clients/invalid/edit` → shows 404/error page
- [ ] Permission check: user without `clients:write` → cannot see Edit button

---

## 5. Implementation Checklist

### Prerequisites
- [ ] Verify `useClient()` hook exists and works
- [ ] Verify `useUpdateClient()` hook exists or create it
- [ ] Verify `ClientIntakeWorkflow` accepts props for edit mode
- [ ] Verify all required types are exported from `verticals/client-demographics/types`

### Core Implementation
- [ ] Create `ClientEditPage.tsx` component
- [ ] Create `mappers.ts` utility for data transformation
- [ ] Update `ClientIntakeWorkflow.tsx` to accept edit mode props
- [ ] Update `App.tsx` with new lazy import and route
- [ ] Update `pages/index.ts` with ClientEditPage export

### Testing
- [ ] Unit tests for ClientEditPage (min coverage: 80%)
- [ ] Integration tests for edit flow (E2E)
- [ ] Manual testing on local dev server
- [ ] Manual testing on preview/production environment
- [ ] Verify form validation still works in edit mode
- [ ] Verify permission checks work (clients:write required)

### Documentation
- [ ] Update README.md if needed (routes section)
- [ ] Update API documentation for PUT /clients/:id endpoint
- [ ] Add JSDoc comments to new functions
- [ ] Update DEVELOPMENT.md with edit workflow

### Deployment
- [ ] Merge to `develop` branch
- [ ] Run full test suite
- [ ] Deploy to preview environment
- [ ] QA approval
- [ ] Deploy to production

---

## 6. Code Diff Summary

### Files to Create
1. `packages/web/src/verticals/client-demographics/pages/ClientEditPage.tsx` (~80 lines)
2. `packages/web/src/verticals/client-demographics/utils/mappers.ts` (~100 lines)

### Files to Modify
1. `packages/web/src/App.tsx` (~15 lines added/modified)
   - Add lazy import of ClientEditPage
   - Add route for /clients/:id/edit
   - Reorder routes (edit before detail)
   
2. `packages/web/src/pages/clients/ClientIntakeWorkflow.tsx` (~50 lines modified)
   - Add optional props for edit mode
   - Conditional form submission (create vs update)
   - Pre-population logic

3. `packages/web/src/verticals/client-demographics/pages/index.ts` (1 line)
   - Export ClientEditPage

### Estimated Lines of Code
- **New Code**: ~180 lines
- **Modified Code**: ~65 lines
- **Total**: ~245 lines (small, focused change)

---

## 7. API Requirements

### Existing API Endpoint
The backend should already have a PUT endpoint for updating clients:

```
PUT /api/clients/:id
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  // ... other client fields
}

Response: 200 OK
{
  "id": "uuid",
  "firstName": "John",
  "lastName": "Doe",
  ...
}
```

**Verification**: Ensure backend API endpoint exists by:
```bash
curl -X GET http://localhost:3000/health | jq .
# Check API documentation at /api/docs or similar
```

---

## 8. Risk Assessment

### Low Risk
- ✅ Reusing existing, tested components (ClientIntakeWorkflow)
- ✅ No database schema changes needed
- ✅ Route ordering is well-documented in React Router best practices
- ✅ Similar patterns used in care-plans edit route

### Potential Issues & Mitigations

| Issue | Mitigation |
|-------|-----------|
| Data transformation bugs | Thorough unit tests on `mappers.ts`; test with real client data |
| Form validation fails in edit mode | Add `isEditMode` flag to validation logic; test both modes |
| Update API fails silently | Add error boundary and try-catch; log API errors |
| Route matching ambiguity | Place `/clients/:id/edit` before `/clients/:id` in route order |
| Permission bypass | Verify `permission="clients:write"` guard on route and form submission |

---

## 9. Success Criteria

✅ **Route is accessible**
- Navigating to `/clients/{id}/edit` does NOT return 404
- Route matches and displays the edit form

✅ **Form pre-populates**
- All client fields are loaded and displayed in the form
- User can see their existing data

✅ **Update works**
- Form submission sends PUT request to backend
- Backend returns 200 OK with updated client data
- Success toast notification displays

✅ **Navigation works**
- After successful update, user is redirected to `/clients/{id}`
- Detail page displays the updated data

✅ **Permissions enforced**
- Only users with `clients:write` permission see Edit button
- Attempting to access without permission shows 403/error

✅ **No regressions**
- Existing client list/detail views still work
- Other edit routes (care-plans, billing) still work
- No console errors or warnings

---

## 10. Related Ticket Links

- **Issue**: wdvf3abg48 - Clicking edit on a client card from /clients returns a 404
- **Related**: Care-plans edit implementation (for reference)
- **API Docs**: (link to backend API documentation)

---

## 11. Appendix: File References

### App.tsx Route Structure
- Line 54-56: Lazy loads (before AppRoutes function)
- Line 219-287: Client routes definition
- Line 481-489: Care-plans edit route (reference)

### ClientDetail.tsx
- Line 72: Edit button link to `/clients/{id}/edit`

### ClientIntakeWorkflow.tsx
- Line 1-150: Props and state initialization
- Line 600-800: Form submission logic (approx)

### Type Definitions
- `packages/web/src/verticals/client-demographics/types/index.ts`
- `packages/web/src/verticals/client-demographics/hooks/index.ts`

---

**Specification Version**: 1.0  
**Author**: AI Analyst  
**Date**: October 13, 2026  
**Status**: Ready for Development
