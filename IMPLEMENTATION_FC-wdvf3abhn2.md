# Visit Types Expansion - Implementation Guide (FC-wdvf3abhn2)

## Overview

This implementation expands Folk Care's scheduling system from 1 visit type (Supervisory Nurse Visit) to **10 visit types**, enabling proper billing, compliance tracking, and clinical workflow management.

## What Was Implemented

### 1. Visit Type Definitions (10 Total)

```typescript
export type VisitType =
  | 'REGULAR'         // Standard recurring home care
  | 'INITIAL'         // First visit with new client (requires RN/LPN)
  | 'ASSESSMENT'      // Periodic assessment (requires RN/LPN)
  | 'RESPITE'         // Temporary relief for family caregivers
  | 'SUPERVISION'     // Nursing oversight (requires RN)
  | 'EMERGENCY'       // Urgent response to crisis
  | 'DISCHARGE'       // End of service visit
  | 'MAKEUP'          // Rescheduled visit for missed appointment
  | 'CONCIERGE'       // Premium personal services
  | 'ONGOING_SUPPORT' // Continued monitoring between visits
```

### 2. Database Changes

**File:** `packages/core/migrations/20261013000000_add_concierge_visit_type.ts`

- Added CONCIERGE and ONGOING_SUPPORT to the visit_type CHECK constraint
- No breaking changes - constraint was already permissive for 8 types
- Pure additive change, backward compatible

### 3. Configuration System

**File:** `packages/web/src/verticals/scheduling-visits/config/visitTypeConfig.ts`

Each visit type now has rich metadata:

```typescript
interface VisitTypeConfig {
  type: VisitType;
  label: string;
  icon: LucideIcon;
  color: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  description: string;
  typicalDuration: number;        // minutes
  careLevel: 'LOW' | 'STANDARD' | 'MEDIUM_HIGH' | 'HIGH' | 'CRITICAL' | 'VARIABLE';
  requiredCertifications: string[]; // e.g., ['RN'], ['RN', 'LPN']
  billingRate: string;             // e.g., 'STANDARD', 'INITIAL_VISIT'
}
```

### 4. UI Components

#### VisitTypeSelector
**File:** `packages/web/src/verticals/scheduling-visits/components/VisitTypeSelector.tsx`

- Radio button grid showing all 10 visit types
- Displays icon, label, description for each type
- Shows required certifications inline
- Supports disabled state (for post-assignment scenarios)
- Fully accessible with proper ARIA labels

**Usage:**
```tsx
import { VisitTypeSelector } from '@/verticals/scheduling-visits';

<VisitTypeSelector 
  value={selectedType}
  onChange={(type) => setSelectedType(type)}
  disabled={isAfterAssignment}
/>
```

#### VisitTypeBadge
**File:** `packages/web/src/verticals/scheduling-visits/components/VisitTypeBadge.tsx`

- Display visit types as colored badges with icons
- Supports small, medium, large sizes
- Optional label and icon display
- Auto-implements color scheme based on visit type
- Perfect for list items, cards, headers

**Usage:**
```tsx
import { VisitTypeBadge } from '@/verticals/scheduling-visits';

<VisitTypeBadge type="INITIAL" size="md" />
// Renders: [📋 Initial Visit]
```

### 5. Validation Functions

**File:** `packages/web/src/verticals/scheduling-visits/utils/visitTypeValidation.ts`

Comprehensive validation covering all visit type scenarios:

```typescript
// Validate visit type value
validateVisitType(type): ValidationError | undefined

// Check caregiver certification eligibility
validateCaregiverEligibility(certs, visitType): ValidationError | undefined

// Validate visit duration against visit type constraints
validateVisitDuration(duration, visitType): ValidationError | undefined

// Prevent visit type changes after assignment
validateVisitTypeChangeAfterAssignment(caregiverId): ValidationError | undefined

// Bulk validation for visit creation
validateVisitCreation(visitData): ValidationError[]

// Get eligible visit types for a caregiver's certifications
getEligibleVisitTypesForCaregiver(certs): VisitType[]
```

