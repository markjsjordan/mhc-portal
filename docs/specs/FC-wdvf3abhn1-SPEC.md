# Technical Specification: Caregiver Detail Page Actions
## Ticket: wdvf3abhn1

**Status:** Ready for Implementation  
**Effort Estimate:** 8-12 story points (1-2 weeks)  
**Risk Level:** Low-Medium (requires permission checks, audit logging)

---

## 1. Problem Statement

The Caregiver detail page in the Folk Care MHC Portal **lacks action buttons** for common administrative operations. Administrators must use workarounds (admin dashboard, bulk operations, or database access) to:

- **Edit** caregiver information
- **Delete/Deactivate** caregivers
- **Duplicate** a caregiver record (for creating similar profiles)

**Current User Workflow:**
```
View Caregiver Details
  ↓
Cannot edit from detail page
  ↓
Must navigate back to list → find edit button
  ↓ OR use admin console
Must use bulk operations
  ↓ OR Database direct access (high risk)
```

**Business Impact:**
- **Inefficient workflows:** 3-4 extra clicks per operation
- **Risk of accidental deletions:** No confirmation dialogs
- **Lost productivity:** Managers waste 2-3 minutes per caregiver edit
- **Data quality issues:** Duplicates not managed well
- **Compliance gap:** No audit trail for who deleted what caregiver

---

## 2. Current State Analysis

### 2.1 Caregiver Detail Page Location
**File:** Likely in `/packages/web/src/app/pages/admin/` or `/packages/web/src/components/caregivers/`

**Search Results:**
```
/packages/web/src/app/pages/caregiver/components/ClientContactCard.tsx
/packages/web/src/components/caregivers/BurnoutDashboard.tsx
/packages/web/src/app/pages/CaregiverDashboard.tsx
```

### 2.2 Database Caregiver Schema
**File:** `/packages/core/migrations/20251030214713_create_caregivers_table.ts`

**Key Fields:**
- `id` (UUID primary key)
- `status` (ACTIVE, INACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RETIRED)
- `employment_status` (ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RETIRED)
- `deleted_at` (soft delete timestamp)
- `deleted_by` (user who deleted)
- `updated_at`, `updated_by` (audit trail)
- `version` (optimistic locking)

**Audit Trail Support:** ✅ Already has `deleted_at`, `deleted_by`, `updated_at`, `updated_by`

### 2.3 Existing Admin Operations
**File:** `/packages/web/src/app/pages/admin/BulkDataHub.tsx`

**Bulk Import:** ✅ Exists  
**Bulk Export:** ✅ Exists  
**Individual CRUD:** ❌ Missing from detail page

