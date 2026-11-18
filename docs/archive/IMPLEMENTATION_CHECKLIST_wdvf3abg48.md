# Implementation Checklist: Client Edit Route Fix

**Ticket**: wdvf3abg48  
**Issue**: Clicking edit on a client card from /clients returns a 404  
**Assignee**: [Development Team]  
**Target Completion**: [Date TBD]

---

## Pre-Implementation

- [ ] Read and understand `TECHNICAL_SPEC_wdvf3abg48.md`
- [ ] Read `ROOT_CAUSE_ANALYSIS_wdvf3abg48.md` for context
- [ ] Verify dev environment is set up: `npm run dev`
- [ ] Verify API health check: `curl http://localhost:3000/health`
- [ ] Create feature branch from `develop`: `git checkout -b feat/client-edit-route`

---

## Step 1: Create ClientEditPage Component

**File**: `packages/web/src/verticals/client-demographics/pages/ClientEditPage.tsx`

```tsx
[ ] Create new file
[ ] Import React, hooks, types
[ ] Implement component that:
    [ ] Gets :id from useParams
    [ ] Uses useClient(id) to fetch data
    [ ] Shows LoadingSpinner while loading
    [ ] Shows ErrorMessage if error or not found
    [ ] Pre-populates ClientIntakeWorkflow with client data
    [ ] Handles form submission (isEditMode=true)
    [ ] Navigates to /clients/:id on success
    [ ] Shows success toast: "Client updated successfully"
    [ ] Shows error toast on failure with error message
[ ] Add proper TypeScript types
[ ] Add JSDoc comments
[ ] Export from component index (see Step 5)
```

**Template Code Structure**:
```tsx
export const ClientEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading, error } = useClient(id);
  
  if (isLoading) return <LoadingSpinner />;
  if (error || !client) return <ErrorMessage />;
  
  const handleSuccess = (updatedClient: Client) => {
    toast.success('Client updated successfully');
    navigate(`/clients/${updatedClient.id}`);
  };
  
  return (
    <ClientIntakeWorkflow 
      initialData={mapClientToIntakeData(client)}
      isEditMode={true}
      onSuccess={handleSuccess}
    />
  );
};
```

---

## Step 2: Create Data Mapper Utility

**File**: `packages/web/src/verticals/client-demographics/utils/mappers.ts`

```typescript
[ ] Create new utils directory if doesn't exist
[ ] Create new file mappers.ts
[ ] Implement mapClientToIntakeData() function:
    [ ] Maps client.firstName → intakeData.firstName
    [ ] Maps client.dateOfBirth to YYYY-MM-DD format
    [ ] Maps client.primaryPhone.number → intakeData.phone
    [ ] Maps client.primaryAddress → intakeData.address
    [ ] Maps client.emergencyContacts → intakeData.emergencyContacts
    [ ] Handles null/undefined values with empty strings
    [ ] Handles nested objects properly
    [ ] Returns complete IntakeData object
[ ] Add JSDoc comments explaining parameter mapping
[ ] Export function
[ ] Add unit tests:
    [ ] Test with complete client object
    [ ] Test with partial client object (missing optionals)
    [ ] Test with null/undefined values
    [ ] Test phone number formatting
    [ ] Test address mapping
```

**Mapper Function Signature**:
```typescript
export function mapClientToIntakeData(client: Client): IntakeData {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    middleName: client.middleName ?? '',
    preferredName: client.preferredName ?? '',
    dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth).toISOString().split('T')[0] : '',
    gender: client.gender ?? '',
    
    address: {
      line1: client.primaryAddress?.line1 ?? '',
      line2: client.primaryAddress?.line2 ?? '',
      city: client.primaryAddress?.city ?? '',
      state: client.primaryAddress?.state ?? '',
      postalCode: client.primaryAddress?.postalCode ?? '',
    },
    
    phone: client.primaryPhone?.number ?? '',
    email: client.email ?? '',
    
    // Continue for all IntakeData fields
    // See ClientIntakeWorkflow.tsx for full IntakeData structure
  };
}
```

---

## Step 3: Update ClientIntakeWorkflow Component

**File**: `packages/web/src/pages/clients/ClientIntakeWorkflow.tsx`

