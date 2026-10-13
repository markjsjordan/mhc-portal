# Specification: Expand State Dropdown to All 50 US States

**Ticket**: wdvf3abehp  
**Title**: New Client intake form State should offer all states in the US, not just TX, NY, and CA  
**Status**: Requirements → Implementation Ready  
**Date**: October 13, 2026  

---

## Executive Summary

The Folk Care platform currently provides a hardcoded state dropdown limited to a partial list of states in multiple locations. This specification outlines the inventory of affected components, the current implementation architecture, and a phased implementation approach to expand the state selector to all 50 US states plus territories.

**Current Status**: Hardcoded lists exist in at least 2 separate files with inconsistent coverage.  
**Target State**: Single source of truth with all 50 states + US territories.

---

## 1. Current Implementation Analysis

### 1.1 Affected Files & Current State Lists

#### **File 1: `packages/web/src/app/pages/Signup.tsx`** (Lines 7-62)
- **Current Coverage**: 50 states + DC + 3 territories (PR, VI, GU) = **54 entries**
- **Status**: ✅ COMPLETE (all 50 states present)
- **Implementation**: Hardcoded array `US_STATES` defined locally in component
- **Used In**: Signup flow, Step 1 (Organization Details)

**Current States Listed:**
```
AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, 
LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, 
OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, PR, VI, GU
```

#### **File 2: `packages/web/src/core/services/organization-api.ts`** (Lines 106-120)
- **Current Coverage**: ~10 states (TX, FL, AL, AK, AZ, AR, CA, CO, CT, DE, GA)
- **Status**: ❌ INCOMPLETE - comment says "can be added as needed"
- **Implementation**: Hardcoded array `US_STATES` exported from service
- **Used In**: OrganizationRegistrationForm component
- **Problem**: Partial list with ellipsis comment (lines 119) indicating placeholder

**Current States Listed:**
```
TX, FL, AL, AK, AZ, AR, CA, CO, CT, DE, GA
```

#### **File 3: `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx`** (Lines 14, 212-215)
- **Current Coverage**: Imports from `organization-api.ts` and uses `US_STATES` export
- **Status**: Depends on File 2
- **Implementation**: Maps imported array to Select component options

#### **File 4: `packages/web/src/app/pages/admin/components/StateConfigPanel.tsx`** (Line 229)
- **Current Coverage**: Uses states.find() method (likely pulls from central source)
- **Status**: May depend on organization or centralized constants

---

### 1.2 Inconsistency Problem

| Source | Coverage | Status | Issue |
|--------|----------|--------|-------|
| Signup.tsx | 54 entries (complete) | ✅ Working | Duplicate hardcoded definition |
| organization-api.ts | ~10 entries | ❌ Incomplete | Blocks registration form |
| StateConfigPanel.tsx | Unknown source | ? | Indirect dependency |

**Root Cause**: Two separate hardcoded arrays exist. The registration form uses the incomplete one from `organization-api.ts`, while the signup flow uses the complete one from `Signup.tsx`.

---

## 2. Technical Architecture

### 2.1 Current Data Flow

```
Signup.tsx (US_STATES array)
        ↓
    Step 1: State Selection
        ↓
    /api/signup endpoint

OrganizationRegistrationForm.tsx
        ↓ (imports)
organization-api.ts (US_STATES export)
        ↓
    Select component rendering
        ↓
    stateCode stored in form
```

### 2.2 Component Integration Points

1. **Signup Page** (onboarding flow, public)
   - File: `packages/web/src/app/pages/Signup.tsx`
   - Usage: Line 334 - maps US_STATES to <option> elements
   - Input field: `stateCode` (required)

2. **Organization Registration Form** (admin setup, internal)
   - File: `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx`
   - Usage: Lines 212-215 - maps imported US_STATES to Select options
   - Input field: `stateCode` (required)

3. **Organization API Service**
   - File: `packages/web/src/core/services/organization-api.ts`
   - Type: `USStateCode` interface (lines 10-13)
   - Export: `US_STATES` constant array (lines 106-120)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-1 | All 50 US states available in state selector | To implement |
