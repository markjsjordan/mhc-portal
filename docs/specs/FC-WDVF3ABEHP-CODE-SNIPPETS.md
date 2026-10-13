# Code Snippets: State Selector Expansion (wdvf3abehp)

**Quick reference**: Exact code changes for implementing the state selector expansion.

---

## 1. New File: `packages/web/src/core/constants/us-states.ts`

**Status**: CREATE (new file)

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
 * - Signup flow (packages/web/src/app/pages/Signup.tsx)
 * - Organization registration form (packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx)
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

---

## 2. Update: `packages/web/src/core/services/organization-api.ts`

**Status**: MODIFY (Lines 1-15 and 100-120)

### BEFORE:

```typescript
/**
 * Organization API Client
 * 
 * Handles API calls for organization registration and team invitations
 */

import type { ApiClient } from './api-client';

// Re-export types from core package (in a real scenario, these would be shared)
export interface USStateCode {
  code: string;
  name: string;
}

export interface Address {
  // ...
}

// ... more code ...

/**
 * US States list for state selector
 * Currently configured for TX and FL, designed to scale to all 50 states
 */
export const US_STATES: USStateCode[] = [
  { code: 'TX', name: 'Texas' },
  { code: 'FL', name: 'Florida' },
  // Additional states can be added as the platform scales
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'GA', name: 'Georgia' },
  // ... (remaining states can be added as needed)
];
```

### AFTER:

```typescript
/**
 * Organization API Client
 * 
 * Handles API calls for organization registration and team invitations
 */

import type { ApiClient } from './api-client';
import { US_STATES, USStateCode } from '../constants/us-states';

// Re-export for backward compatibility
export type { USStateCode };
export { US_STATES };

export interface Address {
  // ... rest of file unchanged ...
}

// ... rest of file unchanged ...
```

**Key changes**:
1. Add import: `import { US_STATES, USStateCode } from '../constants/us-states';`
2. Delete the `USStateCode` interface definition (moved to constants)
3. Delete the old `US_STATES` array definition
4. Add re-exports for backward compatibility

---

## 3. Update: `packages/web/src/app/pages/Signup.tsx`

**Status**: MODIFY (Lines 1-62)

### BEFORE:

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks';
import toast from 'react-hot-toast';

// US States for dropdown
const US_STATES = [
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
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'GU', name: 'Guam' },
];

interface SignupFormData {
  // ...
}
```

### AFTER:

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks';
import toast from 'react-hot-toast';
import { US_STATES } from '@/core/constants/us-states';

interface SignupFormData {
  // ...
}
```

**Key changes**:
1. Add import: `import { US_STATES } from '@/core/constants/us-states';`
2. Delete the entire local `US_STATES` array definition (lines 6-62)
3. Keep everything else unchanged

---

## 4. Update: `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx`

**Status**: MODIFY (Line 14 only)

### BEFORE:

```typescript
import { useState } from 'react';
import { Button } from '../Button';
import { Input } from './Input';
import { Select } from './Select';
import { FormField } from './FormField';
import type { CreateOrganizationRequest, Address } from '../../services/organization-api';
import { US_STATES } from '../../services/organization-api';
```

### AFTER:

```typescript
import { useState } from 'react';
import { Button } from '../Button';
import { Input } from './Input';
import { Select } from './Select';
import { FormField } from './FormField';
import type { CreateOrganizationRequest, Address } from '../../services/organization-api';
import { US_STATES } from '../../constants/us-states';
```

**Key change**:
1. Update import path from `'../../services/organization-api'` to `'../../constants/us-states'`

---

## 5. Verification: Test File (Optional)

**File to create**: `packages/web/src/core/constants/__tests__/us-states.test.ts`

```typescript
import { US_STATES, STATE_CODE_MAP, getStateName } from '../us-states';

describe('US States Constants', () => {
  it('should have exactly 56 entries (50 states + DC + 5 territories)', () => {
    expect(US_STATES).toHaveLength(56);
  });

  it('should have all 50 states including TX, CA, NY', () => {
    const stateCodes = US_STATES.map((s) => s.code);
    expect(stateCodes).toContain('TX');
    expect(stateCodes).toContain('CA');
    expect(stateCodes).toContain('NY');
    expect(stateCodes.length).toBe(56);
  });

  it('should have DC and territories', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(codes).toContain('DC');
    expect(codes).toContain('AS');
    expect(codes).toContain('GU');
    expect(codes).toContain('MP');
    expect(codes).toContain('PR');
    expect(codes).toContain('VI');
  });

  it('should be sorted alphabetically', () => {
    const codes = US_STATES.map((s) => s.code);
    const sorted = [...codes].sort();
    expect(codes).toEqual(sorted);
  });

  it('should have valid entries', () => {
    US_STATES.forEach((state) => {
      expect(state.code).toMatch(/^[A-Z]{2}$/);
      expect(state.name).toBeTruthy();
      expect(state.name.length).toBeGreaterThan(0);
    });
  });

  it('STATE_CODE_MAP should have all 56 entries', () => {
    expect(STATE_CODE_MAP.size).toBe(56);
  });

  it('getStateName should work correctly', () => {
    expect(getStateName('TX')).toBe('Texas');
    expect(getStateName('CA')).toBe('California');
    expect(getStateName('NY')).toBe('New York');
    expect(getStateName('PR')).toBe('Puerto Rico');
    expect(getStateName('ZZ')).toBeUndefined();
  });
});
```

---

## Checklist for Copy-Paste Implementation

- [ ] Create `packages/web/src/core/constants/us-states.ts` with all 56 states
- [ ] Update `packages/web/src/core/services/organization-api.ts` - Add import
- [ ] Update `packages/web/src/core/services/organization-api.ts` - Delete USStateCode interface
- [ ] Update `packages/web/src/core/services/organization-api.ts` - Delete old US_STATES array
- [ ] Update `packages/web/src/core/services/organization-api.ts` - Add re-exports
- [ ] Update `packages/web/src/app/pages/Signup.tsx` - Add import
- [ ] Update `packages/web/src/app/pages/Signup.tsx` - Delete local US_STATES array
- [ ] Update `packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx` - Change import path
- [ ] Run `npx tsc --noEmit` to verify types
- [ ] Run `npm run lint` on modified files
- [ ] Run test suite: `npm run test`
- [ ] Manual test signup flow: verify all 56 states shown
- [ ] Manual test registration form: verify all 56 states shown

