# Architecture & Data Flow Diagrams (wdvf3abehp)

Visual reference for state selector expansion architecture.

---

## Current Architecture (BEFORE)

### Duplicate State Lists Problem

```
┌─────────────────────────────────────────────────────────────┐
│                    Folk Care Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │   Signup.tsx         │    │  OrganizationRegistration│   │
│  ├──────────────────────┤    │  Form.tsx                │   │
│  │ US_STATES (54 list)  │    ├──────────────────────────┤   │
│  │ - AL, AK, AZ, ...    │    │ Imports from:            │   │
│  │ - TX, CA, NY ✓       │    │ organization-api.ts      │   │
│  │ - PR, VI, GU         │    │ US_STATES (~10 list)     │   │
│  │                      │    │ - TX, FL, AL... ✗ Missing│   │
│  │ Hardcoded locally    │    │                          │   │
│  └──────────────────────┘    │ Can't select many states │   │
│                              └──────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────┐                   │
│  │  organization-api.ts                 │                   │
│  ├──────────────────────────────────────┤                   │
│  │  US_STATES (incomplete)              │                   │
│  │  interface USStateCode               │                   │
│  │                                      │                   │
│  │  Export point for registration form  │                   │
│  └──────────────────────────────────────┘                   │
│                                                               │
│  PROBLEM: Two different state lists!                         │
│  - Signup has complete list (54)                            │
│  - Registration has incomplete list (~10)                   │
│  - Users frustrated when they can't select their state      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## New Architecture (AFTER)

### Single Source of Truth Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Folk Care Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         us-states.ts (NEW CENTRALIZED)                │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  US_STATES = [                                        │  │
│  │    { code: 'AL', name: 'Alabama' },                   │  │
│  │    { code: 'AK', name: 'Alaska' },                    │  │
│  │    ... (56 total: 50 states + DC + 5 territories)     │  │
│  │    { code: 'TX', name: 'Texas' },                     │  │
│  │    { code: 'CA', name: 'California' },                │  │
│  │    { code: 'NY', name: 'New York' },                  │  │
│  │    { code: 'PR', name: 'Puerto Rico' },               │  │
│  │  ]                                                     │  │
│  │                                                        │  │
│  │  interface USStateCode { ... }                        │  │
│  │  STATE_CODE_MAP = Map(...)                            │  │
│  │  getStateName(code: string) { ... }                   │  │
│  │                                                        │  │
│  │  EXPORT: US_STATES, USStateCode, getStateName         │  │
│  └───────────────────────────────────────────────────────┘  │
│           ▲                    ▲                    ▲         │
│           │                    │                    │         │
│      ┌────┴────┐          ┌────┴────┐         ┌────┴────┐   │
│      │ Import  │          │ Import  │         │ Import  │   │
│      │ (1 line)│          │ (1 line)│         │ (1 line)│   │
│      │         │          │         │         │         │   │
│  ┌───┴───────┐ │    ┌──────┴──────┐ │    ┌────┴──────┐ │   │
│  │ Signup    │◄┘    │Organization ◄┘    │ StateConfig│◄┘   │
│  │ .tsx      │      │ Registration │    │ Panel.tsx  │     │
│  │           │      │ Form.tsx     │    │            │     │
│  │ State     │      │              │    │ Uses       │     │
│  │ dropdown  │      │ State         │    │ states.    │     │
│  │ (56 opts) │      │ dropdown      │    │ find()     │     │
│  │           │      │ (56 opts)     │    │            │     │
│  │ ✓ All     │      │ ✓ All         │    │ ✓ All      │     │
│  │ states    │      │ states        │    │ states     │     │
│  └───────────┘      └───────────────┘    └────────────┘     │
│                                                               │
│  BENEFITS:                                                    │
│  ✓ Single source of truth                                    │
│  ✓ No duplication                                            │
│  ✓ All states available everywhere                           │
│  ✓ Easy to update (one location)                             │
│  ✓ Type-safe (interface enforced)                            │
│  ✓ Backward compatible (re-exports)                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: User Selecting State

### Current (Broken) Flow

```
User visits Signup Form
        ↓
Sees complete state dropdown (54)  ← Signup.tsx has it
        ↓
Can select TX, CA, NY, etc.
        ↓
Form submitted
        ↓
Creates organization ✓

BUT ALSO:

User visits Admin Setup (Organization Registration)
        ↓
Sees incomplete state dropdown (~10)  ← organization-api.ts missing states
        ↓
Cannot select WA, OR, CO, etc.
        ↓
Frustrated ✗ Can't complete setup
```

### Fixed Flow

```
User visits Signup Form
        ↓
Imports from: @/core/constants/us-states
        ↓
Sees complete dropdown (56 states)
        ↓
Can select: TX, CA, NY, WA, OR, PR, VI, etc.
        ↓
Form submitted
        ↓
Creates organization ✓

AND:

User visits Admin Setup (Organization Registration)
        ↓
Imports from: @/core/constants/us-states
        ↓
Sees complete dropdown (56 states)
        ↓
Can select: TX, CA, NY, WA, OR, PR, VI, etc.
        ↓
Form submitted
        ↓
Creates organization ✓

