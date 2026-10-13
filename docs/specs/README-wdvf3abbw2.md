# Quick Reference: Create Visits Feature (wdvf3abbw2)

## 📋 Summary

A **comprehensive Technical Architecture specification** for enabling users to create new visits directly in the Schedule Builder modal dialog, improving workflow efficiency and reducing context-switching in Folk Care's scheduling vertical.

---

## 🎯 What's Included

### Complete Implementation Plan (12 story points / 9-12 days)

**Phase 1: Backend (3 pts, 2-3 days)**
- POST `/api/visits` endpoint with validation & permission checks
- Zod request schema validation
- ScheduleService.createVisit() business logic
- ScheduleRepository.createVisit() database insertion
- Conflict detection with caregiver availability checks
- Visit number generation
- Error handling & permission enforcement

**Phase 2: Frontend API Service (2 pts, 1-2 days)**
- Extend VisitApiService with createVisit() & checkConflicts() methods
- React hooks: useCreateVisit() & useCheckConflicts()
- Request/response type definitions
- Mutation integration with React Query
- Toast notifications on success/error

**Phase 3: Modal UI (4 pts, 3-4 days)**
- CreateVisitModal.tsx component with React Hook Form
- Zod validation schemas
- Form fields: client, service type, date, time, caregiver
- Real-time conflict detection & warning banners
- Integration with Schedule Builder page
- Keyboard navigation & accessibility

### Comprehensive Documentation

- **System context diagram** showing data flow
- **State diagrams** for visit lifecycle and form validation
- **API contracts** with request/response examples
- **Error handling strategy** with HTTP status codes & user messages
- **Database schema** with indexes and constraints
- **Testing strategy** (unit, integration, E2E)
- **Integration points** with other verticals (clients, care plans, caregivers)
- **Success metrics** and rollout plan

---

## 🏗️ Architecture Overview

```
User → Schedule Builder Page
  └─→ "Create Visit" Button
      └─→ CreateVisitModal (React)
          ├─→ Form validation (Zod + React Hook Form)
          ├─→ Conflict checking (real-time)
          └─→ API Service Layer
              └─→ POST /api/visits
                  └─→ Backend Route Handler
                      ├─→ Authentication & Authorization
                      ├─→ Request Validation
                      ├─→ ScheduleService (business logic)
                      ├─→ ScheduleRepository (database)
                      └─→ PostgreSQL (persistence)
```

---

## 📁 Files to Create/Modify

### Backend
1. `verticals/scheduling-visits/src/api/visits-routes.ts` (NEW)
   - POST /api/visits endpoint
   - Request validation schema
   - Error handling

2. `verticals/scheduling-visits/src/service/schedule-service.ts` (EXTEND)
   - createVisit() method
   - checkConflicts() method
   - generateVisitNumber() helper

3. `verticals/scheduling-visits/src/repository/schedule-repository.ts` (EXTEND)
   - createVisit() database operation
   - getConflictingVisits() query

4. `verticals/scheduling-visits/migrations/YYYYMMDD-*.sql` (NEW)
   - Indexes for performance
   - Constraints for data integrity

### Frontend
1. `packages/web/src/verticals/scheduling-visits/services/visit-api.ts` (EXTEND)
   - createVisit() service method
   - checkConflicts() service method
   - Request/response types

2. `packages/web/src/verticals/scheduling-visits/hooks/useCreateVisit.ts` (NEW)
   - useCreateVisit() hook
   - useCheckConflicts() hook

3. `packages/web/src/verticals/scheduling-visits/components/CreateVisitModal.tsx` (NEW)
   - Modal component (400+ lines)
   - Form validation
   - Conflict warnings

4. `packages/web/src/pages/scheduling/ScheduleBuilderPage.tsx` (EXTEND)
   - Add "Create Visit" button
   - Modal state management
   - Calendar refresh on creation

---

## 🔑 Key Features