```typescript
[ ] Add new props interface:
    [ ] isEditMode?: boolean (default: false)
    [ ] initialData?: IntakeData (optional pre-filled data)
    [ ] onSuccess?: (client: Client) => void (custom success callback)

[ ] In component initialization:
    [ ] If initialData provided, set form fields from it
    [ ] Store isEditMode in state or prop

[ ] In form submission logic:
    [ ] If isEditMode is true:
        [ ] Call useUpdateClient() instead of useCreateClient()
        [ ] Pass id and form data to updateClient mutation
        [ ] Use PUT request (already handled by hook)
    [ ] If isEditMode is false (default):
        [ ] Call useCreateClient() (existing behavior)
        [ ] Use POST request (existing behavior)

[ ] In success handler:
    [ ] If onSuccess callback provided, call it with updated client
    [ ] Else use existing navigation logic to /clients

[ ] Update validation:
    [ ] Ensure validation works in both create and edit modes
    [ ] Test that required fields are still validated in edit mode

[ ] Test modifications:
    [ ] Run existing tests (should still pass)
    [ ] Add tests for edit mode path
    [ ] Test with initialData prop
    [ ] Test form pre-population
```

**Modified Props**:
```typescript
interface ClientIntakeWorkflowProps {
  initialData?: IntakeData;
  isEditMode?: boolean;
  onSuccess?: (client: Client) => void;
}

const ClientIntakeWorkflow: React.FC<ClientIntakeWorkflowProps> = ({
  initialData,
  isEditMode = false,
  onSuccess,
}) => {
  // ... component implementation
  
  const handleSubmit = async (data: IntakeData) => {
    try {
      if (isEditMode && clientId) {
        const result = await updateClient.mutateAsync({ id: clientId, data });
        if (onSuccess) onSuccess(result);
      } else {
        const result = await createClient.mutateAsync(data);
        // existing success handling
      }
    } catch (error) {
      // error handling
    }
  };
};
```

---

## Step 4: Update App.tsx Routes

**File**: `packages/web/src/App.tsx`

### 4a: Add Lazy Import (line ~54-57)

```typescript
[ ] Find the lazy load section for vertical pages
[ ] Add new lazy load after ClientDetail:

const ClientEditPage = React.lazy(() => 
  import('./verticals/client-demographics/pages/ClientEditPage')
    .then((m) => ({ default: m.ClientEditPage }))
);
```

### 4b: Add/Reorder Client Routes (lines 218-287)

**CRITICAL**: Place `/clients/:id/edit` BEFORE `/clients/:id`

```typescript
[ ] Locate current client routes section
[ ] Find /clients/:id route (currently at line 260)
[ ] INSERT NEW ROUTE BEFORE IT:

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

[ ] Verify /clients/:id route comes AFTER /clients/:id/edit
[ ] Verify other client routes not affected:
    [ ] /clients (list)
    [ ] /clients/intake
    [ ] /clients/dashboard
    [ ] /clients/new/intake
    [ ] /clients/:clientId/medications
    [ ] /clients/:id (detail - AFTER edit!)

[ ] Verify permission="clients:write" on edit route (users must have write permission)
```

**Correct Route Order** (after changes):
```tsx
<Route path="/clients" ... />                    // List
<Route path="/clients/intake" ... />             // Create
<Route path="/clients/dashboard" ... />          // Dashboard
<Route path="/clients/new/intake" ... />         // Create (alt)
<Route path="/clients/:id/edit" ... />           // ← EDIT (MUST BE BEFORE)
<Route path="/clients/:id" ... />                // ← DETAIL (MUST BE AFTER)
<Route path="/clients/:clientId/medications" /> // Medications
```

---

## Step 5: Update Component Exports

**File**: `packages/web/src/verticals/client-demographics/pages/index.ts`

```typescript
[ ] Open index.ts file
[ ] Add new export:

export { ClientEditPage } from './ClientEditPage';

[ ] Verify all exports are correct:
    [ ] ClientList
    [ ] ClientDetail
    [ ] ClientDashboard
    [ ] ClientEditPage (new)
```

---

## Step 6: Local Testing

### 6a: Start Dev Server

```bash
[ ] Kill any existing dev server: killall npm
[ ] Start dev server: npm run dev
[ ] Wait 45+ seconds for full startup
[ ] Verify server is listening: curl http://localhost:5173/
[ ] Verify API is healthy: curl http://localhost:3000/health
```

### 6b: Manual Test Flow

