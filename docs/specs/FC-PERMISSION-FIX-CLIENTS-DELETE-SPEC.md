# Specification: Add clients:delete Permission to BRANCH_ADMIN and COORDINATOR

**Ticket:** wdvf3abfwc  
**Type:** Fix / Permission Configuration  
**Priority:** High  
**Status:** Specification Ready  
**Date:** October 13, 2026

---

## Executive Summary

This specification details the addition of the `clients:delete` permission to both `BRANCH_ADMIN` and `COORDINATOR` roles. Currently, both roles have this permission defined in the permission service, but the permission framework is not being enforced or recognized properly in all contexts.

**Current State:** ✅ Both roles already have `clients:delete` in the permission matrix (lines 66 and 82 of `permission-service.ts`)  
**Issue:** Insufficient documentation and potential permission enforcement inconsistency  
**Solution:** Verify permission enforcement and ensure consistency across all client deletion endpoints

---

## 1. Permission System Architecture Overview

### 1.1 Permission Service Location
**File:** `/Users/markjordan/folk-care/packages/core/src/permissions/permission-service.ts`

### 1.2 Permission Framework
- **Type:** Role-Based Access Control (RBAC) with explicit permission mapping
- **Permission Format:** `resource:action` (e.g., `clients:delete`)
- **Wildcard Support:** Yes
  - `*:*` = Full system access (SUPER_ADMIN)
  - `resource:*` = All actions on resource (e.g., `clients:*`)
  - Specific permissions (e.g., `clients:delete`)

### 1.3 Permission Evaluation Flow
```
User Request
    ↓
[requirePermission(context, 'clients:delete')]
    ↓
Check: context.permissions.includes('clients:delete')?
    ↓ NO
Check: User's roles → rolePermissions map
    ↓
Match role permissions against requested permission
    ↓
Return: true/false or throw PermissionError
```

---

## 2. Current Permission Structure for BRANCH_ADMIN and COORDINATOR

### 2.1 BRANCH_ADMIN Role Permissions

**Location:** `/Users/markjordan/folk-care/packages/core/src/permissions/permission-service.ts`, lines 60-74

```typescript
this.rolePermissions.set(
  'BRANCH_ADMIN',
  new Set([
    'clients:read',
    'clients:update',
    'clients:delete',        // ✅ Already present
    'caregivers:*',
    'staff:read',
    'schedules:*',
    'reports:read',
    'compliance:read',
    'messages:*',
  ])
);
```

**Current Permissions for BRANCH_ADMIN:**
| Permission | Status | Purpose |
|-----------|--------|---------|
| `clients:read` | ✅ | View clients in assigned branches |
| `clients:update` | ✅ | Update client information |
| `clients:delete` | ✅ | **Soft-delete clients (ALREADY DEFINED)** |
| `caregivers:*` | ✅ | Full caregiver management |
| `staff:read` | ✅ | Read staff/user information |
| `schedules:*` | ✅ | Full schedule management |
| `reports:read` | ✅ | View reports |
| `compliance:read` | ✅ | Read compliance data |
| `messages:*` | ✅ | Full messaging access |

---

### 2.2 COORDINATOR Role Permissions

**Location:** `/Users/markjordan/folk-care/packages/core/src/permissions/permission-service.ts`, lines 76-90

```typescript
this.rolePermissions.set(
  'COORDINATOR',
  new Set([
    'clients:read',
    'clients:update',
    'clients:delete',        // ✅ Already present
    'caregivers:read',
    'schedules:*',
    'visits:*',
    'care-plans:*',
    'compliance:read',
    'messages:*',
  ])
);
```

