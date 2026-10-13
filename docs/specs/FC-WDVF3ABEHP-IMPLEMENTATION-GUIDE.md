# Implementation Guide: State Selector Expansion (wdvf3abehp)

**Purpose**: Step-by-step instructions for expanding the state dropdown to all 50 US states  
**Target Audience**: Development team  
**Status**: Ready for implementation  

---

## Quick Start

**TL;DR**: Create one new file (`us-states.ts`), update imports in 3 files, run tests.  
**Estimated Time**: 30 minutes  
**Complexity**: Low  

---

## Step-by-Step Instructions

### Step 1: Create Centralized State Constants

**File to Create**: `packages/web/src/core/constants/us-states.ts`

**Actions**:
1. Create directory `packages/web/src/core/constants/` if it doesn't exist
2. Create file `us-states.ts`
3. Copy the complete state list below

```typescript
/**
 * US States and Territories Constants
 * Single source of truth for state selection across Folk Care
 * 
 * Includes:
 * - All 50 US states
 * - District of Columbia (DC)
 * - 5 populated US territories: AS, GU, MP, PR, VI
 * 
 * Total: 56 entries, alphabetically sorted
 * 
 * Used in:
 * - Signup flow (Signup.tsx)
 * - Organization registration form (OrganizationRegistrationForm.tsx)
 * - Admin state configuration panels
 */

export interface USStateCode {
  code: string;
  name: string;
}

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
  { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
];

/**
 * Quick lookup: state code → full name
 * Usage: STATE_CODE_MAP.get('TX') → 'Texas'
 */
export const STATE_CODE_MAP = new Map(US_STATES.map((s) => [s.code, s.name]));

/**
 * Utility: Get state name by code
 * @param code - Two-letter state code (e.g., 'TX', 'CA', 'PR')
 * @returns Full state/territory name, or undefined if code not found
 * 
 * Example:
 *   getStateName('TX')  // → 'Texas'
 *   getStateName('ZZ')  // → undefined
 */
export function getStateName(code: string): string | undefined {
  return STATE_CODE_MAP.get(code);
}
```

**Verification**:
```bash
# Check file exists and has no syntax errors
npx tsc --noEmit packages/web/src/core/constants/us-states.ts
```

---

### Step 2: Update `organization-api.ts`

**File**: `packages/web/src/core/services/organization-api.ts`

**Current (Lines 10-13 & 106-120)**:
```typescript
export interface USStateCode {
  code: string;
  name: string;
}

// ... other code ...

export const US_STATES: USStateCode[] = [
  { code: 'TX', name: 'Texas' },
  { code: 'FL', name: 'Florida' },
  // Additional states can be added as the platform scales
  { code: 'AL', name: 'Alabama' },
  // ... (remaining states can be added as needed)
];
```

**Replace with (after imports)**:
```typescript
// Re-export from centralized constants
import { US_STATES, USStateCode } from '../constants/us-states';

export type { USStateCode };
export { US_STATES };
```

**Complete change**:
1. Delete lines 10-13 (interface definition)
2. Delete lines 103-120 (old US_STATES array and comment)
3. Add imports at the top of the file (after existing imports):
   ```typescript
   import { US_STATES, USStateCode } from '../constants/us-states';
   ```
4. Add exports after imports:
   ```typescript
   export type { USStateCode };
   export { US_STATES };
   ```

**Why**: Provides backward compatibility. Existing code importing from `organization-api` continues to work.

---

### Step 3: Update `Signup.tsx`

**File**: `packages/web/src/app/pages/Signup.tsx`

**Current (Lines 1-62)**:
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks';
import toast from 'react-hot-toast';

// US States for dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  // ... 52 more entries ...
];
```

**Replace with**:
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks';
import toast from 'react-hot-toast';
import { US_STATES } from '@/core/constants/us-states';

// (remove local US_STATES definition)
```

**Steps**:
1. Add import: `import { US_STATES } from '@/core/constants/us-states';` after other imports
2. Delete lines 6-62 (the entire local `US_STATES` array definition)
3. Ensure line 334 (the dropdown rendering) still exists unchanged

---

### Step 4: Update `OrganizationRegistrationForm.tsx`

**File**: `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx`

**Current (Line 14)**:
```typescript
import { US_STATES } from '../../services/organization-api';
```

**Replace with**:
```typescript
import { US_STATES } from '../../constants/us-states';
```

**Steps**:
1. Update the import path on line 14 only
2. No other changes needed

---

### Step 5: Verify `StateConfigPanel.tsx`

**File**: `packages/web/src/app/pages/admin/components/StateConfigPanel.tsx`

**Action**: Check this file for any hardcoded state references

```bash
grep -n "code.*name\|states\." packages/web/src/app/pages/admin/components/StateConfigPanel.tsx | head -20
```

**Expected**: Should use `states.find()` with a properly sourced states array, not hardcoded values.

**If issues found**: Update to import from `us-states.ts` constants.

---

## Validation Checklist