```bash
[ ] Navigate to http://localhost:5173/clients
    [ ] Should see client list

[ ] Click on a client card
    [ ] Should navigate to http://localhost:5173/clients/{id}
    [ ] Should see client detail view

[ ] Click "Edit" button
    [ ] Should navigate to http://localhost:5173/clients/{id}/edit
    [ ] Should NOT see 404 error
    [ ] Should see form loaded

[ ] Verify form pre-population
    [ ] First name should match client
    [ ] Last name should match client
    [ ] Email should match client
    [ ] Phone should match client
    [ ] Address should match client
    [ ] All other fields should be pre-populated

[ ] Edit a field (e.g., change first name)
    [ ] Change visible in form

[ ] Submit form
    [ ] Should see loading spinner
    [ ] Should see success toast: "Client updated successfully"
    [ ] Should navigate back to detail page

[ ] Verify updated data
    [ ] Detail page should show updated values
    [ ] Updated field should match what was entered

[ ] Refresh page
    [ ] Data should persist in database
    [ ] Verify with API call: curl http://localhost:3000/api/clients/{id}
```

### 6c: Edge Cases to Test

```bash
[ ] Invalid client ID
    [ ] Navigate to http://localhost:5173/clients/invalid-id/edit
    [ ] Should show error message (not 404 page)

[ ] Missing permissions
    [ ] Create user without clients:write permission
    [ ] Edit button should not be visible on detail page
    [ ] Direct URL access should show error/403

[ ] Form validation
    [ ] Try to submit without required fields
    [ ] Should show validation errors
    [ ] Form should not submit

[ ] Network error
    [ ] Mock failed API response
    [ ] Should show error toast
    [ ] Should stay on edit page (not navigate away)

[ ] Cancel/Back
    [ ] Click back button
    [ ] Should navigate to /clients/{id} (detail page)
    [ ] Should NOT save changes
```

---

## Step 7: Run Test Suite

```bash
[ ] Run unit tests:
    npm run test:unit
    [ ] All tests pass
    [ ] No new warnings

[ ] Run integration tests:
    npm run test:integration
    [ ] All tests pass
    [ ] ClientEditPage tests included

[ ] Run E2E tests:
    npm run test:e2e
    [ ] All tests pass
    [ ] New client edit flow test passes
    [ ] Existing tests still pass (no regressions)

[ ] Check code coverage:
    [ ] ClientEditPage: >80% coverage
    [ ] mappers.ts: >80% coverage
    [ ] No coverage regression
```

---

## Step 8: Code Quality

```bash
[ ] Run linter:
    npm run lint
    [ ] No errors
    [ ] No warnings (unless pre-existing)
    [ ] Auto-fix if needed: npm run lint:fix

[ ] Run type check:
    npm run type-check
    [ ] No TypeScript errors
    [ ] All types properly defined

[ ] Run formatter:
    npm run format
    [ ] Code formatted consistently
    [ ] No formatting changes after commit

[ ] Code review:
    [ ] Get peer review on changes
    [ ] Review ClientEditPage implementation
    [ ] Review mapper function
    [ ] Review route ordering
    [ ] Address review comments
```

---

## Step 9: Git Commit

```bash
[ ] Stage changes:
    git add packages/web/src/verticals/client-demographics/pages/ClientEditPage.tsx
    git add packages/web/src/verticals/client-demographics/utils/mappers.ts
    git add packages/web/src/pages/clients/ClientIntakeWorkflow.tsx
    git add packages/web/src/App.tsx
    git add packages/web/src/verticals/client-demographics/pages/index.ts

[ ] Commit with descriptive message:
    git commit -m "feat(clients): add edit route and page for existing clients
    
    - Add GET /clients/:id/edit route to App.tsx
    - Create ClientEditPage component to handle client editing
    - Create mappers.ts utility to transform Client to IntakeData
    - Update ClientIntakeWorkflow to support edit mode
    - Reorder routes: /clients/:id/edit before /clients/:id for proper matching
    
    Fixes: wdvf3abg48"

[ ] Verify commit:
    git log --oneline -5
```

---

## Step 10: Push and Create PR

```bash
[ ] Push feature branch:
    git push origin feat/client-edit-route

[ ] Create Pull Request:
    [ ] Title: "Fix: Client edit route 404 error (wdvf3abg48)"
    [ ] Description: Include ticket number and brief summary
    [ ] Link to this spec document
    [ ] Mention all modified files
    [ ] Set reviewers
    [ ] Set labels: bug, high-priority, clients

[ ] Wait for CI/CD:
    [ ] GitHub Actions tests pass
    [ ] Coverage checks pass
    [ ] Lint checks pass
    [ ] Build succeeds
```