✅ **Form Validation**
- Client-side Zod + React Hook Form validation
- Server-side request validation
- Real-time error feedback

✅ **Conflict Checking**
- Real-time caregiver availability checks
- Warning banners for scheduling conflicts
- Suggestion to unassign or change time

✅ **Permission Control**
- JWT authentication required
- `schedules:create` permission enforcement
- Organization & branch-level access control

✅ **Error Handling**
- Validation errors (400)
- Authentication errors (401)
- Permission errors (403)
- Scheduling conflicts (409)
- Server errors (500)
- Network error retry logic

✅ **UX/DX Improvements**
- Modal can be opened from calendar
- Pre-fill date from context
- Pre-fill client from context
- Success notifications with visit ID
- Keyboard navigation support
- Accessibility compliant (WCAG 2.1 AA)

---

## 📊 Effort Breakdown

| Phase | Component | Effort | Duration |
|-------|-----------|--------|----------|
| Phase 1 | Backend | 3 pts | 2-3 days |
| Phase 2 | Frontend API | 2 pts | 1-2 days |
| Phase 3 | Modal UI | 4 pts | 3-4 days |
| Testing | Unit & E2E | 3 pts | 2-3 days |
| **TOTAL** | | **12 pts** | **9-12 days** |

---

## 🎬 Getting Started

1. **Read the full spec:** `/Users/markjordan/folk-care/docs/specs/wdvf3abbw2-create-visits.md`
2. **Review existing patterns:**
   - `verticals/scheduling-visits/src/service/schedule-service.ts`
   - `packages/web/src/verticals/scheduling-visits/services/visit-api.ts`
   - `packages/web/src/verticals/payroll-processing/components/CreatePayRunModal.tsx` (similar modal pattern)
3. **Setup database migrations** - Ensure indexes are created
4. **Implement Phase 1** - Backend route and service
5. **Implement Phase 2** - Frontend API service
6. **Implement Phase 3** - Modal component
7. **Test** - Unit, integration, and E2E tests

---

## 🚀 Acceptance Criteria Checklist

- [ ] AC1: User can open "Create Visit" modal from Schedule Builder
- [ ] AC2: Modal validates all required fields before submission
- [ ] AC3: Visit is created with `DRAFT` status initially
- [ ] AC4: System checks caregiver availability and conflicts
- [ ] AC5: Success notification displays visit ID and details
- [ ] AC6: Calendar updates in real-time with new visit
- [ ] AC7: Permission checks prevent unauthorized users
- [ ] AC8: Error messages are clear and actionable
- [ ] AC9: Form supports tab navigation and keyboard shortcuts
- [ ] AC10: Modal can be dismissed without saving

---

## 📚 Implementation References

**Code Examples Provided:**
- Complete route handler with validation
- Service layer business logic
- Repository database queries
- React Hook Form integration
- Zod validation schemas
- React Query mutations
- Error handling patterns

**Integration Points:**
- Authentication middleware (JWT)
- Authorization checks (permissions)
- Client-demographics vertical (useClients)
- Care-plans vertical (useServiceTypes)
- Caregivers vertical (useCaregivers)
- Notification service (visit.created event)

---

## ✨ Documentation Quality

- **1,950 lines** of detailed specification
- **14 major sections** covering all aspects
- **10+ code examples** with inline comments
- **State diagrams** for visit lifecycle and form validation
- **API contracts** with request/response examples
- **Database schema** with indexes and constraints
- **Error handling matrix** with HTTP codes
- **Testing strategy** (unit, integration, E2E)
- **Effort estimation** with time breakdowns
- **Success metrics** and rollout plan

---

## 📖 Document Location

📄 **Spec File:** `/Users/markjordan/folk-care/docs/specs/wdvf3abbw2-create-visits.md`

---

**Status:** ✅ Ready for Implementation  
**Created:** 2024-10-12  
**Total Words:** ~8,500  
**Total Lines:** 1,950  
**Code Examples:** 15+
