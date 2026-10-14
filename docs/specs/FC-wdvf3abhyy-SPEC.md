# FC-wdvf3abhyy Technical Specification
## Settings Profile - User Info Prefilled if Available

**Status:** Implementation Complete (Verified as FC-wdvf3abhy)  
**Ticket ID:** wdvf3abhyy  
**Branch:** `fix/wdvf3abhy-settings-profile`  
**Last Commit:** 42d535bd — feat(wdvf3abhy): Settings Profile - Auto-prefill user info from database  
**Date:** October 13, 2026  

---

## Summary

This specification documents the completed Settings Profile feature (wdvf3abhy) that automatically prefills user information from the database when users access their settings page. The feature includes comprehensive client-side validation, optimistic locking for concurrent edit conflict detection, and an intuitive conflict resolution UI. **This ticket (wdvf3abhyy) is a duplicate of FC-wdvf3abhy and references the completed implementation.**

---

## Acceptance Criteria (All Met ✓)

### AC1: Auto-Population of Form Fields
**✓ COMPLETE**
- Form fields (firstName, lastName, email, phone) automatically populate from GET `/api/users/profile` response on component mount
- Data flows through `useUserProfile` hook → `ProfileForm` component default values
- Loading state displays spinner while fetching profile data

### AC2: All Fields Editable Without Unlock
**✓ COMPLETE**
- All form fields are editable without requiring unlock button
- Zod schema validation enforces constraints without freezing input
- Fields: firstName, lastName, email (required); phone (optional)
- Form uses `react-hook-form` with `onBlur` validation mode

### AC3: Save Button Calls PUT Endpoint with Modified Fields
**✓ COMPLETE**
- Save button submits only modified fields to `PUT /api/users/profile`
- Form tracks dirty state via `react-hook-form`'s `isDirty` property
- Save button disabled when form is clean or updating
- Optimistic version field included in request for conflict detection

### AC4: Email Uniqueness Enforced per Organization
**✓ COMPLETE**
- Backend validates email uniqueness within organization scope
- Query: `SELECT id FROM users WHERE email = $1 AND organization_id = $2 AND id != $3`
- Returns 400 error with `EMAIL_IN_USE` code if duplicate detected
- Email change warning displayed on frontend: "We'll send a verification link to your new email address"

### AC5: Concurrent Edits Detected via Optimistic Locking
**✓ COMPLETE**
- Optimistic locking implemented via `version` field in request/response
- Backend compares request version with current DB version
- Version conflict returns 409 status with `VERSION_CONFLICT` code
- Current values returned in 409 response for UI conflict resolution
- Hook configured to NOT retry on version conflicts

### AC6: Conflict UI with Refresh Option on Version Mismatch
**✓ COMPLETE**
- `ConflictDialog` component displays when version conflict detected (409 response)
- Dialog shows:
  - Current values (latest from server)
  - User's pending changes
  - Three resolution actions:
    1. "Use Current Values" — Reload form with server values, discards user changes
    2. "Keep My Changes" — Retry submission with latest version from conflict response
    3. "Cancel" — Close dialog, preserve form state for manual merge
- Warning icon and clear messaging about the conflict scenario

### AC7: Cancel Button with Confirmation for Unsaved Changes
**✓ COMPLETE**
- Cancel button resets form to last synced state
- Unsaved changes confirmation triggered if form is dirty:
  - Browser `beforeunload` event: "Do you want to leave? Changes you made may not be saved."
  - Manual cancel button: `window.confirm('Discard unsaved changes?')`
- Confirmation only shown when `isDirty === true`
- Cancel disabled during update operations

---

## Architecture & Design

### Data Flow

```
User visits Settings → ProfileForm mounts
         ↓
useUserProfile.fetchProfile() triggers
         ↓
GET /api/users/profile (auth required)
         ↓
Profile data + version returned
         ↓
Form default values set, UI renders with data
         ↓
User edits fields (form state dirty)
         ↓
User clicks Save → Form validation (Zod)
         ↓
PUT /api/users/profile + version
         ↓
Server: Check version match?
  ├─ Match? → Update + version++, return 200 + new data
  └─ Mismatch? → Return 409 + current server values
         ↓
Hook onSuccess: Update cache, set syncedAt timestamp
Hook on 409: Show ConflictDialog
         ↓
User resolves: Replace (use server), Keep (retry with new version), or Cancel
```

### Frontend Architecture

#### `useUserProfile` Hook
**Location:** `packages/web/src/hooks/useUserProfile.ts`

**Responsibilities:**
- Fetch user profile via `GET /api/users/profile`
- Manage update mutations via `PUT /api/users/profile`
- Cache management via React Query
- Sync timestamp tracking
- Conflict detection (no retry on VERSION_CONFLICT)