| FR-2 | US territories (PR, VI, GU, AS, MP) available as options | To implement |
| FR-3 | District of Columbia (DC) available | Already complete in Signup.tsx |
| FR-4 | State selection persists in organization record | Existing |
| FR-5 | Dropdown renders in <100ms regardless of state count | Performance |
| FR-6 | State codes map to correct full names | Data accuracy |

### 3.2 Non-Functional Requirements

| ID | Requirement | Implementation |
|----|-------------|-----------------|
| NF-1 | Single Source of Truth | Centralized constant, imported by all consumers |
| NF-2 | Type Safety | TypeScript interface for state objects |
| NF-3 | Alphabetical Order | States sorted A→Z for UX consistency |
| NF-4 | No API Changes | State list stays client-side constant |
| NF-5 | Backward Compatibility | Existing state codes (TX, FL, CA, etc.) remain valid |

### 3.3 Acceptance Criteria

- [ ] All 50 states + DC + 5 territories available in both signup and registration forms
- [ ] Single `US_STATES` constant used across all components
- [ ] States sorted alphabetically in dropdown
- [ ] No hardcoded state lists remaining in components
- [ ] Type definitions match actual state data
- [ ] All existing tests pass
- [ ] No regression in state selection UX or performance

---

## 4. Implementation Approach

### 4.1 Phase 1: Consolidate State Data (Priority: HIGH)

**Objective**: Create single source of truth

#### Step 1.1: Create Shared Constants Module
**File**: `packages/web/src/core/constants/us-states.ts` (NEW)

```typescript
/**
 * US States and Territories Constants
 * Single source of truth for state selection across Folk Care
 */

export interface USStateCode {
  code: string;
  name: string;
}

/**
 * Complete list of all 50 US states, DC, and 5 populated territories.
 * Alphabetically sorted for consistent UX.
 * Used in state selectors across onboarding, registration, and admin panels.
 */
export const US_STATES: USStateCode[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  // US Territories (populated, with EVV/compliance considerations)
  { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
];

/**
 * Map state code to full name for lookups
 */
export const STATE_CODE_MAP = new Map(US_STATES.map((s) => [s.code, s.name]));

/**
 * Get state name by code
 * @param code - Two-letter state code (e.g., 'TX', 'FL')
 * @returns Full state name or undefined if not found
 */
export function getStateName(code: string): string | undefined {
  return STATE_CODE_MAP.get(code);
}
```

---

#### Step 1.2: Update `organization-api.ts`

**Before:**
```typescript
export const US_STATES: USStateCode[] = [
  { code: 'TX', name: 'Texas' },
  { code: 'FL', name: 'Florida' },
  // ... incomplete list ...
];
```

**After:**
```typescript
import { US_STATES, USStateCode } from '../constants/us-states';

// Re-export for backward compatibility
export type { USStateCode };
export { US_STATES };
```

---

#### Step 1.3: Update `Signup.tsx`

**Before:**
```typescript
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  // ... 54 entries ...
];
```

**After:**
```typescript
import { US_STATES } from '@/core/constants/us-states';
// Remove local US_STATES definition
```

---

### 4.2 Phase 2: Update Component Imports (Priority: HIGH)

**Objective**: Ensure all components import from centralized constant

#### File: `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx`

**Update import path** (Line 14):
```typescript
// Before:
import { US_STATES } from '../../services/organization-api';

// After:
import { US_STATES } from '../../constants/us-states';
```

---

### 4.3 Phase 3: Verify & Test (Priority: MEDIUM)

**Objective**: Ensure all forms render complete state list

#### Unit Tests
- Test that `US_STATES` array has 56 entries (50 states + DC + 5 territories)
- Test that all state codes are 2 letters
- Test that state names are non-empty strings
- Test `getStateName()` utility for valid and invalid codes

#### Integration Tests
- Signup flow: State selector renders all 56 states
- Registration form: State selector renders all 56 states
- State selection persists in form submission
- No console errors related to missing states

#### Manual Testing
- Visual verification of dropdown in both signup and registration flows
- Verify alphabetical ordering
- Spot-check TX, NY, CA are present (per ticket requirement)
- Test form submission with less common states (ME, MT, HI, PR)

---

### 4.4 Phase 4: Documentation & Cleanup (Priority: LOW)

**Objective**: Document the change and remove duplication

- [ ] Update component JSDoc to reference centralized constant
- [ ] Add comment to `organization-api.ts` indicating re-export for backward compatibility
- [ ] Document `us-states.ts` module with examples
- [ ] Update any external API documentation that references state availability