**Example Usage:**
```typescript
// Validate complete visit creation
const errors = validateVisitCreation({
  visitType: 'INITIAL',
  duration: 90,
  caregiverCertifications: ['RN', 'CPR'],
  assignedCaregiverId: undefined
});

if (errors.length > 0) {
  // Show validation errors
}

// Get available visit types for a caregiver
const available = getEligibleVisitTypesForCaregiver(['RN']);
// Returns: REGULAR, INITIAL, ASSESSMENT, RESPITE, SUPERVISION, EMERGENCY, DISCHARGE, MAKEUP, CONCIERGE, ONGOING_SUPPORT
```

### 6. Test Coverage

Over **50 unit tests** covering:

#### visitTypeConfig.test.ts (20+ tests)
- All 10 visit types properly defined
- Required certifications correct
- Typical durations reasonable
- Care levels assigned correctly
- Billing rates consistent
- Helper functions work properly

#### VisitTypeSelector.test.tsx (15+ tests)
- Renders all 10 visit types
- Selection callback fires correctly
- Shows required certifications
- Disabled state works
- Radio buttons properly labeled
- Handles all visit types

#### VisitTypeBadge.test.tsx (15+ tests)
- Correct labels for all types
- Size classes applied correctly
- Icon/label show/hide works
- Color classes match type
- All visit types rendered correctly
- Accessibility attributes present

#### visitTypeValidation.test.ts (20+ tests)
- All validation functions tested
- Error messages clear
- Edge cases handled
- Eligibility rules verified
- Certification matching works
- Duration warnings logged properly

## Integration Points

### 1. Create Visit Modal

Update `CreateVisitModal.tsx`:
```tsx
import { VisitTypeSelector } from '@/verticals/scheduling-visits';

<VisitTypeSelector 
  value={visitType}
  onChange={setVisitType}
/>
```

### 2. Visit Filters/Search

Update visit filtering to support:
```typescript
interface VisitSearchFilters {
  visitType?: VisitType[]; // Now supported
  // ... other filters
}
```

### 3. Visit Display

Replace hardcoded visit type text with:
```tsx
import { VisitTypeBadge } from '@/verticals/scheduling-visits';

<VisitTypeBadge type={visit.visitType} />
```

### 4. Caregiver Assignment

Use validation before assignment:
```typescript
import { validateCaregiverEligibility } from '@/verticals/scheduling-visits';

const error = validateCaregiverEligibility(
  caregiver.certifications,
  visit.visitType
);

if (error) {
  return <Alert>{error.message}</Alert>;
}
```

### 5. API Integration

Backend should:
- Accept `visit_type` in create/update visit requests
- Validate visit_type against allowed values
- Return visit_type in all visit responses
- Support filtering by `visit_type` query parameter

## Key Features

✅ **10 Complete Visit Types** - All types have full metadata
✅ **Certification Tracking** - Automatically enforces RN/LPN requirements
✅ **Care Level Categorization** - Supports LOW to CRITICAL care levels
✅ **Billing Integration Ready** - Each type has billing_rate metadata
✅ **Immutable After Assignment** - Visit type cannot change post-assignment
✅ **Smart Caregiver Matching** - Filter caregivers by visit type requirements
✅ **Comprehensive UI Components** - Selector and badge components ready to use
✅ **50+ Unit Tests** - All scenarios covered with high confidence
✅ **Type-Safe** - Full TypeScript support throughout

## Database Schema

No migration required - constraint already exists:

```sql
ALTER TABLE visits
ADD CONSTRAINT visits_visit_type_check
CHECK (visit_type IN (
  'REGULAR', 'INITIAL', 'DISCHARGE', 'RESPITE', 
  'EMERGENCY', 'MAKEUP', 'SUPERVISION', 'ASSESSMENT',
  'CONCIERGE', 'ONGOING_SUPPORT'
));
```