**Key Exports:**
```typescript
useUserProfile(): {
  // Fetch state
  profile: UserProfile | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  
  // Update state
  updateProfile: (data: UpdateProfileRequest) => void
  updateAsync: (data: UpdateProfileRequest) => Promise<UpdateProfileResponse>
  isUpdating: boolean
  updateError: Error | null
  updateSuccess: boolean
}

useProfileSyncedAt(): Date | null
formatSyncedTime(syncedAt: Date | null): string
```

**Configuration:**
- Query staleTime: 0 (always fresh on mount)
- Retry strategy: 3 attempts with exponential backoff (max 30s)
- Mutation retry: Skip VERSION_CONFLICT, max 3 for other errors

#### `ProfileForm` Component
**Location:** `packages/web/src/components/forms/ProfileForm.tsx`

**Props:**
```typescript
interface ProfileFormProps {
  profile: UserProfile | undefined
  isLoading: boolean
  isUpdating: boolean
  updateError: Error | null
  onSubmit: (data: ProfileFormData & { version?: number }) => void
  onCancel?: () => void
  onVersionConflict?: (current: any) => void
}
```

**Features:**
- Zod-based client-side validation
- Real-time field error display (onBlur validation)
- Auto-populate on profile data load
- Unsaved changes tracking + confirmation
- Version conflict resolution UI
- Last synced timestamp display
- Field-level validation rules (name format, email format, phone format)

**Validation Schema:**
```typescript
{
  firstName: string (1-100 chars, letters/spaces/hyphens/apostrophes only)
  lastName: string (1-100 chars, letters/spaces/hyphens/apostrophes only)
  email: string (required, valid email format)
  phone: string (0-20 chars, optional, digits/spaces/hyphens/parens)
}
```

**UI States:**
1. Loading: Spinner while fetching profile
2. Error (non-conflict): Red alert box with error message
3. Success (synced): Green checkmark, "Profile synced successfully"
4. Form dirty: Save button enabled, unsaved changes protection active
5. Updating: Buttons disabled, "Saving..." text on submit button
6. Conflict: Modal overlay with resolution options

#### `ConflictDialog` Component
**Embedded in ProfileForm**

**Behavior:**
- Modal overlay blocking form interaction
- Side-by-side comparison of current values vs. user changes
- Three action buttons with clear semantics
- Cancel closes dialog without modifying form state

### Backend Architecture

#### GET /api/users/profile (Enhanced)
**Location:** `packages/app/src/routes/users.ts`

**Request:**
- Method: GET
- Auth: Bearer token required
- Body: None

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null",
    "organizationId": "uuid",
    "roles": ["string"],
    "version": "number",
    "updatedAt": "ISO8601 timestamp",
    "updatedBy": "uuid"
  }
}
```

**Database Query:**
```sql
SELECT * FROM users 
WHERE id = $1 AND deleted_at IS NULL
```

**Returns:**
- All user fields including phone, version, updatedAt, updatedBy
- 404 if user not found (deleted)
- 401 if not authenticated

#### PUT /api/users/profile (Enhanced with Optimistic Locking)
**Location:** `packages/app/src/routes/users.ts`

**Request:**
```json
{
  "firstName": "string (1-100)",
  "lastName": "string (1-100)",
  "email": "string (valid email)",
  "phone": "string | null (0-20 chars, optional)",
  "version": "number (optional, for conflict detection)"
}
```

**Validation:**
- firstName: Required, 1-100 chars
- lastName: Required, 1-100 chars
- email: Required, valid email format
- phone: Optional, max 20 chars
- version: Optional, must be integer ≥ 0

**Business Logic:**
1. Validate input against Zod schema
2. Check email uniqueness within organization:
   ```sql
   SELECT id FROM users 
   WHERE email = $1 AND organization_id = $2 AND id != $3 AND deleted_at IS NULL
   ```
3. Fetch current user version (optimistic locking check)
4. If version provided in request:
   - Compare with current DB version
   - If mismatch: Return 409 Conflict with current values
5. If match or no version provided:
   - Update all fields
   - Increment version: `version = version + 1`
   - Set updatedAt to NOW()
   - Set updatedBy to current user ID
   - Return 200 with updated profile + timestamp

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null",
    "organizationId": "uuid",
    "version": "number (incremented)",
    "updatedAt": "ISO8601 timestamp",
    "updatedBy": "uuid"
  },
  "timestamp": "ISO8601 timestamp"
}
```

**Response (409 Conflict):**
```json
{
  "success": false,
  "error": "Profile was modified by another user. Please refresh and try again.",
  "code": "VERSION_CONFLICT",
  "current": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null",
    "version": "number",
    "updatedAt": "ISO8601 timestamp",
    "updatedBy": "uuid"
  }
}
```

**Response (400 Bad Request) — Email In Use:**
```json
{
  "success": false,
  "error": "Email is already in use",
  "code": "EMAIL_IN_USE",
  "field": "email"
}
```

