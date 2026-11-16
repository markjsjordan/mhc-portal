# QA Test Plan - wdvf3abhb7: Client Creation 400 Fix

**Ticket**: wdvf3abhb7  
**Branch**: fix/wdvf3abhb7-client-creation-400  
**Commit**: f7245af3  
**Test Date**: 2026-10-13  
**Tester**: QA Subagent  

---

## Phase 1: Frontend Defensive Validation Guards

### Test 1.1: Org with Zero Existing Clients - Clear Error Message
**Scenario**: User tries to create a client when organization has no existing clients (no fallback branchId)

**Expected Behavior**:
- Frontend detects `existingClients?.items?.[0]?.branchId` is undefined
- Shows user-facing toast error message (NOT generic 400 response)
- Message: "Unable to submit: this organization has no existing clients with branch information. Please contact your administrator..."
- Error duration: 8000ms
- Form submission is blocked before any API call

**Verification Points**:
- [ ] No POST to /api/clients occurs
- [ ] Toast error is visible to user
- [ ] Error message is clear and actionable
- [ ] Form remains editable (user not stuck)

---

### Test 1.2: Org with Existing Clients - Client Creation Succeeds
**Scenario**: User creates a client when organization has at least one existing client with valid branchId

**Expected Behavior**:
- Frontend retrieves `existingClients?.items?.[0]?.branchId` successfully
- Frontend validates branchId is a non-empty string
- CreateClientInput is built with valid fallback branchId
- POST /api/clients succeeds with 201 response
- Success toast shown
- Navigation to new client detail page

**Verification Points**:
- [ ] POST /api/clients completes successfully
- [ ] Response status is 201 (not 400)
- [ ] Client is created with correct branchId
- [ ] Success toast message displayed

---

### Test 1.3: Undefined BranchId Never Reaches POST API
**Scenario**: Code path prevents undefined branchId from being sent to backend

**Expected Behavior**:
- Two guards in place:
  1. Check if `fallbackBranchId` exists (early guard)
  2. Check if `fallbackBranchId` is a non-empty string (type guard)
- If either guard fails, form submission blocked with error toast
- branchId never reaches API if undefined/null/empty

**Verification Points**:
- [ ] Guard #1 blocks submission if `!fallbackBranchId`
- [ ] Guard #2 blocks submission if `typeof fallbackBranchId !== 'string' || fallbackBranchId.length === 0`
- [ ] Both guards appear in both `handleSubmit` block and create-mode block
- [ ] Guards appear BEFORE CreateClientInput is built

---

## Phase 2: Backend Enhanced Validation Error Messages

### Test 2.1: Validation Errors Show Context/Guidance (Not Generic 400)
**Scenario**: Backend validation fails (e.g., invalid UUID, missing field) and should return contextual error

**Expected Behavior**:
- ClientValidator.validateCreateInput() catches Zod errors
- Enhanced error mapping transforms generic messages to user-facing guidance
- Special handling for branchId errors:
  - Path: "branchId"
  - Message: "Branch ID is required. Organization must have at least one existing client or branch."
- Other critical fields get specific guidance:
  - organizationId: "Organization ID is required and must be a valid UUID."
  - firstName/lastName: "[Field] is required (max 100 characters)."
  - primaryAddress: "Address field is invalid: [details]. Ensure all required address fields..."
- Errors structure: `{ success: false, errors: [ { path: string, message: string } ] }`

**Verification Points**:
- [ ] Errors return 400 (bad request) not 500 (server error)
- [ ] Error response has `success: false`
- [ ] Errors array contains path + message pairs
- [ ] Error messages are contextual (not generic Zod messages)
- [ ] Unknown validation errors have production-safe message

---

## Phase 3: Form Submission Flow

### Test 3.1: Full End-to-End Form Submission
**Scenario**: User completes entire client intake form and submits

**Prerequisites**:
- Organization has at least one existing client
- User is authenticated
- All required fields filled (firstName, lastName, dateOfBirth, address)
- All consent checkboxes checked
- Signature provided

**Expected Flow**:
1. User clicks "Submit" button
2. Frontend validation runs (early guards):
   - firstName required ✓
   - lastName required ✓
   - dateOfBirth required ✓
   - address complete (line1, city, state) ✓
3. Frontend creates validation runs:
   - organizationId exists ✓
   - fallbackBranchId exists ✓
   - fallbackBranchId is non-empty string ✓
   - Consents all complete ✓
   - Signature provided ✓
