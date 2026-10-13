# Implementation Checklist: Create Visits Feature (wdvf3abbw2)

**Ticket:** wdvf3abbw2 - Create way to add new visits inside of Schedule  
**Total Effort:** 12 story points (9-12 days)  
**Start Date:** [TBD]  
**Target Completion:** [TBD]

---

## Phase 1: Backend HTTP Endpoint (3 pts)

### A. Route Definition & Validation (1.5 pts, 1 day)
- [ ] Create `verticals/scheduling-visits/src/api/visits-routes.ts`
- [ ] Define `CreateVisitRequestSchema` (Zod validation)
- [ ] Define response types: `CreateVisitResponse`, `CreateVisitError`
- [ ] Implement route handler: `POST /api/visits`
- [ ] Add auth middleware: `verifyAuth()`
- [ ] Add permission check: `checkPermission('schedules:create')`
- [ ] Add request validation: `validateRequest(schema)`
- [ ] Implement error responses (400, 403, 409, 500)
- [ ] Add input sanitization & rate limiting

**Definition of Done:**
- Zod schema validates request payloads
- Auth/permission checks prevent unauthorized access
- Route handler properly typed with TypeScript
- Error responses follow Folk Care API conventions

### B. Service Layer Logic (1 pt, 1 day)
- [ ] Add `createVisit()` method to ScheduleService
  - Validate input with ScheduleValidator
  - Check org/branch access
  - Validate client exists (call client-demographics)
  - Validate service type exists
  - Validate caregiver exists (if assigned)
  - Check caregiver compliance (credentials, availability)
  - Create visit via repository
  - Emit visit.created event
- [ ] Add `checkConflicts()` method to ScheduleService
- [ ] Add `generateVisitNumber()` helper method
- [ ] Add credential compliance provider integration
- [ ] Add comprehensive logging/debugging

**Definition of Done:**
- All business logic validations implemented
- Permission checks at service layer
- Events emitted for downstream systems
- Proper error messages returned

### C. Repository & Data Persistence (0.5 pts, 0.5 day)
- [ ] Add `createVisit()` method to ScheduleRepository
  - INSERT into visits table
  - Return created Visit object
  - Handle transaction rollback on error
- [ ] Add `getConflictingVisits()` query
- [ ] Add indexes for performance (see migration)
- [ ] Verify soft-delete compatibility

**Definition of Done:**
- Visit correctly inserted in database
- All required fields populated
- Timestamps set correctly
- Audit trail (created_by, created_at) recorded

### D. Database Migrations (0.5 pts, 0.5 day)
- [ ] Create migration file: `YYYYMMDD-add-visit-creation-indexes.sql`
- [ ] Add index on `(assigned_caregiver_id, scheduled_date, status)` for conflict queries
- [ ] Add index on `(organization_id, scheduled_date)` for visit retrieval
- [ ] Add constraint: `CHECK (scheduled_end_time > scheduled_start_time)`
- [ ] Verify migration runs successfully
- [ ] Test rollback capability

**Definition of Done:**
- All indexes created successfully
- Constraints enforce business rules
- No migration errors on test/prod data

### E. Phase 1 Testing
- [ ] Unit tests for ScheduleService.createVisit()
- [ ] Unit tests for ScheduleValidator
- [ ] Integration tests for route handler
- [ ] Test validation error scenarios (400)
- [ ] Test permission denied scenarios (403)
- [ ] Test conflict scenarios (409)
- [ ] Test success scenario (201)
- [ ] Load test the endpoint

---

## Phase 2: Frontend API Service (2 pts)

### A. Extend VisitApiService (1 pt, 1 day)
- [ ] Add `createVisit()` method signature to interface
- [ ] Add `checkConflicts()` method signature to interface
- [ ] Define types: `CreateVisitPayload`, `CreateVisitResponse`, `VisitConflict`
- [ ] Implement `createVisit()` in createVisitApiService
  - POST to /api/visits
  - Include all required fields
  - Return typed response
- [ ] Implement `checkConflicts()` in createVisitApiService
  - POST to /api/visits/check-conflicts
  - Return conflicts array
- [ ] Add JSDoc comments

**Definition of Done:**
- API service methods type-safe
- Request/response contracts match backend
- Error responses properly typed
- Methods follow existing patterns

### B. React Hooks (1 pt, 1 day)
- [ ] Create `useCreateVisit()` hook
  - useMutation wrapper
  - Success handler: invalidate queries, show toast
  - Error handler: show error toast
  - Options param for callbacks
  - Return: { mutateAsync, isPending, error }