After making all changes, run these checks:

### Type Checking
```bash
cd /Users/markjordan/folk-care
npx tsc --noEmit
```

**Expected**: No errors related to `US_STATES` or `USStateCode`

### ESLint
```bash
npm run lint packages/web/src/core/constants/us-states.ts
npm run lint packages/web/src/core/services/organization-api.ts
npm run lint packages/web/src/app/pages/Signup.tsx
npm run lint packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx
```

**Expected**: No errors

### Unit Tests
```bash
# Run tests for affected files
npm run test -- Signup.test
npm run test -- OrganizationRegistrationForm.test
npm run test -- organization-api.test
```

**Expected**: All tests pass

### Manual Verification

1. **Signup Flow**:
   - Navigate to signup page
   - Step 1: Verify state dropdown shows all 56 states
   - Select "California" (CA should be present)
   - Proceed to next step

2. **Organization Registration Form**:
   - Navigate to registration form (admin panel)
   - Verify state dropdown shows all 56 states
   - Select "Texas" (TX should be present)
   - Submit form with valid data

3. **Dev Tools Check**:
   ```javascript
   // In browser console, after importing the constants
   Object.keys(US_STATES).length  // Should return 56
   US_STATES.filter(s => ['TX', 'CA', 'NY'].includes(s.code))
   // Should return all three
   ```

---

## Testing Additions (Optional but Recommended)

### Create unit test for constants

**File**: `packages/web/src/core/constants/__tests__/us-states.test.ts`

```typescript
import { US_STATES, STATE_CODE_MAP, getStateName } from '../us-states';

describe('US States Constants', () => {
  it('should have exactly 56 entries (50 states + DC + 5 territories)', () => {
    expect(US_STATES).toHaveLength(56);
  });

  it('should have all 50 states', () => {
    const stateCodes = US_STATES.map((s) => s.code);
    const fiftyStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    ];
    fiftyStates.forEach((code) => {
      expect(stateCodes).toContain(code);
    });
  });

  it('should have DC and 5 territories', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(codes).toContain('DC'); // District of Columbia
    expect(codes).toContain('AS'); // American Samoa
    expect(codes).toContain('GU'); // Guam
    expect(codes).toContain('MP'); // Northern Mariana Islands
    expect(codes).toContain('PR'); // Puerto Rico
    expect(codes).toContain('VI'); // U.S. Virgin Islands
  });

  it('should be sorted alphabetically by code', () => {
    const codes = US_STATES.map((s) => s.code);
    const sorted = [...codes].sort();
    expect(codes).toEqual(sorted);
  });

  it('should have valid state codes (2 letters)', () => {
    US_STATES.forEach((state) => {
      expect(state.code).toMatch(/^[A-Z]{2}$/);
      expect(state.name).toBeTruthy();
      expect(state.name.length).toBeGreaterThan(0);
    });
  });

  it('STATE_CODE_MAP should map all codes to names', () => {
    expect(STATE_CODE_MAP.size).toBe(56);
    US_STATES.forEach((state) => {
      expect(STATE_CODE_MAP.get(state.code)).toBe(state.name);
    });
  });

  it('getStateName should return correct names', () => {
    expect(getStateName('TX')).toBe('Texas');
    expect(getStateName('CA')).toBe('California');
    expect(getStateName('FL')).toBe('Florida');
    expect(getStateName('PR')).toBe('Puerto Rico');
  });

  it('getStateName should return undefined for invalid codes', () => {
    expect(getStateName('ZZ')).toBeUndefined();
    expect(getStateName('XX')).toBeUndefined();
  });
});
```

**Run test**:
```bash
npm run test -- us-states.test
```

---

## Rollback Plan

If issues occur, rollback is simple:

1. **Restore `us-states.ts`**: Delete the file
2. **Restore `organization-api.ts`**: Revert to commit before changes
3. **Restore `Signup.tsx`**: Revert import and re-add local `US_STATES` array
4. **Restore `OrganizationRegistrationForm.tsx`**: Revert import path

**Git commands**:
```bash
git revert HEAD~3  # If changes were in last 3 commits
# OR
git checkout HEAD packages/web/src/core/services/organization-api.ts
git checkout HEAD packages/web/src/app/pages/Signup.tsx
git checkout HEAD packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx
rm packages/web/src/core/constants/us-states.ts
```

---

## Summary of Changes

| File | Operation | Lines | Impact |
|------|-----------|-------|--------|
| `us-states.ts` | CREATE | ~70 | New single source of truth |
| `organization-api.ts` | MODIFY | 10-120 | Import & re-export from constants |
| `Signup.tsx` | MODIFY | 1-62 | Import from constants, delete local array |
| `OrganizationRegistrationForm.tsx` | MODIFY | 14 | Update import path |
| Tests | ADD (optional) | ~80 | Validate state constant integrity |

**Total changes**: ~4 files modified, 1 new file created, <200 lines of code  
**Risk level**: Low  
**Rollback difficulty**: Very easy  