4. CreateClientInput built with fallback branchId
5. POST /api/clients sent with valid payload
6. Backend validation runs (ClientValidator.validateCreateInput)
7. Client created (201 response)
8. Success toast shown: "Client intake submitted..."
9. Navigation to /clients/{newClient.id}

**Verification Points**:
- [ ] All frontend guards pass
- [ ] API request is sent with complete payload
- [ ] Response is 201 (not 400, not 500)
- [ ] Client record created in database
- [ ] Navigation succeeds
- [ ] No console errors

---

## Phase 4: Regression Testing

### Test 4.1: Edit Mode (Existing Client Update) - No Regression
**Scenario**: User edits an existing client (no branchId required in edit mode)

**Expected Behavior**:
- Edit mode skips branchId requirement (see code: `if (!isEditMode) { ... branch check ... }`)
- Only common required fields validated
- PATCH /api/clients/{id} sent with UpdateClientInput
- Client updated successfully
- No 400 errors related to branchId

**Verification Points**:
- [ ] Edit mode form loads with client data
- [ ] No branchId guards triggered in edit mode
- [ ] PATCH request succeeds
- [ ] Client fields updated correctly

---

### Test 4.2: Existing Create Flow (With Actual Branch Data) - No Regression
**Scenario**: Fallback branchId is used successfully to create client

**Expected Behavior**:
- useClients hook retrieves existing clients
- First client's branchId extracted
- Used as fallbackBranchId
- Client creation succeeds with valid branchId
- No difference in behavior from before fix (just with guards)

**Verification Points**:
- [ ] useClients call succeeds
- [ ] Existing client data has valid branchId
- [ ] Fallback branchId passed to CreateClientInput
- [ ] Client created successfully

---

## Code Inspection Verification

### Test C.1: Phase 1 Frontend Guards Present
**Check**: Both guards appear in code at correct locations

**File**: `packages/web/src/pages/clients/ClientIntakeWorkflow.tsx`
- [ ] Guard #1 at line ~292: `if (!fallbackBranchId) { toast.error('Unable to submit: this organization has no existing clients...') }`
- [ ] Guard #2 at line ~301: `if (typeof fallbackBranchId !== 'string' || fallbackBranchId.length === 0) { toast.error('Unable to submit: invalid branch ID found...') }`
- [ ] Both guards appear in create-mode block
- [ ] Guards appear BEFORE CreateClientInput object built
- [ ] Early guards also present for firstName, lastName, dateOfBirth, address (lines ~257-273)

---

### Test C.2: Phase 2 Backend Validation Enhancement Present
**Check**: Enhanced error mapping in validator

**File**: `verticals/client-demographics/src/validation/client-validator.ts`
- [ ] ClientValidator.validateCreateInput() has enhanced error mapping
- [ ] branchId error gets special message
- [ ] organizationId error gets guidance message
- [ ] firstName/lastName get guidance message
- [ ] primaryAddress gets detailed error message
- [ ] Unknown errors get production-safe message
- [ ] Error structure is `{ path: string, message: string }`

---

## Test Execution Summary

| Test Case | Status | Evidence |
|-----------|--------|----------|
| 1.1: Zero existing clients → clear error | PENDING | Run form test |
| 1.2: Existing clients → success | PENDING | Run form test |
| 1.3: Undefined branchId never reaches API | PENDING | Network inspection |
| 2.1: Validation errors are contextual | PENDING | Error response inspection |
| 3.1: End-to-end form submission | PENDING | Full workflow test |
| 4.1: Edit mode no regression | PENDING | Edit form test |
| 4.2: Existing create flow still works | PENDING | Create with fallback test |
| C.1: Frontend guards present | PENDING | Code inspection |
| C.2: Backend validation enhanced | PENDING | Code inspection |

---

## Pass Criteria

**PASS if ALL tests show PASS**:
1. ✅ Zero-client error message is clear (not 400 response)
2. ✅ Multi-client create succeeds
3. ✅ Undefined branchId never sent to API
4. ✅ Validation errors have context/guidance
5. ✅ Full form submission works end-to-end
6. ✅ Edit mode works without regression
7. ✅ Existing create flows unaffected
8. ✅ All code guards present and correct

**Status**: If ALL pass → "qa passed" in ClickUp

---