**Response (400 Bad Request) — Validation Error:**
```json
{
  "success": false,
  "error": "<field-specific error message>",
  "code": "VALIDATION_ERROR"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND"
}
```

**Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": "Failed to update profile",
  "code": "UPDATE_FAILED"
}
```

---

## Database Schema

### users table (Enhanced)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  version INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_email_per_org UNIQUE (email, organization_id) 
    WHERE deleted_at IS NULL
);

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email_org ON users(email, organization_id) 
  WHERE deleted_at IS NULL;
```

**Key Fields:**
- `version`: Optimistic locking; incremented on each update
- `updated_at`: Server-side timestamp of last modification
- `updated_by`: User ID who made the last change (for audit trail)
- `deleted_at`: Soft delete marker

---

## Testing

### Test Coverage
- **50+ comprehensive tests** across hook, component, and backend routes
- GET endpoint: Authentication, field validation, deleted user handling
- PUT endpoint: Validation, email uniqueness, version conflicts, edge cases
- Hook: Profile fetch, mutations, conflict handling, async/await
- Component: Rendering, validation feedback, error states, conflict UI

### Test Files
1. **Hook Tests:** `packages/web/src/hooks/__tests__/useUserProfile.test.ts`
   - Profile fetch on mount
   - All fields returned
   - Error handling
   - Profile updates
   - Version conflict detection
   - Refetch capability
   - No retry on VERSION_CONFLICT
   - Phone field as optional
   - Async/await support

2. **Component Tests:** `packages/web/src/components/forms/__tests__/ProfileForm.test.tsx`
   - Form rendering with profile data
   - Field validation and error display
   - Save button disabled when clean
   - Unsaved changes confirmation
   - Conflict dialog display and resolution
   - Email change warning
   - Loading and success states

### Test Patterns
- Vitest + React Testing Library
- Mock API responses
- React Query QueryClient isolation per test
- UserEvent for realistic interactions
- Assertion on both state and DOM

---

## Integration Points

### 1. Authentication
- All endpoints require Bearer token auth
- `AuthMiddleware.requireAuth` enforces authentication
- User context available in request: `req.user!.userId`, `req.user!.organizationId`

### 2. Email Verification
- Email change triggers verification flow (frontend displays info message)
- Separate email verification endpoint/flow (not in this spec)
- User sees: "We'll send a verification link to your new email address"

### 3. Organization Scoping
- Email uniqueness scoped to organization via `organization_id`
- Multi-tenant isolation enforced in queries

### 4. Audit Trail
- `updated_by` field records which user made changes
- `updated_at` tracks when changes occurred
- Version history implicit via version increment

---

## Error Handling & Edge Cases

### Handled Scenarios
1. **Network Failure During Fetch:**
   - Exponential backoff retry (3 attempts, max 30s delay)
   - Error state displayed to user
   - Refetch available

2. **Validation Errors:**
   - Client-side: Real-time feedback via Zod schema
   - Server-side: Field-level messages in 400 response
   - UI displays first error message to user

3. **Email Already In Use:**
   - Backend returns 400 with `EMAIL_IN_USE` code
   - Frontend displays error message
   - Form state preserved for correction

4. **Concurrent Edit (Version Conflict):**
   - Server detects version mismatch (409)
   - Current values included in response
   - User chooses: Use current values, keep my changes, or cancel
   - "Keep my changes" retries with updated version

5. **User Deleted Between Fetch and Update:**
   - GET returns 404 if user.deleted_at IS NOT NULL
   - PUT returns 404 if user not found
   - User redirected or error displayed

6. **Stale Browser Session:**
   - If token expired, 401 on any endpoint
   - App handles redirect to login (out of scope for this spec)

7. **Unsaved Changes Navigation:**
   - Browser beforeunload event prevents accidental loss
   - Cancel button shows confirmation dialog
   - Form state reset only after confirmation

### Not Handled (Out of Scope)
- Email verification flow (separate spec)
- Password change in profile form
- Role or organization changes
- Bulk user updates
- Soft delete recovery

---

## Performance Considerations

### Query Optimization
- **GET /profile:** Single-row fetch by user ID (indexed)
- **Email check:** Index on (email, organization_id) where deleted_at IS NULL
- **Version increment:** Atomic operation in UPDATE statement

### Frontend Optimization
- React Query caching prevents unnecessary refetches
- `staleTime: 0` ensures fresh data on mount (acceptable given small user object)
- Form validation debounced via onBlur mode
- Conflict dialog lazy-loaded in component (no separate network call)

### Network
- Minimal payload: Profile object (~200 bytes)
- Two HTTP calls max (fetch + update)
- No polling or subscriptions

---

## Security Considerations