---

## Step 11: Code Review

```bash
[ ] Request review from team leads
[ ] Address reviewer comments
[ ] Make requested changes
[ ] Push updates: git push origin feat/client-edit-route
[ ] Get approval from at least 2 reviewers
```

---

## Step 12: Preview Deployment

```bash
[ ] Merge to develop branch
[ ] Verify preview deployment builds:
    [ ] Check Vercel/Netlify deployment logs
    [ ] Deployment successful (not failed)

[ ] Test on preview environment:
    [ ] Navigate to preview URL
    [ ] Repeat manual test flow from Step 6b
    [ ] Verify everything works on preview
    [ ] Test with different browsers (Chrome, Firefox, Safari)
    [ ] Test on mobile device
```

---

## Step 13: QA Testing

```bash
[ ] QA team receives preview URL
[ ] QA performs full testing:
    [ ] Test happy path (complete edit flow)
    [ ] Test error cases (invalid ID, network error)
    [ ] Test edge cases (special characters, long names)
    [ ] Test permissions (users with/without write access)
    [ ] Test on different devices/browsers
    [ ] Verify no regressions in other features

[ ] QA approval:
    [ ] Issues resolved: 0
    [ ] Warnings: 0
    [ ] Ready for production: ✅
```

---

## Step 14: Production Deployment

```bash
[ ] Merge to main/production branch
[ ] Verify production deployment:
    [ ] Check deployment logs
    [ ] Build succeeds
    [ ] All services up

[ ] Smoke test on production:
    [ ] Navigate to /clients
    [ ] Click client card
    [ ] Click Edit
    [ ] Verify URL is /clients/{id}/edit (NOT 404)
    [ ] Verify form works
    [ ] Submit change
    [ ] Verify update succeeded

[ ] Monitor for errors:
    [ ] Check error logs (Sentry, DataDog, etc.)
    [ ] Check performance metrics
    [ ] Check user reports
```

---

## Step 15: Post-Deployment

```bash
[ ] Close ticket:
    [ ] Mark as Done/Completed
    [ ] Link to merged PR
    [ ] Note production deployment date

[ ] Update documentation:
    [ ] README.md (if needed)
    [ ] API docs (if needed)
    [ ] Dev wiki/guide

[ ] Communicate change:
    [ ] Post in team Slack
    [ ] Update status in project management tool
    [ ] Email stakeholders if needed

[ ] Monitor for issues:
    [ ] Watch for user reports
    [ ] Check logs for errors
    [ ] Be ready to rollback if issues found
```

---

## Troubleshooting

### Issue: Route returns 404
**Solution**: Verify `/clients/:id/edit` route is BEFORE `/clients/:id` in route order

### Issue: Form doesn't pre-populate
**Solution**: Check mapClientToIntakeData() function, verify all fields are mapped correctly

### Issue: Update fails silently
**Solution**: Check useUpdateClient() hook, verify API endpoint works with curl

### Issue: TypeScript errors
**Solution**: Verify all imports, check type definitions match expected interfaces

### Issue: Tests fail
**Solution**: Verify test setup, check mock data, ensure all dependencies mocked properly

### Issue: Rollback needed
**Solution**:
```bash
git revert <commit-hash>
git push origin main
# Redeploy from main branch
```

---

## Success Confirmation

When complete, you should be able to:

✅ Navigate to `/clients`  
✅ Click on any client to go to `/clients/{id}`  
✅ Click "Edit" button  
✅ Go to `/clients/{id}/edit` (NOT 404)  
✅ See form pre-populated with client data  
✅ Edit any field  
✅ Submit the form  
✅ See success toast  
✅ Return to detail page with updated data  

If all above work → **Feature is complete and working!** 🎉

---

## Related Documents

- `TECHNICAL_SPEC_wdvf3abg48.md` - Full implementation spec
- `ROOT_CAUSE_ANALYSIS_wdvf3abg48.md` - Root cause details
- `IMPLEMENTATION_SUMMARY_wdvf3abg48.md` - Executive summary

---

**Checklist Version**: 1.0  
**Created**: October 13, 2026  
**Status**: Ready for Implementation

Last Updated: October 13, 2026