SAME EXPERIENCE EVERYWHERE ✓
```

---

## Import Dependency Graph

### Before (Messy)

```
OrganizationRegistrationForm.tsx
        ↓
        ├─→ organization-api.ts
        │       ├─→ US_STATES (incomplete) ✗
        │       └─→ USStateCode (interface)

Signup.tsx
        ↓
        └─→ Local US_STATES (hardcoded) ✗

StateConfigPanel.tsx
        ↓
        └─→ Unknown source (needs verification)

PROBLEM: Three different sources for state data!
```

### After (Clean)

```
┌─────────────────────────────────────────────┐
│      us-states.ts (SINGLE SOURCE)           │
│  ✓ US_STATES (56 entries)                   │
│  ✓ USStateCode interface                    │
│  ✓ Utilities (getStateName, etc)            │
└──────┬──────────────────────────────────────┘
       │
       ├─→ organization-api.ts (re-exports)
       │       ├─→ OrganizationRegistrationForm.tsx
       │       └─→ Other components
       │
       ├─→ Signup.tsx
       │       └─→ Direct import
       │
       └─→ StateConfigPanel.tsx
               └─→ Direct import

CLEAN: All components pull from one location!
```

---

## Component Dependency Tree

### File Changes Required

```
packages/web/src/
├── core/
│   ├── constants/
│   │   └── us-states.ts ← CREATE NEW
│   │       └── Exports: US_STATES, USStateCode, getStateName()
│   │
│   ├── services/
│   │   └── organization-api.ts ← MODIFY
│   │       └── Now re-exports from us-states.ts
│   │
│   └── components/
│       └── forms/
│           └── OrganizationRegistrationForm.tsx ← MODIFY (1 line)
│               └── Import path: organization-api → us-states
│
└── app/
    └── pages/
        ├── Signup.tsx ← MODIFY
        │   └── Import from constants (was local)
        │
        └── admin/
            └── components/
                └── StateConfigPanel.tsx ← VERIFY
                    └── Ensure compatibility with new structure
```

---

## Code Execution Flow

### User Selects State (After Implementation)

```
┌─────────────────────────────────────────┐
│  React Component Mounts                  │
│  (Signup.tsx or RegistrationForm.tsx)   │
└────────────────┬────────────────────────┘
                 ↓
     ┌───────────────────────────┐
     │ import { US_STATES }      │
     │ from @/core/constants/... │
     └────────────┬──────────────┘
                  ↓
     ┌─────────────────────────────────────┐
     │ us-states.ts loads in memory        │
     │ Array of 56 state objects           │
     │ [                                   │
     │   {code:'AL', name:'Alabama'},      │
     │   ...                               │
     │   {code:'VI', name:'Virgin Is...'}  │
     │ ]                                   │
     └────────────┬──────────────────────┘
                  ↓
     ┌─────────────────────────────────────┐
     │ Component renders Select/dropdown   │
     │ Maps US_STATES to <option>          │
     │                                     │
     │ <select>                            │
     │   <option value="AL">Alabama</option>
     │   <option value="AK">Alaska</option>
     │   ... (all 56 options)              │
     │   <option value="VI">Virgin...</option>
     │ </select>                           │
     └────────────┬──────────────────────┘
                  ↓
     ┌─────────────────────────────────────┐
     │ User clicks dropdown → sees all 56  │
     │ User selects "California"           │
     │ onChange event fires                │
     │ stateCode = "CA" in form state      │
     └────────────┬──────────────────────┘
                  ↓
     ┌─────────────────────────────────────┐
     │ Form submitted                      │
     │ POST /api/organizations             │
     │ { stateCode: "CA", ... }            │
     └─────────────────────────────────────┘
```

---

## Success Indicators

After implementation, the architecture should look like:

```
BEFORE                          AFTER
┌────────────┐                 ┌──────────────────┐
│ Signup.tsx │                 │  us-states.ts    │
│ 54 states  │                 │  56 states       │
└────────────┘         ────→   └──────────────────┘
                       /            ↑ ↑ ↑
┌────────────┐        /             │ │ │
│ org-api.ts │────→  /              │ │ └─ Components
│ 10 states  │ PROBLEM             │ │
└────────────┘                      │ └─ organization-api.ts
                               (reexports for compatibility)
                                    │
                                    └─ No duplication ✓
                                       No hardcoded lists ✓
                                       Type-safe ✓
                                       Scalable ✓
```

---

## Verification Checklist

After implementation, verify:

```
Architecture
  ☐ us-states.ts exists with 56 entries
  ☐ organization-api.ts re-exports from us-states
  ☐ No other hardcoded state arrays exist
  ☐ All imports resolve correctly

Functionality
  ☐ Signup form dropdown shows 56 states
  ☐ Registration form dropdown shows 56 states
  ☐ State selection persists in form
  ☐ Form submission succeeds
  ☐ No console errors or warnings

Type Safety
  ☐ TypeScript compilation succeeds
  ☐ USStateCode interface enforced
  ☐ No type errors in components

Data Integrity
  ☐ All 50 states present ✓
  ☐ DC present ✓
  ☐ 5 territories present ✓
  ☐ Alphabetical order verified ✓
  ☐ No duplicates ✓
```