### 2.4 Backend API Status
**Expected endpoints (verify existence):**
- `GET /api/caregivers/:id` - Read (likely exists)
- `PATCH /api/caregivers/:id` - Update (likely exists)
- `DELETE /api/caregivers/:id` - Delete (may not exist)
- `POST /api/caregivers/:id/duplicate` - Duplicate (likely doesn't exist)

---

## 3. Desired State Description

### 3.1 Visual Design: Detail Page Action Bar

```
┌─────────────────────────────────────────────────────────┐
│  ← Back   Sarah M. (EMP-2024-001)      [⋮ More] [Edit] [Delete] │
│           Senior Caregiver, RN                                     │
│           Branch: Main Office | Status: ACTIVE                    │
└─────────────────────────────────────────────────────────┘

Tabs: [Overview] [Schedule] [Credentials] [Performance]
```

### 3.2 Action Button Placement

**Primary Actions (top-right):**
1. **[Edit]** - Opens edit modal or form
2. **[Delete]** - Deactivate/soft delete with confirmation
3. **[⋮ More]** - Dropdown menu for additional actions

**More Menu Options:**
- Duplicate Caregiver
- View Audit History
- Download Profile (PDF)
- Suspend / Resume
- Send Message
- Export to CSV

### 3.3 Edit Modal

```
┌──────────────────────────────────────────┐
│ Edit Caregiver: Sarah M.                 │
├──────────────────────────────────────────┤
│                                          │
│ Personal Information                     │
│  First Name: Sarah           *           │
│  Last Name: Martinez         *           │
│  Email: sarah@example.com    *           │
│  Phone: (555) 123-4567       *           │
│                                          │
│ Employment Details                       │
│  Employee #: EMP-2024-001    *           │
│  Status: ACTIVE ▼                        │
│  Employment Type: Full-Time  ▼ *         │
│  Role: Senior Caregiver      ▼ *         │
│  Hire Date: 2024-01-15       *           │
│                                          │
│ Skills & Certifications                  │
│  [+ Add Certification]                   │
│  ☑ RN (Registered Nurse)                 │
│    Expires: 2025-12-31                   │
│                                          │
├──────────────────────────────────────────┤
│ [Cancel]                      [Save Changes] │
└──────────────────────────────────────────┘
```

### 3.4 Delete Confirmation Dialog

```
┌──────────────────────────────────────────┐
│ ⚠️  Delete Caregiver?                    │
├──────────────────────────────────────────┤
│                                          │
│ You are about to delete:                 │
│ Sarah M. (EMP-2024-001)                  │
│ Senior Caregiver, Branch: Main Office    │
│                                          │
│ This action:                             │
│ • Soft-deletes the record (recoverable)  │
│ • Removes from active caregiver list     │
│ • Cannot unassign from future visits     │
│ • Is logged for audit compliance         │
│                                          │
│ To confirm, type the name:               │
│ [Sarah M.                    ]           │
│                                          │
│ ☐ I understand this action is permanent │
│   (within the context of data retention) │
│                                          │
├──────────────────────────────────────────┤
│ [Cancel]                   [Delete Caregiver] │
└──────────────────────────────────────────┘
```

### 3.5 Duplicate Caregiver Modal

```
┌──────────────────────────────────────────┐
│ Duplicate Caregiver                      │
├──────────────────────────────────────────┤
│                                          │
│ Creating a copy of: Sarah M.             │
│ (Original: EMP-2024-001)                 │
│                                          │
│ New Employee #:  [EMP-2024-___] *        │
│ New First Name:  [Sarah            ] *   │
│ New Last Name:   [Martinez-Copy    ] *   │
│ New Email:       [sarah.copy@...] *      │
│                                          │
│ Fields to copy:                          │
│ ☑ Skills & Certifications                │
│ ☑ Work Preferences                       │
│ ☑ Availability Pattern                   │
│ ☐ Employment History                     │
│ ☐ Performance Reviews                    │
│ ☐ Background Check Results               │
│                                          │
│ New Status:      PENDING_ONBOARDING ▼    │
│                                          │
├──────────────────────────────────────────┤
│ [Cancel]              [Create Duplicate] │
└──────────────────────────────────────────┘
```

### 3.6 Status Transition Logic

**Current Status → Allowed Transitions:**
- `ACTIVE` → Edit, Suspend (→ ON_LEAVE), Deactivate (→ INACTIVE), Delete
- `INACTIVE` → Edit, Reactivate (→ ACTIVE), Delete
- `ON_LEAVE` → Edit, Resume (→ ACTIVE), Delete
- `SUSPENDED` → Edit, Resume (→ ACTIVE), Delete
- `TERMINATED` → View only (limited edit), Cannot reassign

---

## 4. Acceptance Criteria

### 4.1 Edit Action
- [ ] Edit button visible and clickable on caregiver detail page
- [ ] Edit modal opens with all editable caregiver fields pre-populated
- [ ] Form validation matches caregiver creation form
- [ ] Save changes updates caregiver record in database
- [ ] Optimistic locking prevents conflicts (version check)
- [ ] Audit log records who edited what fields and when
- [ ] Disabled fields show reason (e.g., "locked due to pending verification")
- [ ] Success notification displays "Caregiver updated successfully"
- [ ] Error handling shows field-level validation errors

### 4.2 Delete Action
- [ ] Delete button visible and enabled only for non-terminated caregivers
- [ ] Delete confirmation dialog shows caregiver details
- [ ] Dialog requires name confirmation (type caregiver name)
- [ ] Dialog requires checkbox confirmation ("I understand...")
- [ ] Delete button disabled until both confirmations checked
- [ ] On confirm, soft deletes record (sets deleted_at, deleted_by)
- [ ] Deleted caregiver removed from active lists immediately
- [ ] Audit log records deletion with timestamp and user ID
- [ ] Toast notification shows "Caregiver deleted successfully"
- [ ] Page redirects to caregiver list after deletion
- [ ] Deleted caregiver still visible in admin console with "DELETED" badge

### 4.3 Duplicate Action
- [ ] Duplicate button visible in "More" dropdown menu
- [ ] Duplicate modal shows source caregiver name
- [ ] New employee # field is auto-populated with suggestion
- [ ] Duplicate modal lists all copyable fields with checkboxes
- [ ] On confirm, creates new caregiver with:
  - Unique employee number
  - New email address
  - Status = PENDING_ONBOARDING
  - Selected fields copied from source
  - Audit log shows "Duplicated from: EMP-XXXX"
- [ ] Success notification shows link to new caregiver profile
- [ ] New caregiver redirects on "Create Duplicate" click

### 4.4 Permissions & Authorization
- [ ] Edit action requires CAREGIVER_WRITE permission
- [ ] Delete action requires CAREGIVER_DELETE permission
- [ ] Duplicate action requires CAREGIVER_CREATE permission
- [ ] Non-authorized users see disabled/hidden buttons
- [ ] Toast shows "Insufficient permissions" if unauthorized attempt
- [ ] All operations logged with user ID for compliance

### 4.5 State Management
- [ ] Edit modal state persists on cancel (not lost)
- [ ] Unsaved changes warning before closing modal
- [ ] Loading state shows spinner during save
- [ ] Disable all buttons during API call (prevent double-submit)
- [ ] URL doesn't change during edit (stay on same page)

### 4.6 Accessibility
- [ ] All buttons have proper ARIA labels
- [ ] Modal has focus trap (Tab doesn't escape)
- [ ] Confirmation dialog announces warning to screen readers
- [ ] Required fields marked with `*` and associated `<label>`
- [ ] Error messages linked to form fields
- [ ] Keyboard shortcuts (Escape to close, Enter to save)

### 4.7 Mobile Responsiveness
- [ ] Action buttons stack vertically on mobile (< 768px)
- [ ] Modal renders full-width on mobile
- [ ] Confirmation dialog is readable on small screens
- [ ] Form inputs are touch-friendly (min 44px height)
- [ ] Dropdown menu doesn't overflow viewport

---

## 5. Implementation Approach

### 5.1 Architecture Overview

**Component Hierarchy:**
```
CaregiverDetailPage
  ├── CaregiverHeader
  │   └── CaregiverActionButtons
  │       ├── EditButton → EditCaregiverModal
  │       ├── DeleteButton → DeleteConfirmationDialog
  │       └── MoreMenu
  │           ├── Duplicate → DuplicateCaregiverModal
  │           ├── Audit History
  │           └── ...
  └── CaregiverDetailTabs
      ├── Overview
      ├── Schedule
      ├── Credentials
      └── Performance
```

### 5.2 Files to Create/Modify

#### New Files

1. **`/packages/web/src/components/caregivers/CaregiverActionButtons.tsx`** (150-200 lines)
```typescript
interface CaregiverActionButtonsProps {
  caregiverId: string;
  status: CaregiverStatus;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isLoading?: boolean;
}

export const CaregiverActionButtons: React.FC<CaregiverActionButtonsProps> = ({
  caregiverId,
  status,
  onEdit,
  onDelete,
  onDuplicate,
  isLoading = false,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { user } = useAuth();

  const canEdit = user?.permissions?.includes('CAREGIVER_WRITE');
  const canDelete = user?.permissions?.includes('CAREGIVER_DELETE');
  const canDuplicate = user?.permissions?.includes('CAREGIVER_CREATE');

  const isDeletable = status !== 'TERMINATED';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onEdit}
        disabled={!canEdit || isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? <Spinner /> : <>✏️ Edit</>}
      </button>

      <button
        onClick={onDelete}
        disabled={!canDelete || !isDeletable || isLoading}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
      >
        Delete
      </button>

      <MoreMenu
        isOpen={isMoreOpen}
        onOpenChange={setIsMoreOpen}
        onDuplicate={canDuplicate ? onDuplicate : undefined}
      />
    </div>
  );
};
```

2. **`/packages/web/src/components/caregivers/EditCaregiverModal.tsx`** (300-400 lines)
   - Reuse CaregiverForm component from create flow
   - Pre-populate with existing data
   - Handle PUT/PATCH request to `/api/caregivers/:id`
   - Show optimistic locking error if version mismatch

3. **`/packages/web/src/components/caregivers/DeleteConfirmationDialog.tsx`** (200-250 lines)
   - Show caregiver details
   - Require name confirmation input
   - Require checkbox confirmation
   - Handle DELETE request
   - Redirect on success

4. **`/packages/web/src/components/caregivers/DuplicateCaregiverModal.tsx`** (250-300 lines)
   - Form with new employee #, name, email
   - Checkboxes for field selection
   - Handle POST request to `/api/caregivers/:id/duplicate`
   - Redirect to new caregiver on success

5. **`/packages/web/src/components/caregivers/CaregiverMoreMenu.tsx`** (150-200 lines)
   - Dropdown menu with additional actions
   - Icons from lucide-react
   - Permission-based visibility

6. **`/packages/web/src/types/caregiver.ts`** (100-150 lines)
   - `CaregiverStatus` enum
   - `CaregiverFormData` interface
   - `CaregiverDuplicateOptions` interface

#### Modified Files

1. **`/packages/web/src/app/pages/admin/CaregiverDetailPage.tsx`** (or equivalent)
   - Import CaregiverActionButtons
   - Add state for modal visibility
   - Wire up action handlers
   - Add EditCaregiverModal, DeleteConfirmationDialog, DuplicateCaregiverModal

2. **`/packages/app/src/routes/caregivers.ts`** (Backend API)
   - Add `PATCH /caregivers/:id` endpoint (if missing)
   - Add `DELETE /caregivers/:id` endpoint
   - Add `POST /caregivers/:id/duplicate` endpoint
   - Add permission checks
   - Add audit logging

3. **`/packages/core/migrations/` (Optional)**
   - If audit table doesn't exist, create one (likely already exists)

### 5.3 API Endpoint Implementation

#### PATCH /api/caregivers/:id (Update)

**Request:**
```json
{
  "first_name": "Sarah",
  "last_name": "Martinez",
  "email": "sarah@example.com",
  "phone": "+15551234567",
  "employment_type": "FULL_TIME",
  "role": "SENIOR_CAREGIVER",
  "status": "ACTIVE",
  "version": 3  // Optimistic locking
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "first_name": "Sarah",
  "last_name": "Martinez",
  "email": "sarah@example.com",
  "status": "ACTIVE",
  "version": 4,
  "updated_at": "2024-10-13T14:30:00Z",
  "updated_by": "admin-user-id"
}
```

**Error (409 Conflict - Version Mismatch):**
```json
{
  "error": "OPTIMISTIC_LOCK_FAILURE",
  "message": "Record was modified. Please refresh and try again.",
  "current_version": 4,
  "your_version": 3
}
```

#### DELETE /api/caregivers/:id (Soft Delete)

**Request:**
```json
{
  "confirmName": "Sarah M."  // User-entered confirmation
}
```

**Response (204 No Content):**
```
Status: 204
```

**Error (422 Unprocessable Entity):**
```json
{
  "error": "INVALID_STATUS_TRANSITION",
  "message": "Cannot delete terminated caregiver"
}
```

#### POST /api/caregivers/:id/duplicate (Clone)

**Request:**
```json
{
  "new_employee_number": "EMP-2024-999",
  "new_first_name": "Sarah",
  "new_last_name": "Martinez-Copy",
  "new_email": "sarah.copy@example.com",
  "copy_fields": {
    "skills": true,
    "certifications": true,
    "work_preferences": true,
    "availability": false,
    "employment_history": false
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid-new",
  "employee_number": "EMP-2024-999",
  "first_name": "Sarah",
  "last_name": "Martinez-Copy",
  "email": "sarah.copy@example.com",
  "status": "PENDING_ONBOARDING",
  "created_at": "2024-10-13T14:35:00Z",
  "duplicated_from": "uuid-source"
}
```

### 5.4 Backend Implementation (Express.js)

**File:** `/packages/app/src/routes/caregivers.ts`

```typescript
// PATCH /caregivers/:id
router.patch('/:id', async (req, res) => {
  const caregiverId = req.params.id;
  const userId = req.user.id;
  const updates = req.body;
  const currentVersion = req.body.version;

  // Permission check
  if (!req.user.permissions?.includes('CAREGIVER_WRITE')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    // Get current record
    const caregiver = await db('caregivers')
      .where('id', caregiverId)
      .where('deleted_at', null)
      .first();

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    // Optimistic locking: Check version
    if (caregiver.version !== currentVersion) {
      return res.status(409).json({
        error: 'OPTIMISTIC_LOCK_FAILURE',
        message: 'Record was modified. Please refresh and try again.',
        current_version: caregiver.version,
        your_version: currentVersion,
      });
    }

    // Prepare update
    const updateData = {
      ...sanitizeInput(updates), // Remove sensitive fields
      version: caregiver.version + 1,
      updated_at: new Date(),
      updated_by: userId,
    };

    // Update record
    const updated = await db('caregivers')
      .where('id', caregiverId)
      .update(updateData)
      .returning('*');

    // Audit log
    await db('audit_logs').insert({
      resource_type: 'caregiver',
      resource_id: caregiverId,
      action: 'UPDATE',
      user_id: userId,
      changes: JSON.stringify(getChangedFields(caregiver, updateData)),
      timestamp: new Date(),
    });

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /caregivers/:id
router.delete('/:id', async (req, res) => {
  const caregiverId = req.params.id;
  const userId = req.user.id;
  const { confirmName } = req.body;

  // Permission check
  if (!req.user.permissions?.includes('CAREGIVER_DELETE')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    // Get caregiver
    const caregiver = await db('caregivers')
      .where('id', caregiverId)
      .where('deleted_at', null)
      .first();

    if (!caregiver) {
      return res.status(404).json({ error: 'Caregiver not found' });
    }

    // Check status
    if (caregiver.status === 'TERMINATED') {
      return res.status(422).json({
        error: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot delete terminated caregiver',
      });
    }

    // Verify confirmation
    const fullName = `${caregiver.first_name} ${caregiver.last_name}`;
    if (confirmName !== fullName) {
      return res.status(422).json({
        error: 'CONFIRMATION_FAILED',
        message: 'Caregiver name does not match',
      });
    }

    // Soft delete
    await db('caregivers').where('id', caregiverId).update({
      deleted_at: new Date(),
      deleted_by: userId,
    });

    // Audit log
    await db('audit_logs').insert({
      resource_type: 'caregiver',
      resource_id: caregiverId,
      action: 'DELETE',
      user_id: userId,
      timestamp: new Date(),
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /caregivers/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  const sourceId = req.params.id;
  const userId = req.user.id;
  const { 
    new_employee_number, 
    new_first_name, 
    new_last_name,
    new_email,
    copy_fields 
  } = req.body;

  // Permission check
  if (!req.user.permissions?.includes('CAREGIVER_CREATE')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    // Get source caregiver
    const source = await db('caregivers')
      .where('id', sourceId)
      .where('deleted_at', null)
      .first();

    if (!source) {
      return res.status(404).json({ error: 'Source caregiver not found' });
    }

    // Validate new email unique
    const existing = await db('caregivers')
      .where('email', new_email)
      .where('deleted_at', null)
      .first();

    if (existing) {
      return res.status(422).json({
        error: 'DUPLICATE_EMAIL',
        message: 'Email already in use',
      });
    }

    // Build new caregiver object
    const newCaregiver = {
      organization_id: source.organization_id,
      branch_ids: source.branch_ids,
      primary_branch_id: source.primary_branch_id,
      employee_number: new_employee_number,
      first_name: new_first_name,
      last_name: new_last_name,
      email: new_email,
      status: 'PENDING_ONBOARDING',
      employment_status: 'ACTIVE',
      created_by: userId,
      updated_by: userId,
      // Conditional fields based on copy_fields
      ...(copy_fields?.skills && { skills: source.skills }),
      ...(copy_fields?.certifications && { credentials: source.credentials }),
      ...(copy_fields?.work_preferences && { work_preferences: source.work_preferences }),
      ...(copy_fields?.availability && { availability: source.availability }),
      // Always exclude: employment history, reviews, background checks
    };

    // Insert new caregiver
    const [newId] = await db('caregivers').insert(newCaregiver).returning('id');

    // Audit log
    await db('audit_logs').insert({
      resource_type: 'caregiver',
      resource_id: newId,
      action: 'CREATE',
      user_id: userId,
      metadata: JSON.stringify({ duplicated_from: sourceId }),
      timestamp: new Date(),
    });

    res.status(201).json({ id: newId, ...newCaregiver });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 5.5 Audit Logging

**Ensure audit table exists:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  changes JSONB,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_audit_resource (resource_type, resource_id),
  INDEX idx_audit_timestamp (timestamp)
);
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**File:** `/packages/web/src/components/caregivers/__tests__/CaregiverActionButtons.test.tsx`

```typescript
describe('CaregiverActionButtons', () => {
  test('renders edit button', () => {
    render(
      <CaregiverActionButtons
        caregiverId="123"
        status="ACTIVE"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  test('disables delete button for terminated caregiver', () => {
    render(
      <CaregiverActionButtons
        caregiverId="123"
        status="TERMINATED"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  test('calls onEdit when edit button clicked', () => {
    const onEdit = jest.fn();
    render(
      <CaregiverActionButtons
        caregiverId="123"
        status="ACTIVE"
        onEdit={onEdit}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

**File:** `/packages/web/src/components/caregivers/__tests__/DeleteConfirmationDialog.test.tsx`

```typescript
describe('DeleteConfirmationDialog', () => {
  test('renders confirmation dialog with caregiver info', () => {
    render(
      <DeleteConfirmationDialog
        caregiver={{ id: '123', first_name: 'Sarah', last_name: 'M.' }}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText(/Sarah M./i)).toBeInTheDocument();
  });

  test('requires name confirmation', () => {
    const onConfirm = jest.fn();
    render(
      <DeleteConfirmationDialog
        caregiver={{ id: '123', first_name: 'Sarah', last_name: 'M.' }}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    // Delete button should be disabled initially
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();

    // Enter wrong name
    fireEvent.change(screen.getByPlaceholderText(/confirm/i), {
      target: { value: 'John' },
    });
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();

    // Enter correct name
    fireEvent.change(screen.getByPlaceholderText(/confirm/i), {
      target: { value: 'Sarah M.' },
    });
    expect(screen.getByRole('button', { name: /delete/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  test('requires checkbox confirmation', () => {
    render(
      <DeleteConfirmationDialog
        caregiver={{ id: '123', first_name: 'Sarah', last_name: 'M.' }}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();

    fireEvent.click(checkbox);
    // Delete button still disabled without name
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });
});
```

### 6.2 Backend API Tests

**File:** `/packages/app/src/routes/__tests__/caregivers.test.ts`

```typescript
describe('PATCH /caregivers/:id', () => {
  test('updates caregiver with valid data', async () => {
    const caregiverId = 'existing-id';
    const response = await request(app)
      .patch(`/api/caregivers/${caregiverId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        first_name: 'Sarah',
        last_name: 'Martinez',
        email: 'sarah@example.com',
        version: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.first_name).toBe('Sarah');
    expect(response.body.version).toBe(2); // Incremented
  });

  test('fails on optimistic lock mismatch', async () => {
    const caregiverId = 'existing-id';
    const response = await request(app)
      .patch(`/api/caregivers/${caregiverId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        first_name: 'Sarah',
        version: 1, // Outdated version
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('OPTIMISTIC_LOCK_FAILURE');
  });

  test('fails without CAREGIVER_WRITE permission', async () => {
    const response = await request(app)
      .patch('/api/caregivers/123')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ first_name: 'Sarah' });

    expect(response.status).toBe(403);
  });
});

describe('DELETE /caregivers/:id', () => {
  test('soft deletes caregiver with confirmation', async () => {
    const response = await request(app)
      .delete('/api/caregivers/existing-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmName: 'Sarah M.' });

    expect(response.status).toBe(204);

    // Verify soft delete
    const deleted = await db('caregivers')
      .where('id', 'existing-id')
      .first();
    expect(deleted.deleted_at).toBeTruthy();
  });

  test('fails with wrong name confirmation', async () => {
    const response = await request(app)
      .delete('/api/caregivers/existing-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmName: 'Wrong Name' });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe('CONFIRMATION_FAILED');
  });

  test('fails for terminated caregiver', async () => {
    const response = await request(app)
      .delete('/api/caregivers/terminated-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmName: 'John Doe' });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('POST /caregivers/:id/duplicate', () => {
  test('creates duplicate with selected fields', async () => {
    const response = await request(app)
      .post('/api/caregivers/existing-id/duplicate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        new_employee_number: 'EMP-2024-999',
        new_first_name: 'Sarah',
        new_last_name: 'Copy',
        new_email: 'sarah.copy@example.com',
        copy_fields: {
          skills: true,
          certifications: true,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.employee_number).toBe('EMP-2024-999');
    expect(response.body.status).toBe('PENDING_ONBOARDING');
  });

  test('fails with duplicate email', async () => {
    const response = await request(app)
      .post('/api/caregivers/existing-id/duplicate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        new_employee_number: 'EMP-2024-999',
        new_email: 'existing@example.com', // Already exists
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toBe('DUPLICATE_EMAIL');
  });
});
```

### 6.3 E2E Tests

**File:** `/e2e/caregiver-actions.spec.ts`

```typescript
test.describe('Caregiver Detail Page Actions', () => {
  test('can edit caregiver from detail page', async ({ page }) => {
    await page.goto('/admin/caregivers/caregiver-123');

    // Click edit button
    await page.click('button:has-text("Edit")');

    // Verify modal opened
    expect(await page.isVisible('text="Edit Caregiver"')).toBe(true);

    // Update field
    await page.fill('input[name="first_name"]', 'Updated Name');
    await page.click('button:has-text("Save Changes")');

    // Verify success
    expect(await page.isVisible('text="Caregiver updated successfully"')).toBe(true);
  });

  test('can delete caregiver with confirmation', async ({ page }) => {
    await page.goto('/admin/caregivers/caregiver-123');

    // Click delete button
    await page.click('button:has-text("Delete")');

    // Confirm dialog
    expect(await page.isVisible('text="Delete Caregiver?"')).toBe(true);

    // Enter name
    await page.fill('input[placeholder*="confirm"]', 'Sarah M.');

    // Check confirmation
    await page.click('input[type="checkbox"]');

    // Delete
    await page.click('button:has-text("Delete Caregiver")');

    // Verify redirect
    expect(page.url()).toContain('/admin/caregivers');
  });

  test('can duplicate caregiver', async ({ page }) => {
    await page.goto('/admin/caregivers/caregiver-123');

    // Open more menu
    await page.click('button:has-text("⋮")');

    // Click duplicate
    await page.click('text=Duplicate Caregiver');

    // Fill in new info
    await page.fill('input[name="new_employee_number"]', 'EMP-2024-999');
    await page.fill('input[name="new_email"]', 'sarah.copy@example.com');

    // Create duplicate
    await page.click('button:has-text("Create Duplicate")');

    // Verify new caregiver page
    expect(page.url()).toContain('/admin/caregivers/');
    expect(await page.isVisible('text="EMP-2024-999"')).toBe(true);
  });

  test('delete button disabled for terminated caregiver', async ({ page }) => {
    await page.goto('/admin/caregivers/terminated-caregiver-id');

    const deleteButton = page.locator('button:has-text("Delete")');
    expect(await deleteButton.isDisabled()).toBe(true);
  });
});
```

### 6.4 Accessibility Tests

```typescript
test('caregiver action buttons are accessible', async ({ page }) => {
  await page.goto('/admin/caregivers/caregiver-123');

  // Tab through buttons
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
  expect(['Edit', 'Delete', '⋮']).toContain(focusedElement);

  // ESC closes modal
  await page.keyboard.press('Enter'); // Opens edit modal
  await page.keyboard.press('Escape');
  expect(await page.isVisible('text="Edit Caregiver"')).toBe(false);
});

// Axe audit
test('caregiver detail page meets WCAG 2.1 AA', async ({ page }) => {
  const results = await injectAxe(page);
  expect(results.violations).toEqual([]);
});
```

---

## 7. Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Accidental caregiver deletion** | High | Medium | Require name confirmation + checkbox + toast warning |
| **Optimistic locking conflicts** | Medium | Low | Detect version mismatch; show refresh message |
| **Unauthorized deletions** | High | Low | Permission checks; audit logging; RBAC enforcement |
| **Duplicate caregiver abuse** | Low | Medium | Validate unique email; log all duplications |
| **Mobile modal overflow** | Low | Medium | Test on iPhone/Android; responsive modal styling |
| **Permission check bypass** | High | Low | Backend-side enforcement; never trust client-side |
| **Audit trail gaps** | Medium | Low | Log all CRUD operations; verify in tests |

**Mitigation Strategy:**
1. **Multi-step confirmation** for delete (name + checkbox)
2. **Permission checks** at backend (never client-side only)
3. **Audit logging** for all changes
4. **Optimistic locking** to prevent race conditions
5. **Rate limiting** on duplicate endpoint
6. **Soft deletes** (recoverable if needed)

---

## 8. Estimated Effort & Complexity

| Component | Lines | Effort | Notes |
|-----------|-------|--------|-------|
| CaregiverActionButtons.tsx | 150-200 | 2-3 pts | Button layout + permissions |
| EditCaregiverModal.tsx | 300-400 | 4-5 pts | Reuse form, add versioning |
| DeleteConfirmationDialog.tsx | 200-250 | 3-4 pts | Confirmation logic |
| DuplicateCaregiverModal.tsx | 250-300 | 3-4 pts | Field selection, validation |
| CaregiverMoreMenu.tsx | 150-200 | 2-3 pts | Dropdown menu |
| Backend API (Express) | 300-400 | 4-5 pts | PATCH, DELETE, POST endpoints |
| Unit tests | 400-500 | 3-4 pts | Test all scenarios |
| E2E tests | 300-400 | 2-3 pts | Multi-step workflows |
| Integration | 100-150 | 1-2 pts | Wire into detail page |
| **Total** | **1800-2400** | **8-12 pts** | ~1-2 weeks @ 1 dev |

### Complexity Breakdown
- **High:** Optimistic locking, permission system
- **Medium:** Modal state management, form validation
- **Low:** Component composition, styling

### Recommended Timeline
**Week 1 (5 pts):**
- Create CaregiverActionButtons, EditCaregiverModal, DeleteConfirmationDialog
- Wire into detail page
- Write unit tests

**Week 2 (4 pts):**
- Backend API endpoints (PATCH, DELETE, POST duplicate)
- E2E tests
- Bug fixes, accessibility audit

---

## 9. Success Metrics

- ✅ All action buttons visible and functional on caregiver detail page
- ✅ Edit updates caregiver and persists changes
- ✅ Delete soft-deletes with proper confirmation
- ✅ Duplicate creates new caregiver with selected fields
- ✅ All operations logged in audit trail
- ✅ Permissions enforced (backend + frontend)
- ✅ 0 accidental deletions due to missing confirmations
- ✅ Optimistic locking prevents race conditions
- ✅ Mobile UI responsive and functional
- ✅ 90%+ unit test coverage
- ✅ All E2E scenarios pass
- ✅ WCAG 2.1 AA compliance

---

## Appendix A: Permission Matrix

| Operation | Permission | Frontend Check | Backend Check |
|-----------|-----------|-----------------|----------------|
| View Detail | CAREGIVER_READ | Visible | Required |
| Edit | CAREGIVER_WRITE | Disabled button | Required |
| Delete | CAREGIVER_DELETE | Disabled button | Required |
| Duplicate | CAREGIVER_CREATE | Disabled button | Required |
| View History | AUDIT_READ | Link visible | Required |

---

## Appendix B: Status Transition Rules

```
PENDING_ONBOARDING
  → ACTIVE
  → INACTIVE
  → DELETE

ACTIVE
  → INACTIVE
  → ON_LEAVE
  → DELETE
  → SUSPENDED

ON_LEAVE
  → ACTIVE
  → DELETE
  → SUSPENDED

SUSPENDED
  → ACTIVE
  → DELETE

INACTIVE
  → ACTIVE
  → DELETE
  → TERMINATED (one-way)

TERMINATED
  → (no transitions)
  → View only

RETIRED
  → (no transitions)
  → View only
```

---

## Appendix C: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `E` | Focus Edit button |
| `D` | Focus Delete button |
| `Escape` | Close modal |
| `Enter` | Submit form (when focused) |
| `Tab` | Navigate through buttons |

---

**Document Version:** 1.0  
**Last Updated:** Oct 13, 2024  
**Prepared by:** Technical Architecture Team  
**Review Status:** ✅ Ready for Development Team Kickoff