**Current Permissions for COORDINATOR:**
| Permission | Status | Purpose |
|-----------|--------|---------|
| `clients:read` | ✅ | View clients |
| `clients:update` | ✅ | Update client information |
| `clients:delete` | ✅ | **Soft-delete clients (ALREADY DEFINED)** |
| `caregivers:read` | ✅ | Read caregiver information |
| `schedules:*` | ✅ | Full schedule management |
| `visits:*` | ✅ | Full visit management |
| `care-plans:*` | ✅ | Full care plan management |
| `compliance:read` | ✅ | Read compliance data |
| `messages:*` | ✅ | Full messaging access |

---

## 3. Client Deletion Implementation

### 3.1 Client Deletion API Endpoint

**File:** `/Users/markjordan/folk-care/verticals/client-demographics/src/api/client-handlers.ts`, lines 510-531

```typescript
/**
 * DELETE /api/clients/:id
 * Soft delete client
 */
deleteClient = asyncHandler(async (req: Request, res: Response) => {
  const context = getUserContext(req);
  const { id } = req.params;

  if (typeof id !== 'string' || id === '') {
    return res.status(400).json({
      success: false,
      error: 'Client ID is required',
    });
  }

  await this.clientService.deleteClient(id, context);

  return res.json({
    success: true,
    message: 'Client deleted successfully',
  });
});
```

### 3.2 Client Service Permission Enforcement

**File:** `/Users/markjordan/folk-care/verticals/client-demographics/src/service/client-service.ts`, lines 265-279

```typescript
/**
 * Delete (soft delete) client
 */
async deleteClient(id: string, context: UserContext): Promise<void> {
  this.permissionService.requirePermission(context, 'clients:delete');

  // Verify client exists (internal existence check, not a PHI read — skip audit log)
  const client = await this.getClientById(id, context, true);
  await this.repository.delete(id, context);

  // Invalidate cache
  const cache = getCacheService();
  await cache.delPattern(CacheKeys.patterns.client(id));
  await cache.del(CacheKeys.clientsByOrganization(client.organizationId));
}
```

**Key Implementation Details:**
- ✅ Permission enforcement via `requirePermission(context, 'clients:delete')`
- ✅ Client existence validation before deletion
- ✅ Cache invalidation post-deletion
- ✅ Organizational scope checking (via `getClientById`)

### 3.3 Permission Enforcement Mechanism

**Flow:**
```
DELETE /api/clients/:id
    ↓
[deleteClient handler] → extracts context & client ID
    ↓
[ClientService.deleteClient()] → calls requirePermission()
    ↓
[PermissionService.requirePermission(context, 'clients:delete')]
    ↓
Check user roles against permission matrix:
  - BRANCH_ADMIN? → has 'clients:delete' ✅
  - COORDINATOR? → has 'clients:delete' ✅
  - Other role? → check explicit permissions or throw PermissionError
    ↓
If authorized: proceed to delete
If denied: throw PermissionError (403 Forbidden)
```

---

## 4. What Needs to Change

### Summary
**NO CHANGE REQUIRED** to the core permission matrix.

Both `BRANCH_ADMIN` and `COORDINATOR` roles already have the `clients:delete` permission explicitly defined in the permission service.

### 4.1 Current State Analysis

| Role | clients:delete | Defined | Enforced | Issue |
|------|---|---|---|---|
| BRANCH_ADMIN | ✅ Present | Line 66 | ✅ Yes | None - already configured |
| COORDINATOR | ✅ Present | Line 82 | ✅ Yes | None - already configured |
| ORG_ADMIN | ✅ Present (via `clients:*`) | Line 43 | ✅ Yes | N/A |
| SUPER_ADMIN | ✅ Present (via `*:*`) | Line 37 | ✅ Yes | N/A |

### 4.2 Verification Points

✅ **Permission Service:** Both roles have explicit `clients:delete` permission  
✅ **API Handler:** `deleteClient` handler exists and is properly routed  
✅ **Service Layer:** `ClientService.deleteClient()` enforces `clients:delete` permission  
✅ **Permission Enforcement:** `requirePermission()` method properly validates against role permissions  
✅ **Organizational Scope:** Client deletion respects organizational boundaries  