---

## 5. Data Model

### 5.1 USStateCode Interface

```typescript
interface USStateCode {
  code: string;  // Two-letter USPS state abbreviation (e.g., 'TX', 'CA')
  name: string;  // Full state/territory name (e.g., 'Texas', 'California')
}
```

### 5.2 Complete State List (56 Total)

**50 US States:**
Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, Delaware, Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York, North Carolina, North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming

**District & Territories (6 Total):**
District of Columbia, American Samoa, Guam, Northern Mariana Islands, Puerto Rico, U.S. Virgin Islands

---

## 6. Affected Components

### 6.1 Frontend Components

| Component | File | Change Type | Priority |
|-----------|------|-------------|----------|
| Signup (Step 1) | `packages/web/src/app/pages/Signup.tsx` | Import path update | HIGH |
| OrganizationRegistrationForm | `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx` | Import path update | HIGH |
| StateConfigPanel | `packages/web/src/app/pages/admin/components/StateConfigPanel.tsx` | Verify compatibility | MEDIUM |

### 6.2 Service/API Files

| File | Change Type | Priority |
|------|-------------|----------|
| `packages/web/src/core/services/organization-api.ts` | Convert to re-export from constants | HIGH |
| `packages/web/src/core/constants/us-states.ts` | **CREATE NEW** | HIGH |

### 6.3 Database/Backend

| Impact | Details |
|--------|---------|
| No database changes | State codes already support all US state abbreviations |
| No API changes | State selection remains client-side validation only |
| No migration needed | Existing org records with TX/FL/CA codes remain valid |

---

## 7. Risk Assessment

### 7.1 Low Risk Factors
- ✅ No database schema changes required
- ✅ No API endpoint changes
- ✅ Existing state codes (TX, FL, CA) remain valid
- ✅ Backward compatible re-export from organization-api.ts
- ✅ Purely additive (adding states, not removing)

### 7.2 Implementation Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Typos in state names | Low | Medium | Test against USPS official abbreviations |
| Missing states | Medium | High | Validate count = 56 in unit tests |
| Import path breaks | Low | High | Run full test suite after import updates |
| Performance regression | Very Low | Low | Monitor dropdown render time (should be <100ms) |

---

## 8. Success Metrics

| Metric | Target | Verification |
|--------|--------|---------------|
| All 50 states + DC + territories available | 56 entries | `US_STATES.length === 56` |
| Single source of truth | 1 definition | grep for duplicate `US_STATES` arrays returns only constants file |
| No hardcoded state lists in components | 0 | Code review confirms only imports used |
| Backward compatibility | 100% | Existing state codes resolve correctly |
| Test coverage | ≥90% | Unit tests for state constant and utilities |

---

## 9. Implementation Checklist

### Phase 1: Consolidation
- [ ] Create `packages/web/src/core/constants/us-states.ts`
- [ ] Verify all 56 states + territories present
- [ ] Test state alphabetical ordering
- [ ] Create unit test for state constant

### Phase 2: Updates
- [ ] Update `organization-api.ts` import/re-export
- [ ] Update `Signup.tsx` import
- [ ] Update `OrganizationRegistrationForm.tsx` import
- [ ] Verify `StateConfigPanel.tsx` compatibility

### Phase 3: Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Manual test both signup and registration flows
- [ ] Verify less-common states (HI, ME, PR) render correctly

### Phase 4: Cleanup & Docs
- [ ] Remove old state list comments from organization-api.ts (line 119)
- [ ] Update inline documentation
- [ ] Final code review
- [ ] Update ticket with completion notes

---

## 10. Appendix: Ticket Context

**Original Ticket**: wdvf3abehp  
**Title**: "New Client intake form State should offer all states in the US, not just TX, NY, and CA"  

**Current Limitation**: The organization registration form (intake for new organizations) only showed a partial state list, while the public signup flow had the complete list. This inconsistency confused users and limited onboarding to certain states.

**Resolution**: Consolidate state lists into a single source of truth (`us-states.ts` constant) and import it everywhere, ensuring all 50 states + DC + territories are available across all forms.

---

## Document Version History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-10-13 | Subagent | Initial spec created post-analysis |