- [ ] Create `useCheckConflicts()` hook
  - useMutation wrapper
  - Debounce support for real-time checking
  - Error logging
  - Return: { mutateAsync, isPending, data }
- [ ] Add proper TypeScript types
- [ ] Add JSDoc comments

**Definition of Done:**
- Hooks properly integrate with React Query
- Cache invalidation works correctly
- Error handling consistent with app patterns
- Type-safe mutation arguments

---

## Phase 3: Frontend Modal UI (4 pts)

### A. CreateVisitModal Component (2.5 pts, 2 days)
- [ ] Create `packages/web/src/verticals/scheduling-visits/components/CreateVisitModal.tsx`
- [ ] Setup React Hook Form with zodResolver
- [ ] Define form schema with Zod
  - Validate client ID (UUID)
  - Validate service type (UUID)
  - Validate date (not past)
  - Validate times (end > start)
  - Validate caregiver optional
- [ ] Implement form fields:
  - [ ] Client select dropdown (useClients hook)
  - [ ] Service type select (useServiceTypes hook)
  - [ ] Visit type select (radio or dropdown)
  - [ ] Date input (HTML date picker)
  - [ ] Start time input (HTML time picker)
  - [ ] End time input (HTML time picker)
  - [ ] Caregiver select (useCaregivers hook)
  - [ ] Notes textarea
- [ ] Implement conflict checking
  - [ ] useCheckConflicts hook integration
  - [ ] Debounced checks on date/time/caregiver change
  - [ ] Display conflict warning banner
  - [ ] Show conflicting visit details
  - [ ] Disable submit if conflicts exist
  - [ ] Allow user to unassign caregiver
- [ ] Implement form submission
  - [ ] Prevent submit if conflicts
  - [ ] Call useCreateVisit.mutateAsync()
  - [ ] Reset form on success
  - [ ] Close modal on success
- [ ] Styling & layout
  - [ ] Modal backdrop
  - [ ] Header with close button
  - [ ] Form body with proper spacing
  - [ ] Footer with Cancel/Create buttons
  - [ ] Loading state (spinner)
  - [ ] Error message styling
- [ ] Accessibility
  - [ ] Proper ARIA labels
  - [ ] Semantic HTML
  - [ ] Keyboard navigation (Tab, Shift+Tab)
  - [ ] Keyboard shortcuts (Escape to close)
  - [ ] Focus management
  - [ ] Error announcements

**Definition of Done:**
- Form validates all inputs
- Conflict checking works in real-time
- Modal is keyboard accessible
- Styling matches Folk Care design system
- All error scenarios handled

### B. Integration with Schedule Builder (1.5 pts, 1 day)
- [ ] Locate `packages/web/src/pages/scheduling/ScheduleBuilderPage.tsx`
- [ ] Import CreateVisitModal component
- [ ] Add state management
  - [ ] `isCreateVisitModalOpen` state
  - [ ] `selectedDate` state (for modal pre-fill)
- [ ] Add "Create Visit" button
  - [ ] Visible in page header
  - [ ] Opens modal on click
  - [ ] Shows loading state while creating
- [ ] Implement context menu
  - [ ] Right-click on calendar cell opens modal
  - [ ] Pass date to modal
- [ ] Implement calendar refresh
  - [ ] useCreateVisit hook invalidates calendarVisits query
  - [ ] Calendar re-renders with new visit
  - [ ] No full page reload required
- [ ] Implement success callback
  - [ ] Close modal
  - [ ] Show success message
  - [ ] Highlight new visit in calendar

**Definition of Done:**
- Modal opens from Schedule Builder
- Modal closes after creation
- New visit appears in calendar
- No manual refresh needed
- User feedback is immediate

### C. Phase 3 Testing
- [ ] Component unit tests (render, form validation, error handling)
- [ ] Hook tests (useCreateVisit, useCheckConflicts)
- [ ] Integration tests (modal + Schedule Builder)
- [ ] E2E tests (full user flow)
- [ ] Accessibility tests (keyboard nav, screen reader)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)

---

## Phase 4: Testing & QA (3 pts)

### A. Unit Tests (1 pt, 1 day)
- [ ] Backend: ScheduleService tests
- [ ] Backend: ScheduleValidator tests
- [ ] Backend: Route handler tests
- [ ] Frontend: CreateVisitModal component tests
- [ ] Frontend: useCreateVisit hook tests
- [ ] Frontend: useCheckConflicts hook tests
- [ ] All tests include error scenarios

