# Technical Specification: Schedule Visit Types Expansion
## Ticket: wdvf3abhn2

**Status:** Ready for Implementation  
**Effort Estimate:** 12-16 story points (2 weeks)  
**Risk Level:** Low (schema-only change, no breaking changes)

---

## 1. Problem Statement

The Folk Care scheduling system currently supports only **Supervisory Nurse Visit** as a visit type. This severely limits scheduling flexibility and clinical accuracy for home healthcare agencies that need to track and manage diverse visit types including respite care, initial assessments, and regular maintenance visits.

Current limitations:
- **Single visit type** makes reporting and analytics meaningless
- **Billing implications:** Different visit types have different reimbursement rates
- **Compliance gaps:** No distinction between Initial, Assessment, and Regular visits for regulatory tracking
- **Clinical workflows:** Supervisory visits for oversight are lumped with routine care visits
- **Care coordination:** Cannot distinguish between different levels of clinical intensity

This restricts Folk Care's market fit and increases manual workarounds by users.

**Business Impact:** Agencies using Folk Care cannot fully replace legacy systems because visit type differentiation is critical for billing, compliance, and care coordination.

---

## 2. Current State Analysis

### 2.1 Database Schema
**File:** `/packages/core/migrations/20251030214714_scheduling_visits.ts` (lines 262-263)

```sql
table.check(`visit_type IN (
  'REGULAR',      -- Standard recurring home care visit
  'INITIAL',      -- First visit with new client
  'DISCHARGE',    -- Client dismissal/termination
  'RESPITE',      -- Respite care period
  'EMERGENCY',    -- Emergency response visit
  'MAKEUP',       -- Makeup visit for missed original
  'SUPERVISION',  -- Supervisory/oversight visit
  'ASSESSMENT'    -- Assessment or re-assessment visit
)`)
```

**Current Implementation Status:** ✅ Database constraint exists but only one type used in practice

### 2.2 Frontend Implementation
**Files:**
- `/showcase/src/config/visitTypeConfig.ts` - Configuration for visit types
- `/showcase/src/components/visits/VisitFilters.tsx` - Filter implementation
- `/showcase/src/types/showcase-types.ts` - TypeScript definitions

**Current State:**
```typescript
// Likely only includes:
export const VISIT_TYPES = {
  SUPERVISORY_NURSE_VISIT: {
    label: 'Supervisory Nurse Visit',
    icon: Stethoscope,
    colorClass: 'text-blue-600',
  },
};
```

### 2.3 API Layer
No dedicated visit type management endpoints found. Likely relies on direct INSERT/UPDATE with hardcoded type values.

### 2.4 Caregiver Assignment Impact
**File:** `/packages/core/migrations/20251030214713_create_caregivers_table.ts` (lines 56-66)

Caregivers have:
- `certifications` (JSONB array) - credentials that might be required by visit type
- `skills` (JSONB array) - specific skills for different visit types
- `specializations` (VARCHAR array) - e.g., "WOUND_CARE", "PALLIATIVE_CARE"

These are **not currently filtered by visit type** during scheduling.

---

## 3. Desired State Description

### 3.1 Supported Visit Types (5 core types + optional extensions)

#### Core Visit Types
| Type | Label | Icon | Description | Typical Duration | Care Level |
|------|-------|------|-------------|------------------|-----------|
| `REGULAR` | Regular Visit | Heart | Standard recurring home care (ADL assistance, medication reminders) | 30-120 min | Standard |
| `INITIAL` | Initial Visit | Clipboard | First visit with new client; comprehensive assessment | 60-120 min | High |
| `ASSESSMENT` | Assessment Visit | CheckCircle | Periodic re-assessment of client needs and care plan | 45-90 min | Medium-High |
| `RESPITE` | Respite Care | Umbrella | Temporary relief for family caregivers | 4-12 hours | Variable |
| `SUPERVISION` | Supervisory Nurse Visit | Stethoscope | Nursing oversight of care delivery | 30-60 min | High |

#### Extended Visit Types (Phase 2, optional)
| Type | Use Case |
|------|----------|
| `EMERGENCY` | Urgent response to client crisis |
| `DISCHARGE` | End-of-service visit |
| `MAKEUP` | Rescheduled visit for missed appointment |
| `CONCIERGE` | Premium personal services (errands, companionship) |