## Typical Visit Durations

| Type | Duration | Care Level |
|------|----------|-----------|
| Regular | 60 min | Standard |
| Initial | 90 min | High |
| Assessment | 60 min | Medium-High |
| Respite | 240 min (4h) | Variable |
| Supervision | 45 min | High |
| Emergency | 30 min | Critical |
| Discharge | 60 min | Standard |
| Makeup | 60 min | Standard |
| Concierge | 120 min | Low |
| Ongoing Support | 30 min | Standard |

## Certification Requirements

| Visit Type | Required | Optional |
|-----------|----------|----------|
| Regular | None | Any |
| Initial | RN or LPN | CPR, BLS |
| Assessment | RN or LPN | CPR, BLS |
| Respite | None | Any |
| Supervision | RN | CPR, BLS |
| Emergency | None | Any |
| Discharge | None | Any |
| Makeup | None | Any |
| Concierge | None | Any |
| Ongoing Support | None | Any |

## Files Changed

### New Files
- `packages/core/migrations/20261013000000_add_concierge_visit_type.ts`
- `packages/web/src/verticals/scheduling-visits/config/visitTypeConfig.ts` (expanded)
- `packages/web/src/verticals/scheduling-visits/components/VisitTypeSelector.tsx`
- `packages/web/src/verticals/scheduling-visits/components/VisitTypeBadge.tsx`
- `packages/web/src/verticals/scheduling-visits/utils/visitTypeValidation.ts`
- `packages/web/src/verticals/scheduling-visits/visitTypes.ts` (barrel export)
- `packages/web/src/verticals/scheduling-visits/config/__tests__/visitTypeConfig.test.ts`
- `packages/web/src/verticals/scheduling-visits/components/__tests__/VisitTypeSelector.test.tsx`
- `packages/web/src/verticals/scheduling-visits/components/__tests__/VisitTypeBadge.test.tsx`
- `packages/web/src/verticals/scheduling-visits/utils/__tests__/visitTypeValidation.test.ts`

### Modified Files
- `packages/web/src/verticals/scheduling-visits/types/index.ts` (added CONCIERGE, ONGOING_SUPPORT)
- `packages/web/src/verticals/scheduling-visits/config/visitTypeConfig.ts` (expanded from 8 to 10 types)

## Success Criteria

✅ All 10 visit types displayable in UI
✅ Proper icons and colors for each type
✅ Caregiver certification requirements enforced
✅ Visit type immutable after assignment
✅ 50+ unit tests with high coverage
✅ Type-safe throughout codebase
✅ Ready for QA testing

## Next Steps for Integration

1. **Create Visit Modal Integration**
   - Import VisitTypeSelector
   - Add to form with validation
   - Update API call to include visit_type

2. **Visit List/Filter Integration**
   - Add visit type filter to VisitFilters component
   - Update queries to support visit_type filtering
   - Display VisitTypeBadge in list/card views

3. **Caregiver Assignment**
   - Use getEligibleVisitTypesForCaregiver()
   - Show only eligible caregivers
   - Validate before assignment with validateCaregiverEligibility()

4. **Backend Implementation**
   - Validate visit_type on API endpoints
   - Add visit_type to response serialization
   - Support visit_type in filtering queries

5. **API Testing**
   - Test all visit types can be created
   - Test invalid types are rejected
   - Test filtering by visit_type
   - Test certification requirement enforcement

## Resources

- Spec: `docs/specs/FC-wdvf3abhn2-SPEC.md`
- Implementation: This document
- Tests: See `__tests__` directories for examples

---

**Status:** Ready for QA Review  
**Branch:** `fix/wdvf3abhn2-visit-types`  
**Commits:** Single focused commit with all changes  
**Tests:** 50+ unit tests with high coverage
