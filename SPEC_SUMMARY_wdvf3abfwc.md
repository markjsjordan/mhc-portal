# Summary: clients:delete Permission Specification (wdvf3abfwc)

## Key Finding: Permission Already Defined ✅

Both `BRANCH_ADMIN` and `COORDINATOR` **already have** the `clients:delete` permission.

---

## What Was Found

### 1. Permission Definitions ✅
**File:** `/packages/core/src/permissions/permission-service.ts`

- **BRANCH_ADMIN (line 66):** Explicitly includes `'clients:delete'`
- **COORDINATOR (line 82):** Explicitly includes `'clients:delete'`

### 2. Enforcement Implementation ✅
**Files:**
- `/verticals/client-demographics/src/service/client-service.ts` (line 269): Calls `requirePermission(context, 'clients:delete')`
- `/verticals/client-demographics/src/api/client-handlers.ts` (lines 514-531): Handler routes to service
- `/verticals/client-demographics/src/__tests__/api/client-router.test.ts` (line 31): Tests include `clients:delete`

### 3. API Endpoint ✅
- **Route:** `DELETE /api/clients/:id`
- **Handler:** Properly delegates to `ClientService.deleteClient()`
- **Permission Check:** Enforced at service layer
- **Scope:** Respects organizational/branch boundaries

---

## Why This Ticket Might Exist

**Possible scenarios:**
1. Permission was recently added and needs QA verification
2. Documentation doesn't clearly state BRANCH_ADMIN/COORDINATOR have this permission
3. Permission enforcement inconsistency in another part of the codebase
4. Need to document the permission matrix comprehensively

---

## What Needs to Happen

### No Code Changes Required

The permission matrix is already correct. Implementation is complete.

### Actions Needed:
1. **Documentation Update:**
   - Add explicit reference to roles in API docs
   - Create/update permission matrix
   
2. **QA Verification:**
   - Test BRANCH_ADMIN can delete client
   - Test COORDINATOR can delete client
   - Test non-authorized roles cannot delete

3. **Documentation Locations to Update:**
   - `/docs/operations/AGENCY_SETUP_GUIDE.md` - clarify roles
   - `/docs/API_QUICK_START.md` - add permissions section
   - `/verticals/client-demographics/README.md` - add role reference

---

## Affected Files

| File | Lines | Status | Change |
|------|-------|--------|--------|
| `packages/core/src/permissions/permission-service.ts` | 60-90 | ✅ Correct | None needed |
| `verticals/client-demographics/src/service/client-service.ts` | 265-279 | ✅ Correct | None needed |
| `verticals/client-demographics/src/api/client-handlers.ts` | 514-531 | ✅ Correct | None needed |
| `verticals/client-demographics/README.md` | 225, 250 | ⚠️ Incomplete | Add role clarification |
| `docs/operations/AGENCY_SETUP_GUIDE.md` | 1267 | ⚠️ Incomplete | Add permission table |
| `docs/API_QUICK_START.md` | 71 | ⚠️ Incomplete | Add permissions section |

---

## Full Specification

**See:** `/docs/specs/FC-PERMISSION-FIX-CLIENTS-DELETE-SPEC.md`

Contains:
- Complete permission matrix for all roles
- Enforcement flow diagrams
- Organizational scope details
- Verification checklist
- Implementation steps (mostly documentation)

---

## Recommendation

**Status:** Ready for QA  
**Code Changes:** None (already implemented)  
**Documentation:** Update reference materials to be explicit about BRANCH_ADMIN/COORDINATOR permissions  
**Testing:** Verify both roles can successfully delete clients