### 3.2 UI Display Pattern

#### Visit Filter Dropdown (Schedules Page)
```
[🔽 Filters]
  ↓
  Visit Type
  ☑ Regular Visit              ☐ Respite Care
  ☐ Initial Visit              ☐ Supervisory Nurse
  ☐ Assessment Visit           ☐ Emergency Response
  ☐ Discharge Visit            ☐ Make-up Visit
  ☐ Concierge Visit
```

#### Visit Type Badge (List/Calendar Views)
```
┌────────────────────────────────────┐
│ Client: John Doe                   │
│ [💚 Regular Visit] Oct 15, 10am-11am
│ Caregiver: Sarah M.                │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Client: Jane Smith                 │
│ [📋 Initial Visit] Oct 16, 1pm-3pm  │
│ Caregiver: Unassigned              │
└────────────────────────────────────┘
```

#### Visit Type Selection in Create/Edit Modal
```
Schedule New Visit
─────────────────────────
Client: [John Doe dropdown]
Date: [2024-10-20]
Start Time: [10:00 AM]
End Time: [11:00 AM]

Visit Type: *
  ○ Regular Visit
  ○ Initial Visit
  ○ Assessment Visit
  ○ Respite Care
  ○ Supervisory Nurse Visit
  ○ Emergency Response
  ○ Discharge Visit
  ○ Make-up Visit
  ○ Concierge Visit

Required Certifications/Skills:
  [Auto-populated based on visit type]
  ☑ CPR Certification
  ☐ Wound Care
  ☐ Medication Management

Duration: [1 hour]
```

### 3.3 Filtering & Querying

**Visit Type filtering becomes available in:**
- Schedules page filters
- Reports (by visit type volume, type, revenue)
- Analytics dashboards
- Billing module (different rates per type)

**Example Query:**
```sql
SELECT 
  visit_type,
  COUNT(*) as count,
  SUM(scheduled_duration) / 60 as hours,
  SUM(billable_hours) as billable_hours
FROM visits
WHERE organization_id = $1
  AND scheduled_date >= $2
  AND scheduled_date <= $3
GROUP BY visit_type
ORDER BY count DESC;
```

---

## 4. Acceptance Criteria