### B. Integration Tests (1 pt, 1 day)
- [ ] Full API endpoint flow (request → response)
- [ ] Database transaction consistency
- [ ] Modal → API → Calendar flow
- [ ] Conflict checking workflow
- [ ] Permission enforcement
- [ ] Event emission

### C. E2E Tests (1 pt, 1 day)
- [ ] Happy path: Create valid visit
- [ ] Validation errors: Invalid input
- [ ] Conflict scenario: Caregiver unavailable
- [ ] Permission denied: User lacks access
- [ ] Network error: API failure recovery
- [ ] Modal dismiss: User cancels creation
- [ ] Calendar update: New visit appears
- [ ] Success notification: User sees confirmation

---

## Phase 5: Documentation & Deployment (1 pt)

### A. Code Documentation
- [ ] JSDoc comments on all public functions
- [ ] Inline comments for complex logic
- [ ] TypeScript types documented
- [ ] API endpoint documented
- [ ] Update CHANGELOG.md

### B. User Documentation
- [ ] Add to user guide: "Creating Visits"
- [ ] Include screenshots
- [ ] Document conflict resolution steps
- [ ] Add keyboard shortcuts guide

### C. Deployment
- [ ] Database migration tested on staging
- [ ] Feature flag (if needed) configured
- [ ] Rollout plan prepared
- [ ] Monitoring/alerting configured
- [ ] Runbook created for support team

---

## Acceptance Criteria Sign-Off

### AC1: User can open "Create Visit" modal from Schedule Builder
- [ ] "Create Visit" button visible in Schedule Builder
- [ ] Clicking button opens modal
- [ ] Modal has proper styling and layout
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC2: Modal validates all required fields before submission
- [ ] Client field required (shows error if empty)
- [ ] Service type field required (shows error if empty)
- [ ] Date field required (shows error if empty)
- [ ] Start time required (shows error if empty)
- [ ] End time required (shows error if empty)
- [ ] End time > start time (shows error if not)
- [ ] Submit button disabled when invalid
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC3: Visit is created with `DRAFT` status initially
- [ ] API creates visit with status='DRAFT'
- [ ] Database query confirms status is DRAFT
- [ ] UI shows DRAFT status for new visit
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC4: System checks caregiver availability and conflicts (if caregiver assigned)
- [ ] Conflict check API endpoint works
- [ ] Real-time check shows conflicts
- [ ] Warning banner displays conflicting visits
- [ ] Submit disabled if conflicts exist
- [ ] User can unassign caregiver to resolve
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC5: Success notification displays visit ID and details
- [ ] Toast notification appears on success
- [ ] Shows visit number (e.g., "ACME-20241015-0047")
- [ ] Shows visit time and client name
- [ ] Notification auto-dismisses after 4 seconds
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC6: Calendar updates in real-time with new visit
- [ ] New visit appears in calendar immediately
- [ ] No page reload required
- [ ] Visit shows correct date/time
- [ ] Visit shows correct client name
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC7: Permission checks prevent unauthorized users from creating visits
- [ ] User without schedules:create permission gets 403 error
- [ ] Error message explains permission denied
- [ ] API returns 403 before database operation
- [ ] Button disabled for users without permission
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC8: Error messages are clear and actionable (validation, conflict, permission errors)
- [ ] Validation errors highlight specific fields
- [ ] Conflict errors suggest solutions (unassign, change time)
- [ ] Permission errors explain what permission is needed
- [ ] Network errors offer retry option
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC9: Form supports tab navigation and keyboard shortcuts
- [ ] Tab key navigates through form fields
- [ ] Shift+Tab navigates backwards
- [ ] Escape key closes modal
- [ ] Enter key submits form (when no conflicts)
- [ ] Focus management works correctly
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

### AC10: Modal can be dismissed without saving
- [ ] Close button (X) closes modal
- [ ] Escape key closes modal
- [ ] Clicking outside modal closes it (if implemented)
- [ ] Form data cleared on close
- [ ] No unsaved data persisted
- **Status:** ☐ Not Started ☐ In Progress ☐ Complete

---

## Sign-Off & Review

| Role | Name | Date | Status |
|------|------|------|--------|
| Ticket Owner | | | ☐ Approved |
| Tech Lead | | | ☐ Approved |
| QA Lead | | | ☐ Approved |
| Product Manager | | | ☐ Approved |

---

## Notes & Dependencies

- Depends on: client-demographics, care-plans, caregivers verticals
- Blocking: [None identified]
- Blocked by: [None identified]
- Related tickets: [TBD]

---

**Last Updated:** 2024-10-12  
**Next Review:** [TBD - Post-Phase 1]