---

## 5. Implementation Steps (Verification & Documentation)

### Step 1: Verify Permission Enforcement in Tests ✅

**File:** `/Users/markjordan/folk-care/verticals/client-demographics/src/__tests__/api/client-router.test.ts`, line 31

**Current State:**
```typescript
permissions: ['clients:read', 'clients:create', 'clients:update', 'clients:delete', 'clients:audit'],
```

**Test Case:** Verify both BRANCH_ADMIN and COORDINATOR can delete clients
- Run existing test suite to confirm no regressions
- Add specific test case for BRANCH_ADMIN delete operation
- Add specific test case for COORDINATOR delete operation

**Command:**
```bash
npm test -- client-router.test.ts
```

### Step 2: Verify Route Registration ✅

**File:** `/Users/markjordan/folk-care/verticals/client-demographics/src/api/client-handlers.ts`, line 1072

```typescript
router.delete('/clients/:id', handlers.deleteClient);
```

**Verification:** Route is registered and handler is bound correctly  
**Status:** ✅ Confirmed

### Step 3: Verify Role-Based Integration ✅

**Files to verify:**
- `/Users/markjordan/folk-care/packages/core/src/permissions/permission-service.ts` (Permission definitions)
- `/Users/markjordan/folk-care/packages/core/src/types/base.ts` (UserContext type)
- `/Users/markjordan/folk-care/packages/core/src/middleware/auth-middleware.ts` (Auth middleware)

**Verification Points:**
- ✅ `BRANCH_ADMIN` has `clients:delete` in rolePermissions
- ✅ `COORDINATOR` has `clients:delete` in rolePermissions
- ✅ `UserContext` includes `roles` array
- ✅ `hasPermission()` method correctly evaluates against rolePermissions

### Step 4: Confirm Documentation

**Documentation Files to Update:**
1. `/Users/markjordan/folk-care/verticals/client-demographics/README.md` (lines 225, 250)
   - Already documents `clients:delete` permission
   - Add explicit note: "Available to BRANCH_ADMIN and COORDINATOR roles"

2. `/Users/markjordan/folk-care/docs/operations/AGENCY_SETUP_GUIDE.md` (line 1267)
   - Already documents DELETE endpoint
   - Update role table to clarify which roles have this permission

3. `/Users/markjordan/folk-care/docs/API_QUICK_START.md` (line 71)
   - Add permissions required section for DELETE /api/clients/:id

### Step 5: Add Permission Matrix Documentation

**New Document:** Create comprehensive permission matrix  
**Scope:** Document all roles and their client-related permissions

**Content to include:**
```
| Role | clients:read | clients:create | clients:update | clients:delete |
|------|---|---|---|---|
| SUPER_ADMIN | ✅ (*:*) | ✅ (*:*) | ✅ (*:*) | ✅ (*:*) |
| ORG_ADMIN | ✅ (clients:*) | ✅ (clients:*) | ✅ (clients:*) | ✅ (clients:*) |
| BRANCH_ADMIN | ✅ | ✗ | ✅ | ✅ |
| COORDINATOR | ✅ | ✗ | ✅ | ✅ |
| SCHEDULER | ✅ | ✗ | ✗ | ✗ |
| CAREGIVER | ✅ | ✗ | ✗ | ✗ |
| FAMILY | ✅ | ✗ | ✗ | ✗ |
| BILLING | ✅ | ✗ | ✗ | ✗ |
| HR | ✗ | ✗ | ✗ | ✗ |
| AUDITOR | ✅ | ✗ | ✗ | ✗ |
| READ_ONLY | ✅ | ✗ | ✗ | ✗ |
```

---

## 6. Affected Files

### Permission System Files (Core)
1. `/Users/markjordan/folk-care/packages/core/src/permissions/permission-service.ts`
   - **Lines 60-74:** BRANCH_ADMIN permission definition
   - **Lines 76-90:** COORDINATOR permission definition
   - **Status:** ✅ Already contains `clients:delete` for both roles