### Input Validation
- Zod schema enforces type and length constraints
- Email format validated on client and server
- Name format restricted to letters, spaces, hyphens, apostrophes (prevent injection)
- Phone format restricted to digits, spaces, hyphens, parentheses

### Authorization
- All endpoints require authentication
- Users can only update their own profile (`req.user!.userId`)
- Organization isolation ensures users cannot modify peers' email uniqueness

### Data Protection
- Version field prevents blind overwrites (optimistic locking)
- Soft deletes preserve audit trail (`deleted_at` IS NULL checks)
- `updated_by` tracks who made changes

### No XSS Risks
- Form data rendered as input values (not HTML)
- Error messages from server displayed in div (not dangerouslySetInnerHTML)
- Zod schema prevents invalid data persistence

---

## Deployment Notes

### Database Migrations
Required fields must exist in `users` table:
- `phone` (VARCHAR 20, nullable)
- `version` (INTEGER, default 0)
- `updated_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
- `updated_by` (UUID, nullable)
- Unique index on (email, organization_id) where deleted_at IS NULL

### Feature Flags
- No feature flags required
- Endpoint is live once backend is deployed

### Rollback Plan
1. Revert to previous backend version (before this commit)
2. Version field becomes read-only on frontend (if still in old frontend)
3. No data corruption risk (version field is additive)

### Monitoring
- Monitor 409 Conflict response rate (indicates concurrent edit activity)
- Monitor PUT endpoint latency (database update performance)
- Log `updated_by` changes for audit trail verification

---

## Files Modified/Created

### Frontend
- `packages/web/src/hooks/useUserProfile.ts` — Custom hook (NEW)
- `packages/web/src/hooks/__tests__/useUserProfile.test.ts` — Tests (NEW)
- `packages/web/src/components/forms/ProfileForm.tsx` — Form component (NEW)
- `packages/web/src/components/forms/__tests__/ProfileForm.test.tsx` — Tests (NEW)

### Backend
- `packages/app/src/routes/users.ts` — Enhanced GET/PUT /api/users/profile (MODIFIED)

### Database
- Migration: Add phone, version, updated_at, updated_by to users table (if not already present)

---

## Acceptance & Sign-Off

### Criteria Summary
| Criterion | Status | Evidence |
|-----------|--------|----------|
| AC1: Auto-populate form fields | ✓ Complete | useUserProfile fetches on mount, ProfileForm uses data as defaults |
| AC2: Editable without unlock | ✓ Complete | All fields use standard input with no disabled state by default |
| AC3: Save calls PUT with modified fields | ✓ Complete | handleFormSubmit sends UpdateProfileRequest to PUT /api/users/profile |
| AC4: Email uniqueness per org | ✓ Complete | Backend query scoped to organization_id, 400 error on duplicate |
| AC5: Concurrent edits detected | ✓ Complete | Version field in request/response, 409 on mismatch, no retry |
| AC6: Conflict UI with options | ✓ Complete | ConflictDialog shows current values, user changes, 3 resolution actions |
| AC7: Cancel with confirmation | ✓ Complete | beforeunload event + window.confirm on manual cancel, triggered on isDirty |

### QA Test Cases
1. ✓ User visits settings → profile auto-populated from database
2. ✓ Edit fields → validation errors displayed in real-time
3. ✓ Save changes → PUT request sent with modified data
4. ✓ Email change → verification message displayed
5. ✓ Another user edits concurrently → 409 conflict with resolution UI
6. ✓ Choose "Use Current Values" → form reloads with server data
7. ✓ Choose "Keep My Changes" → retry with updated version succeeds
8. ✓ Edit then navigate away → beforeunload confirmation appears
9. ✓ Click Cancel → form resets, "Discard unsaved changes?" shown if dirty
10. ✓ Email already in use → 400 error, email field highlighted

---

## Related Documentation

- **API Spec:** OpenAPI routes in `packages/app/src/routes/users.ts` (documented with @openapi tags)
- **Component Storybook:** ProfileForm component (if Storybook is configured)
- **Database Schema:** `packages/app/src/db/schema.sql` (users table definition)

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-13 | 1.0 | Mark Jordan | Initial comprehensive spec from FC-wdvf3abhy implementation |

---

## Appendix: Duplicate Ticket Note

**Ticket wdvf3abhyy appears to be a duplicate of FC-wdvf3abhy.**

Both tickets describe the same feature:
- Settings Profile with user info prefilled from database
- Auto-population on page load
- Optimistic locking for concurrent edit conflict detection
- Conflict resolution UI

**Resolution:** This specification documents the completed implementation from the `fix/wdvf3abhy-settings-profile` branch (commit 42d535bd). No additional work required for wdvf3abhyy beyond referencing this spec and the existing FC-wdvf3abhy implementation.

If wdvf3abhyy is intended to track a different feature or enhancement, please clarify in the ticket description and create a new branch.
