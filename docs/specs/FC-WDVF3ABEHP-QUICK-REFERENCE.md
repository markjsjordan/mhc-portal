# Quick Reference: State Selector Expansion (wdvf3abehp)

**Print this page or bookmark for quick lookup during implementation.**

---

## The Change in 30 Seconds

**Problem**: State dropdown incomplete in registration form  
**Solution**: Create single state list constant, import everywhere  
**Files**: 1 create, 3 updates  
**Time**: ~30 minutes  
**Risk**: Very low  

---

## File Changes at a Glance

```
CREATE:
  📄 packages/web/src/core/constants/us-states.ts [~70 lines]
     └─ All 56 states + interface + utilities

MODIFY:
  📝 packages/web/src/core/services/organization-api.ts
     └─ Add import, delete old array, add re-exports
  
  📝 packages/web/src/app/pages/Signup.tsx
     └─ Add import, delete local array
  
  📝 packages/web/src/core/components/forms/OrganizationRegistrationForm.tsx
     └─ Change import path only (1 line!)
```

---

## Import Paths (Copy These)

```typescript
// NEW (use this everywhere)
import { US_STATES } from '@/core/constants/us-states';

// OLD (don't use)
import { US_STATES } from '../../services/organization-api';
```

---

## The 56 States

**50 States + DC + 5 Territories = 56 Total**

All 50 US states alphabetically: AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY

Plus: DC, AS, GU, MP, PR, VI

---

## Implementation Checklist

```
Phase 1: Create Constant
  ☐ Create packages/web/src/core/constants/us-states.ts
  ☐ Copy all 56 states from CODE-SNIPPETS.md
  ☐ Include interface, STATE_CODE_MAP, getStateName()

Phase 2: Update Imports
  ☐ organization-api.ts: Add import, delete old code
  ☐ Signup.tsx: Add import, delete local array
  ☐ OrganizationRegistrationForm.tsx: Update import path

Phase 3: Validate
  ☐ npx tsc --noEmit (type check)
  ☐ npm run lint (linting)
  ☐ npm run test (unit tests)
  ☐ Test signup flow manually
  ☐ Test registration form manually

Phase 4: Verify
  ☐ All 56 states in signup dropdown ✓
  ☐ All 56 states in registration dropdown ✓
  ☐ TX, CA, NY selectable ✓
  ☐ Form submission works ✓
  ☐ No console errors ✓
```

---

## Key Numbers

| Metric | Value |
|--------|-------|
| New constant entries | 56 |
| Files to create | 1 |
| Files to modify | 3 |
| Import paths to change | 4 |
| Lines of code to add/change | ~120 |
| Estimated time | 30 min |
| Risk level | Very low |

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Cannot find module" error | Check import path: `@/core/constants/us-states` |
| Type error on US_STATES | Make sure `USStateCode` interface is exported |
| Dropdown shows old list | Did you clear browser cache? Try hard refresh (Cmd+Shift+R) |
| Test failures | Run `npm run test -- us-states.test` to debug |

---

## Where to Find Documentation

| Document | Purpose | Read When |
|----------|---------|-----------|
| **STATE-SELECTOR-EXPANSION.md** | Complete technical spec | You want full context |
| **IMPLEMENTATION-GUIDE.md** | Step-by-step instructions | You're implementing |
| **CODE-SNIPPETS.md** | Copy-paste ready code | You need exact code |
| **SUMMARY.md** | High-level overview | You want the TL;DR |
| **THIS FILE** | Quick reference | You're implementing now |

---

## Verify Success

After implementation, run this in browser console:

```javascript
// Should see all 56 states
US_STATES.length  // → 56

// Should be true
US_STATES.some(s => s.code === 'TX')   // → true
US_STATES.some(s => s.code === 'CA')   // → true
US_STATES.some(s => s.code === 'NY')   // → true
US_STATES.some(s => s.code === 'PR')   // → true (territory)

// Should be alphabetical
US_STATES[0].code === 'AL'  // → true
US_STATES[55].code === 'VI' // → true
```

---

## Questions?

Refer to:
- **How do I implement it?** → IMPLEMENTATION-GUIDE.md
- **What exactly changes?** → CODE-SNIPPETS.md  
- **Why are we doing this?** → STATE-SELECTOR-EXPANSION.md (Executive Summary)
- **Did we miss something?** → SUMMARY.md (What We Found / What We Specified)

---

## One-Liner Summary

Create `us-states.ts` with all 56 states, import it in 4 places instead of duplicating code → users can select their state during signup/registration.

✅ **Ready to implement!**