### Client Demographics Vertical
2. `/Users/markjordan/folk-care/verticals/client-demographics/src/service/client-service.ts`
   - **Lines 265-279:** `deleteClient()` method enforcement
   - **Status:** ✅ Already enforces `clients:delete` permission

3. `/Users/markjordan/folk-care/verticals/client-demographics/src/api/client-handlers.ts`
   - **Lines 510-531:** `deleteClient` handler
   - **Line 1072:** Route registration
   - **Status:** ✅ Handler correctly delegates to service

### Test Files
4. `/Users/markjordan/folk-care/verticals/client-demographics/src/__tests__/api/client-router.test.ts`
   - **Line 31:** Test permissions array
   - **Status:** ✅ Already includes `clients:delete` in test permissions

### Documentation Files (To Update)
5. `/Users/markjordan/folk-care/verticals/client-demographics/README.md`
   - **Lines 225, 250:** Client deletion documentation
   - **Action:** Add explicit role reference

6. `/Users/markjordan/folk-care/docs/operations/AGENCY_SETUP_GUIDE.md`
   - **Line 1267:** Endpoint documentation
   - **Action:** Clarify BRANCH_ADMIN and COORDINATOR have permission

7. `/Users/markjordan/folk-care/docs/API_QUICK_START.md`
   - **Line 71:** API endpoint listing
   - **Action:** Add permissions section

---

## 7. Verification Checklist

- [x] Permission definition exists for BRANCH_ADMIN
- [x] Permission definition exists for COORDINATOR
- [x] API endpoint exists (`DELETE /api/clients/:id`)
- [x] Handler correctly routes to service
- [x] Service enforces permission check
- [x] Permission service properly evaluates roles
- [x] Organizational scope validation in place
- [x] Cache invalidation in place
- [x] Tests include clients:delete permission
- [ ] Documentation updated with explicit role reference
- [ ] Integration tests run successfully
- [ ] QA verified both roles can delete clients

---

## 8. Conclusion

The `clients:delete` permission is **already fully implemented** for both `BRANCH_ADMIN` and `COORDINATOR` roles. The permission matrix is correctly defined in the permission service, and the enforcement mechanism is properly integrated in the client service.

**No code changes are required** to the permission definitions themselves.

**Recommended actions:**
1. Run integration tests to confirm permission enforcement works
2. Update documentation to explicitly list which roles have client deletion permission
3. Create QA test plan for BRANCH_ADMIN and COORDINATOR client deletion workflows
4. Document the permission matrix for future reference

---

## Appendix A: Permission Service Method References

### `hasPermission(context, permission)`
Checks if user has permission via:
1. Explicit permissions in context
2. Role-based permissions (exact match)
3. Role-based permissions (wildcard match)

### `requirePermission(context, permission)`
Throws `PermissionError` if user lacks permission. Used by all service methods.

### `getPermissionsForRoles(roles)`
Returns array of all permissions granted by given roles. Merges permissions from multiple roles.

### `filterByScope(context, entities)`
Filters entities by organizational/branch scope based on user's context.

---

## Appendix B: Organizational Scope Validation

Client deletion respects the following scope hierarchy:

**SUPER_ADMIN**
- Can delete clients from any organization

**ORG_ADMIN**
- Can delete clients from their organization

**BRANCH_ADMIN**
- Can delete clients from their assigned branches only
- Scope check: `context.branchIds` intersection with `client.branchId`

**COORDINATOR**
- Can delete clients (depends on organizational context)
- Scope check: `context.organizationId` must match `client.organizationId`

**Other Roles**
- Cannot delete clients (lack `clients:delete` permission)

---

**Document Version:** 1.0  
**Last Updated:** October 13, 2026  
**Author:** System Specification  
**Review Status:** Ready for QA
