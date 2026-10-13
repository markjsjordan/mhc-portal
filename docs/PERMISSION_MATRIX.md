# Folk Care Role-Permission Matrix

## Client Operations Permissions

| Role | clients:read | clients:create | clients:update | clients:delete | clients:audit |
|------|:---:|:---:|:---:|:---:|:---:|
| **SUPER_ADMIN** | ✅ (*:*) | ✅ (*:*) | ✅ (*:*) | ✅ (*:*) | ✅ (*:*) |
| **ORG_ADMIN** | ✅ (clients:*) | ✅ (clients:*) | ✅ (clients:*) | ✅ (clients:*) | ✅ (clients:*) |
| **BRANCH_ADMIN** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **COORDINATOR** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **SCHEDULER** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **CAREGIVER** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **FAMILY** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **BILLING** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **HR** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **AUDITOR** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **READ_ONLY** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Full Permission Matrix by Role

### SUPER_ADMIN
- **Wildcard:** `*:*` (all access)
- **Explicit:** Everything

### ORG_ADMIN
- `clients:*` | `caregivers:*` | `staff:*` | `schedules:*` | `billing:*` | `reports:*` | `settings:*`
- `compliance:read` | `compliance:write` | `admin:access` | `admin:state-config` | `admin:data-access` | `admin:compliance` | `messages:*`

### BRANCH_ADMIN
- `clients:read` | `clients:update` | `clients:delete`
- `caregivers:*` | `staff:read` | `schedules:*`
- `reports:read` | `compliance:read` | `messages:*`

### COORDINATOR
- `clients:read` | `clients:update` | `clients:delete`
- `caregivers:read` | `schedules:*` | `visits:*` | `care-plans:*`
- `compliance:read` | `messages:*`

### SCHEDULER
- `clients:read` | `caregivers:read` | `schedules:*` | `visits:read`

### CAREGIVER
- `clients:read` | `schedules:read` | `visits:update` | `care-plans:read`
- `tasks:read` | `tasks:update` | `tasks:complete` | `notes:create`
- `messages:view` | `messages:send`

### FAMILY
- `clients:read` | `care-plans:read` | `notes:read` | `visits:read`
- `family-portal:view` | `family-portal:invite` | `activity-feed:view`
- `notifications:view` | `notifications:send` | `messages:view` | `messages:send` | `messages:create`

### BILLING
- `clients:read` | `visits:read` | `billing:*` | `invoices:*` | `reports:read`

### HR
- `staff:*` | `caregivers:*` | `training:*` | `certifications:*` | `payroll:*`

### AUDITOR
- `clients:read` | `caregivers:read` | `visits:read` | `compliance:read` | `audit-logs:read` | `reports:read`

### READ_ONLY
- `clients:read` | `reports:read`

---

## Key Findings for Ticket wdvf3abfwc

✅ **BRANCH_ADMIN** has `clients:delete` permission (line 66, permission-service.ts)  
✅ **COORDINATOR** has `clients:delete` permission (line 82, permission-service.ts)  
✅ Permission enforcement is active in `/verticals/client-demographics/src/service/client-service.ts` line 269  
✅ API endpoint `DELETE /api/clients/:id` is properly routed  

**Conclusion:** Both roles already have the required permission. No code changes needed.

---

**Source File:** `/packages/core/src/permissions/permission-service.ts`  
**Last Updated:** October 13, 2026