### 4.1 Database Changes
- [ ] Visit type constraint already exists in migration (verified in line 262)
- [ ] No data migration needed (current system doesn't use visit types)
- [ ] New visits can be created with all 5+ supported visit types
- [ ] Visit type is returned in all visit queries
- [ ] Existing queries continue to work (backward compatible)

### 4.2 Frontend - Visit Type Configuration
- [ ] All visit types defined in config with icons, labels, colors
- [ ] Icon system supports all types (Lucide React icons available)
- [ ] Color scheme consistent with design system (green=regular, blue=initial, etc.)
- [ ] Visit type strings exported as TypeScript const for type safety

### 4.3 Frontend - UI Components
- [ ] Visit type selector in create/edit visit modal
- [ ] Visit type filter in schedules page (integrated with FilterDropdown from ticket wdvf3abhn4)
- [ ] Visit type badge displays correctly in list/calendar views
- [ ] Visit type dropdown shows helpful descriptions on hover

### 4.4 Frontend - Caregiver Assignment Logic
- [ ] Visit type influences caregiver matching (respite care requires different skills)
- [ ] Assignment form shows required certifications based on visit type
- [ ] Caregiver filter shows only eligible caregivers for selected visit type
- [ ] Admin can override eligibility rules if needed

### 4.5 API Endpoints
- [ ] `POST /api/visits` accepts `visit_type` parameter
- [ ] `PATCH /api/visits/:id` allows updating `visit_type`
- [ ] `GET /api/visits?visit_type=INITIAL,ASSESSMENT` filters by type(s)
- [ ] Response includes `visit_type` in visit objects
- [ ] Validation rejects invalid visit types with 400 error

### 4.6 Data Integrity
- [ ] Cannot update visit_type after caregiver assigned (immutable post-assignment)
- [ ] Audit trail logs visit_type changes
- [ ] Reports correctly categorize visits by type

### 4.7 Mobile App
- [ ] Visit type visible in mobile caregiver app
- [ ] Visit type selectable on mobile (if mobile creation exists)
- [ ] Mobile assignment considers visit type requirements

---

## 5. Implementation Approach

### 5.1 Database & Backend
**Status:** ✅ **No database changes needed** - constraint already exists

Migration file already has the check constraint. Verify it exists:
```sql
-- Verify in migration 20251030214714_scheduling_visits.ts
table.check(`visit_type IN ('REGULAR', 'INITIAL', 'DISCHARGE', 
  'RESPITE', 'EMERGENCY', 'MAKEUP', 'SUPERVISION', 'ASSESSMENT')`)
```

### 5.2 Files to Create/Modify

#### New Files

1. **`/packages/web/src/config/visitTypeConfig.ts`** (150-200 lines)
```typescript
import {
  Heart,
  Clipboard,
  CheckCircle,
  Umbrella,
  Stethoscope,
  AlertCircle,
  LogOut,
  Repeat,
  Gem,
} from 'lucide-react';

export enum VisitType {
  REGULAR = 'REGULAR',
  INITIAL = 'INITIAL',
  ASSESSMENT = 'ASSESSMENT',
  RESPITE = 'RESPITE',
  SUPERVISION = 'SUPERVISION',
  EMERGENCY = 'EMERGENCY',
  DISCHARGE = 'DISCHARGE',
  MAKEUP = 'MAKEUP',
  CONCIERGE = 'CONCIERGE',
}

export const VISIT_TYPE_CONFIG = {
  [VisitType.REGULAR]: {
    label: 'Regular Visit',
    description: 'Standard recurring home care visit (ADL assistance, medication reminders)',
    icon: Heart,
    colorClass: 'text-green-600',
    bgColorClass: 'bg-green-50',
    badgeColorClass: 'bg-green-100 text-green-800',
    typicalDuration: 60, // minutes
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD', // Different rates for billing
  },
  [VisitType.INITIAL]: {
    label: 'Initial Visit',
    description: 'First visit with new client; comprehensive assessment and care plan development',
    icon: Clipboard,
    colorClass: 'text-blue-600',
    bgColorClass: 'bg-blue-50',
    badgeColorClass: 'bg-blue-100 text-blue-800',
    typicalDuration: 90,
    careLevel: 'HIGH',
    requiredCertifications: ['RN', 'LPN'],
    billingRate: 'INITIAL_VISIT',
  },
  [VisitType.ASSESSMENT]: {
    label: 'Assessment Visit',
    description: 'Periodic re-assessment of client needs and care plan effectiveness',
    icon: CheckCircle,
    colorClass: 'text-indigo-600',
    bgColorClass: 'bg-indigo-50',
    badgeColorClass: 'bg-indigo-100 text-indigo-800',
    typicalDuration: 60,
    careLevel: 'MEDIUM_HIGH',
    requiredCertifications: ['RN', 'LPN'],
    billingRate: 'ASSESSMENT',
  },
  [VisitType.RESPITE]: {
    label: 'Respite Care',
    description: 'Temporary relief for family caregivers; can span multiple hours',
    icon: Umbrella,
    colorClass: 'text-purple-600',
    bgColorClass: 'bg-purple-50',
    badgeColorClass: 'bg-purple-100 text-purple-800',
    typicalDuration: 240, // 4 hours
    careLevel: 'VARIABLE',
    requiredCertifications: [],
    billingRate: 'RESPITE_CARE',
  },
  [VisitType.SUPERVISION]: {
    label: 'Supervisory Nurse Visit',
    description: 'Nursing oversight of care delivery and caregiver supervision',
    icon: Stethoscope,
    colorClass: 'text-cyan-600',
    bgColorClass: 'bg-cyan-50',
    badgeColorClass: 'bg-cyan-100 text-cyan-800',
    typicalDuration: 45,
    careLevel: 'HIGH',
    requiredCertifications: ['RN'],
    billingRate: 'SUPERVISION',
  },
  [VisitType.EMERGENCY]: {
    label: 'Emergency Response',
    description: 'Urgent response to client crisis or emergency situation',
    icon: AlertCircle,
    colorClass: 'text-red-600',
    bgColorClass: 'bg-red-50',
    badgeColorClass: 'bg-red-100 text-red-800',
    typicalDuration: 30,
    careLevel: 'CRITICAL',
    requiredCertifications: [],
    billingRate: 'EMERGENCY',
  },
  [VisitType.DISCHARGE]: {
    label: 'Discharge Visit',
    description: 'Final visit upon client discharge or end of service',
    icon: LogOut,
    colorClass: 'text-orange-600',
    bgColorClass: 'bg-orange-50',
    badgeColorClass: 'bg-orange-100 text-orange-800',
    typicalDuration: 60,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD',
  },
  [VisitType.MAKEUP]: {
    label: 'Make-up Visit',
    description: 'Rescheduled visit for previously missed appointment',
    icon: Repeat,
    colorClass: 'text-yellow-600',
    bgColorClass: 'bg-yellow-50',
    badgeColorClass: 'bg-yellow-100 text-yellow-800',
    typicalDuration: 60,
    careLevel: 'STANDARD',
    requiredCertifications: [],
    billingRate: 'STANDARD',
  },
  [VisitType.CONCIERGE]: {
    label: 'Concierge Visit',
    description: 'Premium personal services (errands, companionship, shopping)',
    icon: Gem,
    colorClass: 'text-pink-600',
    bgColorClass: 'bg-pink-50',
    badgeColorClass: 'bg-pink-100 text-pink-800',
    typicalDuration: 120,
    careLevel: 'LOW',
    requiredCertifications: [],
    billingRate: 'CONCIERGE',
  },
};

// Helper function to get visit type config
export function getVisitTypeConfig(type: VisitType) {
  return VISIT_TYPE_CONFIG[type];
}

// Get all visit types for UI lists
export function getAllVisitTypes() {
  return Object.values(VisitType);
}

// Get visit types that require nurse certification
export function getNurseRequiredVisitTypes() {
  return Object.entries(VISIT_TYPE_CONFIG)
    .filter(([_, config]) => config.requiredCertifications.includes('RN'))
    .map(([type]) => type);
}
```

2. **`/packages/web/src/components/visits/VisitTypeSelector.tsx`** (200-250 lines)
```typescript
import React from 'react';
import { VISIT_TYPE_CONFIG, VisitType } from '@/config/visitTypeConfig';

interface VisitTypeSelectorProps {
  value: VisitType | null;
  onChange: (type: VisitType) => void;
  disabled?: boolean;
  requiredCertifications?: string[];
}

export const VisitTypeSelector: React.FC<VisitTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  requiredCertifications = [],
}) => {
  return (
    <fieldset disabled={disabled}>
      <legend className="block text-sm font-semibold text-gray-900 mb-4">
        Visit Type <span className="text-red-600">*</span>
      </legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(VISIT_TYPE_CONFIG).map(([typeKey, config]) => {
          const type = typeKey as VisitType;
          const Icon = config.icon;
          const isSelected = value === type;

          return (
            <label
              key={type}
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="visit_type"
                value={type}
                checked={isSelected}
                onChange={() => onChange(type)}
                className="sr-only"
              />

              <div className="flex items-center gap-3 w-full">
                <Icon className={`h-5 w-5 flex-shrink-0 ${config.colorClass}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-600 mt-1">{config.description}</p>
                  {config.requiredCertifications.length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      Requires: {config.requiredCertifications.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Radio button indicator */}
              <div
                className={`absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
```

3. **`/packages/web/src/components/visits/VisitTypeBadge.tsx`** (80-120 lines)
```typescript
import React from 'react';
import { VISIT_TYPE_CONFIG, VisitType } from '@/config/visitTypeConfig';

interface VisitTypeBadgeProps {
  type: VisitType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const VisitTypeBadge: React.FC<VisitTypeBadgeProps> = ({
  type,
  size = 'md',
  showLabel = true,
}) => {
  const config = VISIT_TYPE_CONFIG[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-medium ${
        config.badgeColorClass
      } ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && config.label}
    </span>
  );
};
```

#### Modified Files

1. **`/packages/web/src/app/pages/admin/components/VisitFilters.tsx`** (or update existing)
   - Import VISIT_TYPE_CONFIG
   - Replace hardcoded VISIT_TYPES with config
   - All 9 visit types available in filter

2. **`/packages/web/src/app/pages/admin/components/CreateVisitModal.tsx`**
   - Add VisitTypeSelector component
   - Validate visit_type is selected
   - Show required certifications for selected type

3. **`/packages/web/src/app/pages/admin/components/EditVisitModal.tsx`**
   - Add VisitTypeSelector (disabled if caregiver assigned)
   - Show warning "Cannot change visit type after assignment"

4. **`/packages/web/src/types/showcase-types.ts`**
   - Add VisitType enum
   - Update VisitSearchFilters to include visitType multi-select

5. **`/packages/app/src/routes/visits.ts`** (Backend API)
   - Validate visit_type on POST /visits
   - Include visit_type in GET responses
   - Support ?visit_type=X,Y,Z filtering

6. **`/packages/web/src/core/components/VisitCard.tsx`** (or visit list item)
   - Replace visit type text with VisitTypeBadge component

### 5.3 Configuration Implementation

**Visit Type Constraints:**
```sql
-- Verify existing in migration 20251030214714_scheduling_visits.ts line 262
table.check(`visit_type IN ('REGULAR', 'INITIAL', 'DISCHARGE', 
  'RESPITE', 'EMERGENCY', 'MAKEUP', 'SUPERVISION', 'ASSESSMENT')`)
```

**Add to existing migration OR create new:**
```typescript
// If need to add CONCIERGE type:
// 20261010000000_add_concierge_visit_type.ts
await knex.raw(`
  ALTER TABLE visits
  DROP CONSTRAINT visits_visit_type_check;
  
  ALTER TABLE visits
  ADD CONSTRAINT visits_visit_type_check
  CHECK (visit_type IN (
    'REGULAR', 'INITIAL', 'DISCHARGE', 'RESPITE', 
    'EMERGENCY', 'MAKEUP', 'SUPERVISION', 'ASSESSMENT', 'CONCIERGE'
  ));
`);
```

### 5.4 API Integration

**Visit Type in Visit Response:**
```json
{
  "id": "uuid",
  "client_id": "uuid",
  "scheduled_date": "2024-10-20",
  "visit_type": "INITIAL",
  "service_type_name": "Home Care",
  "status": "SCHEDULED",
  "assigned_caregiver": {
    "id": "uuid",
    "name": "Sarah M.",
    "credentials": ["RN", "CPR"]
  },
  "required_certifications": ["RN"],
  "billable_hours": 1.5
}
```

**Create Visit Request:**
```json
{
  "client_id": "uuid",
  "scheduled_date": "2024-10-20",
  "scheduled_start_time": "10:00",
  "scheduled_end_time": "11:30",
  "visit_type": "INITIAL",
  "service_type_id": "uuid",
  "assigned_caregiver_id": "uuid" // optional
}
```

**Filter Visits Query:**
```
GET /api/visits?visit_type=INITIAL,ASSESSMENT&start_date=2024-10-01&end_date=2024-10-31
```

### 5.5 Caregiver Eligibility Rules

**Add to assignment logic:**
```typescript
function getCaregiverEligibilityScore(
  caregiver: Caregiver,
  visit: Visit
): EligibilityScore {
  let score = 100;

  // Check required certifications for visit type
  const requiredCerts = getVisitTypeConfig(visit.visit_type).requiredCertifications;
  const caregiverCerts = caregiver.credentials.map(c => c.type);
  
  requiredCerts.forEach(requiredCert => {
    if (!caregiverCerts.includes(requiredCert)) {
      score -= 50; // Major penalty for missing required cert
    }
  });

  // Check skills match
  const requiredSkills = visit.required_skills || [];
  const caregiverSkills = caregiver.skills.map(s => s.name);
  
  const skillMatch = requiredSkills.filter(skill =>
    caregiverSkills.includes(skill)
  ).length / requiredSkills.length;
  
  score *= skillMatch; // Reduce score by skill match percentage

  // Visit type preferences
  if (caregiver.work_preferences?.preferred_visit_types?.includes(visit.visit_type)) {
    score += 10;
  }

  return {
    eligible: score > 40, // Must meet 40%+ threshold
    score,
    reasons: generateReasons(score),
  };
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

**File:** `/packages/web/src/config/__tests__/visitTypeConfig.test.ts`

```typescript
describe('visitTypeConfig', () => {
  test('all visit types are properly configured', () => {
    const allTypes = getAllVisitTypes();
    expect(allTypes.length).toBeGreaterThanOrEqual(5);
    
    allTypes.forEach(type => {
      const config = getVisitTypeConfig(type);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.icon).toBeTruthy();
      expect(config.colorClass).toBeTruthy();
    });
  });

  test('nurse-required types are correct', () => {
    const nurseTypes = getNurseRequiredVisitTypes();
    expect(nurseTypes).toContain('INITIAL');
    expect(nurseTypes).toContain('ASSESSMENT');
    expect(nurseTypes).toContain('SUPERVISION');
    expect(nurseTypes).not.toContain('REGULAR');
  });
});
```

**File:** `/packages/web/src/components/visits/__tests__/VisitTypeSelector.test.tsx`

```typescript
describe('VisitTypeSelector', () => {
  test('renders all visit types', () => {
    render(<VisitTypeSelector value={null} onChange={jest.fn()} />);
    expect(screen.getByText('Regular Visit')).toBeInTheDocument();
    expect(screen.getByText('Initial Visit')).toBeInTheDocument();
    expect(screen.getByText('Respite Care')).toBeInTheDocument();
  });

  test('calls onChange when type selected', () => {
    const onChange = jest.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);
    
    fireEvent.click(screen.getByLabelText(/regular visit/i));
    expect(onChange).toHaveBeenCalledWith('REGULAR');
  });

  test('shows required certifications', () => {
    render(<VisitTypeSelector value={null} onChange={jest.fn()} />);
    
    expect(screen.getByText(/Requires: RN/i)).toBeInTheDocument();
  });

  test('disables when disabled prop true', () => {
    render(
      <VisitTypeSelector
        value={null}
        onChange={jest.fn()}
        disabled={true}
      />
    );
    
    const fieldset = screen.getByRole('group');
    expect(fieldset).toBeDisabled();
  });
});
```

**File:** `/packages/web/src/components/visits/__tests__/VisitTypeBadge.test.tsx`

```typescript
describe('VisitTypeBadge', () => {
  test('renders correct icon for visit type', () => {
    const { container } = render(<VisitTypeBadge type="INITIAL" />);
    // Check for Clipboard icon
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('displays label when showLabel true', () => {
    render(<VisitTypeBadge type="INITIAL" showLabel={true} />);
    expect(screen.getByText('Initial Visit')).toBeInTheDocument();
  });

  test('hides label when showLabel false', () => {
    render(<VisitTypeBadge type="INITIAL" showLabel={false} />);
    expect(screen.queryByText('Initial Visit')).not.toBeInTheDocument();
  });

  test('applies correct size classes', () => {
    const { container: smContainer } = render(
      <VisitTypeBadge type="INITIAL" size="sm" />
    );
    expect(smContainer.firstChild).toHaveClass('text-xs');

    const { container: lgContainer } = render(
      <VisitTypeBadge type="INITIAL" size="lg" />
    );
    expect(lgContainer.firstChild).toHaveClass('text-base');
  });
});
```

### 6.2 Backend API Tests

**File:** `/packages/app/src/routes/__tests__/visits.test.ts`

```typescript
describe('POST /api/visits', () => {
  test('creates visit with all visit types', async () => {
    const visitTypes = [
      'REGULAR',
      'INITIAL',
      'ASSESSMENT',
      'RESPITE',
      'SUPERVISION',
      'EMERGENCY',
      'DISCHARGE',
      'MAKEUP',
      'CONCIERGE',
    ];

    for (const visitType of visitTypes) {
      const response = await request(app)
        .post('/api/visits')
        .send({
          client_id: clientId,
          visit_type: visitType,
          scheduled_date: '2024-10-20',
          scheduled_start_time: '10:00',
          scheduled_end_time: '11:00',
          service_type_id: serviceTypeId,
        });

      expect(response.status).toBe(201);
      expect(response.body.visit_type).toBe(visitType);
    }
  });

  test('rejects invalid visit type', async () => {
    const response = await request(app)
      .post('/api/visits')
      .send({
        client_id: clientId,
        visit_type: 'INVALID_TYPE',
        scheduled_date: '2024-10-20',
        scheduled_start_time: '10:00',
        scheduled_end_time: '11:00',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid visit type');
  });

  test('prevents changing visit_type after caregiver assigned', async () => {
    const visitId = 'existing-visit';
    const response = await request(app)
      .patch(`/api/visits/${visitId}`)
      .send({
        visit_type: 'ASSESSMENT',
      });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain(
      'Cannot change visit type after caregiver assigned'
    );
  });

  test('filters visits by visit_type', async () => {
    const response = await request(app)
      .get('/api/visits?visit_type=INITIAL,ASSESSMENT');

    expect(response.status).toBe(200);
    expect(response.body.visits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ visit_type: 'INITIAL' }),
        expect.objectContaining({ visit_type: 'ASSESSMENT' }),
      ])
    );
  });
});
```

### 6.3 E2E Tests

**File:** `/e2e/visit-types.spec.ts`

```typescript
test.describe('Visit Types', () => {
  test('can create visit with each type', async ({ page }) => {
    await page.goto('/admin/schedules');
    await page.click('button:has-text("New Visit")');

    for (const type of ['INITIAL', 'ASSESSMENT', 'RESPITE', 'SUPERVISION']) {
      await page.click(`label:has-text("${getVisitTypeLabel(type)}")`);
      expect(await page.isChecked(`input[value="${type}"]`)).toBe(true);
    }
  });

  test('filters visits by type', async ({ page }) => {
    await page.goto('/admin/schedules');
    await page.click('button:has-text("Filters")');

    // Select INITIAL and ASSESSMENT
    await page.click('button:has-text("Initial Visit")');
    await page.click('button:has-text("Assessment Visit")');
    await page.click('button:has-text("Apply")');

    expect(page.url()).toContain('visitType=INITIAL');
    expect(page.url()).toContain('ASSESSMENT');

    // Verify results only show those types
    const badges = await page.locator('[data-testid="visit-type-badge"]').allTextContents();
    badges.forEach(badge => {
      expect(['Initial Visit', 'Assessment Visit']).toContain(badge);
    });
  });

  test('shows visit type in visit details', async ({ page }) => {
    await page.goto('/admin/schedules');
    await page.click('[data-testid="visit-card"]:first-child');

    expect(await page.isVisible('text=Initial Visit')).toBe(true);
  });

  test('prevents changing type after assignment', async ({ page }) => {
    await page.goto('/admin/schedules/visit-edit/123');

    const visitTypeButton = page.locator('[data-testid="visit-type-selector"]');
    expect(await visitTypeButton.isDisabled()).toBe(true);

    expect(
      await page.isVisible('text=Cannot change visit type after caregiver assigned')
    ).toBe(true);
  });
});
```

### 6.4 Visual Regression Tests

```typescript
test('VisitTypeSelector renders correctly', async ({ page }) => {
  await page.goto('/storybook/visitTypeSelector');
  await expect(page).toHaveScreenshot('visitTypeSelector-default.png');
});

test('VisitTypeBadges render all types', async ({ page }) => {
  await page.goto('/storybook/visitTypeBadges');
  const allBadges = await page.locator('[data-testid="badge"]').count();
  expect(allBadges).toBe(9);
  await expect(page).toHaveScreenshot('visitTypeBadges-all.png');
});
```

---

## 7. Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Existing data breaking** | High | Low | No data migration needed; constraint already exists |
| **Billing system confusion** | High | Medium | Add billing_rate_category to visit type config; test with billing module |
| **Caregiver assignment failures** | Medium | Medium | Implement fallback matching when no eligible caregivers; admin override |
| **UI inconsistency** | Low | Low | Use VisitTypeBadge and VisitTypeSelector everywhere; Storybook |
| **Performance on large datasets** | Low | Low | Visit type is indexed; query performs well |
| **Mobile app compatibility** | Low | Medium | Test on both iOS and Android mobile app |

**Mitigation Strategy:**
1. Feature flag: `ENABLE_VISIT_TYPES` - rolls out gradually by organization
2. Billing module review: Ensure new types map correctly to rate schedules
3. Fallback matching: If no eligible caregivers for visit type, suggest manual assignment
4. Admin training: Document visit type meanings and assignment rules

---

## 8. Estimated Effort & Complexity

| Component | Lines | Effort | Notes |
|-----------|-------|--------|-------|
| visitTypeConfig.ts | 200-250 | 3-4 pts | Configuration; mostly declarative |
| VisitTypeSelector.tsx | 200-250 | 3-4 pts | Radio button group with descriptions |
| VisitTypeBadge.tsx | 100-150 | 2-3 pts | Badge rendering; straightforward |
| Modal integration | 150-200 | 3-4 pts | Update create/edit modals |
| API validation | 100-150 | 2-3 pts | Validate visit_type in backend |
| Filter integration | 100-150 | 2-3 pts | Add to VisitFilters dropdown |
| Caregiver matching | 150-200 | 3-4 pts | Update eligibility logic |
| Unit tests | 400-500 | 4-5 pts | Comprehensive coverage |
| E2E tests | 300-400 | 3-4 pts | Multi-step workflows |
| **Total** | **1700-2100** | **12-16 pts** | ~2 weeks @ 1 dev |

### Complexity Breakdown
- **High:** Caregiver assignment eligibility rules
- **Medium:** Modal integrations, filter updates
- **Low:** Component creation (straightforward React), config setup

### Recommended Timeline
**Week 1 (8 pts):**
- Create config, components (visitTypeConfig.ts, VisitTypeSelector, VisitTypeBadge)
- Write unit tests
- Integrate into create visit modal

**Week 2 (8 pts):**
- API validation & filtering
- Update VisitFilters component
- Caregiver assignment eligibility
- E2E tests & bug fixes

---

## 9. Success Metrics

- ✅ All 9 visit types displayable and selectable in UI
- ✅ 100% of visits have a valid visit_type
- ✅ Visit type filters work correctly (multi-select, URL params)
- ✅ Caregiver matching respects visit type requirements
- ✅ 0 failed visits due to missing certification for visit type
- ✅ Billing module correctly categorizes by visit type
- ✅ Mobile app shows visit type badges
- ✅ 90%+ unit test coverage
- ✅ All E2E scenarios pass
- ✅ Zero production incidents related to visit type

---

## Appendix A: Visit Type Comparison Matrix

| Feature | Regular | Initial | Assessment | Respite | Supervision | Emergency | Discharge | Makeup | Concierge |
|---------|---------|---------|------------|---------|-------------|-----------|-----------|--------|-----------|
| ADL Assistance | ✓ | ✓ | - | ✓ | - | ✓ | - | ✓ | ✓ |
| Clinical Assessment | - | ✓ | ✓ | - | ✓ | ✓ | - | - | - |
| Care Plan Involvement | - | ✓ | ✓ | - | ✓ | - | ✓ | - | - |
| Long Duration | - | ✓ | - | ✓ | - | - | - | - | ✓ |
| Nurse Required | - | ✓ | ✓ | - | ✓ | - | - | - | - |
| Urgent/On-Demand | - | - | - | - | - | ✓ | - | - | - |
| Billable | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Appendix B: Icon Reference

```typescript
import {
  Heart,           // REGULAR
  Clipboard,       // INITIAL
  CheckCircle,     // ASSESSMENT
  Umbrella,        // RESPITE
  Stethoscope,     // SUPERVISION
  AlertCircle,     // EMERGENCY
  LogOut,          // DISCHARGE
  Repeat,          // MAKEUP
  Gem,             // CONCIERGE
} from 'lucide-react';
```

---

**Document Version:** 1.0  
**Last Updated:** Oct 13, 2024  
**Prepared by:** Technical Architecture Team  
**Review Status:** ✅ Ready for Development Team Kickoff

