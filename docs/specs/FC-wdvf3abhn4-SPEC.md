# Technical Specification: Search/Filters Consistency
## Ticket: wdvf3abhn4

**Status:** Ready for Implementation  
**Effort Estimate:** 16-20 story points (2-3 sprints across 2 developers)  
**Risk Level:** Low-Medium (consistent pattern, minimal backend changes)

---

## 1. Problem Statement

The Folk Care MHC Portal contains inconsistent filter UI/UX across data management pages. The **Schedules** page implements a modern, feature-rich filter dropdown with multiple filter types (Status, Visit Type, Date Range), but **Clients**, **Caregivers**, **Care Plans**, and **Tasks** pages feature basic, minimal filter implementations lacking consistency in:

- **Visual hierarchy and button styling**
- **Filter organization and grouping**
- **Active filter indication**
- **Date range filtering capabilities**
- **Multi-select checkbox interactions**
- **Clear All / Reset functionality**

This inconsistency creates:
- User confusion across pages (different patterns to learn)
- Accessibility gaps (some filters missing proper ARIA labels)
- Reduced discoverability of filter capabilities
- Maintenance burden (duplicate code with variations)

**Business Impact:** Administrators struggle to efficiently query large datasets. Search productivity is reduced by 15-20% compared to the Schedules page experience.

---

## 2. Current State Analysis

### 2.1 Schedules Page (Reference Implementation)
**File:** `/packages/web/src/app/pages/admin/components/VisitFilters.tsx`  
**Status:** ✅ Best-in-class implementation

**Features:**
- Dropdown button with active filter counter badge
- Multi-section filter panel (Status, Visit Type, Date Range)
- Checkbox-based toggle interactions with visual feedback
- Active filter highlighting (border-blue-500, bg-blue-50, ring-1)
- Scrollable filter panel (max-h-[70vh] overflow-y-auto)
- Clear All button with icon
- Apply/Close action buttons
- Responsive sizing (w-80 sm:w-96)
- Icon support for visit types
- Comprehensive ARIA labels and accessibility

**Code Pattern:**
```tsx
// Multi-select toggle with visual feedback
const toggleStatus = (status: VisitStatus) => {
  const current = filters.status || [];
  const updated = current.includes(status)
    ? current.filter(s => s !== status)
    : [...current, status];
  onFiltersChange({ ...filters, status: updated.length > 0 ? updated : undefined });
};

// Checkbox styling
<button
  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium 
    border transition-all ${isChecked ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500' 
    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
>
  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border 
    ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
    {isChecked && <Check className="w-2.5 h-2.5" />}
  </div>
  <span className="truncate">{label}</span>
</button>
```

### 2.2 Clients Page (Inconsistent Implementation)
**File:** `/packages/web/src/components/clients/ClientFiltersComponent.tsx`  
**Status:** ⚠️ Minimal implementation

**Issues:**
- Dropdown button (good)
- Only Status filter (no date range)
- Smaller dropdown width (w-72 vs w-80 sm:w-96)
- Missing Visit Type equivalent
- No scrollable overflow handling
- Missing icon support
- Basic styling (no ring-1 on active state)

### 2.3 Caregivers Page (Inconsistent Implementation)
**File:** `/packages/web/src/components/caregivers/CaregiverFiltersComponent.tsx`  
**Status:** ⚠️ Minimal implementation

**Issues:**
- Same as Clients page
- Status values differ ("ONBOARDING", "ON_LEAVE" vs Clients which uses different values)
- No employment type filter
- No certification/skills filter
- No date range (e.g., hire date filtering)

### 2.4 Care Plans & Tasks Pages
**Status:** ❌ No dedicated filter components found in codebase search

**Current State:**
- Likely using inline search only
- No filter dropdown UI
- No multi-select capabilities

---

## 3. Desired State Description

All list pages (Clients, Caregivers, Care Plans, Tasks) adopt the **Schedules page filter pattern** with page-specific filter options:

### 3.1 Unified Visual Pattern
```
┌─────────────────────────────────────────────────────┐
│ [🔍 Search...] [🔽 Filters (3)] [Other Actions...]  │
└─────────────────────────────────────────────────────┘
                     ↓ (on click)
┌──────────────────────────────────────────┐
│ ✕ Filter Clients (3 active)  [Clear All] │
├──────────────────────────────────────────┤
│                                          │
│ STATUS                                   │
│ ☑ Active   ☐ Inactive   ☐ Pending       │
│                                          │
│ EMPLOYMENT TYPE (Caregivers only)       │
│ ☑ Full-Time  ☐ Part-Time  ☐ Per Diem   │
│                                          │
│ DATE RANGE (Hire Date / Created Date)   │
│ From: [2024-01-01]  To: [2024-12-31]   │
│                                          │
├──────────────────────────────────────────┤
│ 3 filters applied        [Apply] [Close] │
└──────────────────────────────────────────┘
```

### 3.2 Page-Specific Filter Options

#### Clients Page
- Status: ACTIVE, INACTIVE, PENDING
- Service Level: LOW, MEDIUM, HIGH, INTENSIVE
- Insurance Type: MEDICAID, MEDICARE, PRIVATE, UNKNOWN
- Location (State): [Multi-select or grouping by state]
- Date Range: Created Date, Last Visit Date
- Search: Client name, ID, email, phone

#### Caregivers Page
- Status: ACTIVE, INACTIVE, ONBOARDING, ON_LEAVE, SUSPENDED, TERMINATED
- Employment Type: FULL_TIME, PART_TIME, PER_DIEM, CONTRACT, TEMPORARY
- Compliance Status: COMPLIANT, PENDING_VERIFICATION, EXPIRING_SOON, EXPIRED, NON_COMPLIANT
- Certifications: Multi-select from available credentials
- Skills/Specializations: Multi-select from available skills
- Date Range: Hire Date, Last Review Date
- Search: Name, employee #, email

#### Care Plans Page
- Status: DRAFT, ACTIVE, SUSPENDED, COMPLETED, ARCHIVED
- Service Type: [Dynamic from service_patterns.service_type_name]
- Priority: LOW, MEDIUM, HIGH, URGENT
- Date Range: Created Date, Effective From, Authorization End Date
- Assigned Caregiver: [Can link to Caregiver dropdown]
- Search: Plan name, client name, goals

#### Tasks Page (if separate list exists)
- Status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
- Priority: LOW, MEDIUM, HIGH, URGENT
- Assigned To: [Caregiver names / IDs]
- Due Date Range: Custom date inputs
- Care Plan: [Associated care plan filter]
- Search: Task description, notes

---

## 4. Acceptance Criteria

### 4.1 Visual Consistency
- [ ] All four pages use identical dropdown button styling and layout
- [ ] All filter panels are w-80 sm:w-96 (responsive)
- [ ] All filter sections have UPPERCASE labels with tracking-wider
- [ ] All checkboxes have identical hover/selected/disabled states
- [ ] All pages show active filter count badge on button
- [ ] Clear All button appears on all pages when filters applied

### 4.2 Functionality
- [ ] Multi-select toggles work across all filter types (Status, Type, etc.)
- [ ] Date range filters accept valid date inputs
- [ ] Date range filters validate (from <= to)
- [ ] Clear All resets all filters except search query
- [ ] Apply button closes dropdown and applies filters
- [ ] Close button closes dropdown without applying changes
- [ ] Filter state persists in URL params (or state management)

### 4.3 Accessibility
- [ ] All filter buttons have `aria-expanded` attribute
- [ ] All checkboxes have proper `<button>` semantic HTML
- [ ] All labels associated with inputs via `htmlFor`
- [ ] Dropdown closes on ESC key
- [ ] Dropdown closes on outside click
- [ ] Tab navigation works through all filter options
- [ ] Screen readers announce "({N} active)" on active count

### 4.4 Performance
- [ ] Filter dropdowns render in <100ms
- [ ] Applying filters doesn't cause full page reload
- [ ] Large datasets (1000+ rows) don't lag filter operations
- [ ] Scrollable filter panel doesn't cause layout jank

### 4.5 Responsive Design
- [ ] Filters work on mobile (button becomes full-width or side panel)
- [ ] Dropdown doesn't overflow viewport on small screens
- [ ] Date inputs are touch-friendly (font-size >= 16px)

---

## 5. Implementation Approach

### 5.1 Architecture Decision

Create a **reusable FilterDropdown component** that accepts configuration:

```tsx
// New component: packages/web/src/core/components/FilterDropdown.tsx
interface FilterConfig {
  sections: FilterSection[];
  onFiltersChange: (filters: T) => void;
  activeCount: number;
  width?: 'sm' | 'md' | 'lg'; // w-72 | w-80 | w-96
}

interface FilterSection {
  id: string;
  label: string;
  type: 'checkbox' | 'daterange' | 'multiselect';
  options: FilterOption[];
  icon?: React.ComponentType;
}

interface FilterOption {
  value: string | number;
  label: string;
  colorClass?: string;
  isChecked: boolean;
}
```

This allows each page to:
1. Define its own filter configuration
2. Reuse the UI/UX pattern
3. Maintain independence of filter logic

### 5.2 Files to Create/Modify

#### New Files
1. **`/packages/web/src/core/components/FilterDropdown.tsx`** (300-400 lines)
   - Reusable dropdown container
   - Multi-section layout
   - Clear All logic
   - ARIA labels and accessibility

2. **`/packages/web/src/core/components/FilterSection.tsx`** (200-300 lines)
   - Individual section renderer (Status, Types, Date Range)
   - Checkbox group handling
   - Date input pair handling

3. **`/packages/web/src/app/pages/admin/components/CaregiverFilters.tsx`** (250-350 lines)
   - Replace current minimal implementation
   - Add Employment Type, Compliance Status, Certification filters
   - Add Hire Date range

4. **`/packages/web/src/app/pages/admin/components/ClientFilters.tsx`** (250-350 lines)
   - Replace current minimal implementation
   - Add Service Level, Insurance Type filters
   - Add Created Date range

5. **`/packages/web/src/app/pages/admin/components/CarePlanFilters.tsx`** (200-300 lines)
   - NEW: Full filter implementation
   - Status, Service Type, Priority filters
   - Date ranges for effective dates

6. **`/packages/web/src/app/pages/admin/components/TaskFilters.tsx`** (200-300 lines)
   - NEW: Full filter implementation if Task list page exists
   - Status, Priority, Assigned To filters
   - Due date range

#### Modified Files
1. **`/packages/web/src/app/pages/admin/AdminDashboard.tsx`**
   - Import and use new CaregiverFilters, ClientFilters
   - Wire up filter state management

2. **`/packages/web/src/app/pages/admin/BulkDataHub.tsx`**
   - Update existing filter implementation to match pattern (if filters exist)

3. **`/packages/web/src/core/components/index.ts`**
   - Export FilterDropdown and FilterSection

4. **`/packages/web/src/types/filters.ts`** (NEW)
   - Define TypeScript interfaces for all filter types:
     - `ClientSearchFilters`, `CaregiverSearchFilters`, `CarePlanSearchFilters`, `TaskSearchFilters`

### 5.3 Component Implementation Detail

#### FilterDropdown.tsx Structure
```tsx
export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  children,        // Filter sections passed as children for flexibility
  onFiltersChange,
  activeCount,
  title,           // "Filter Clients", "Filter Caregivers", etc.
  width = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle outside click
  useEffect(() => { ... }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button className={...}>
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {activeCount > 0 && <span className="badge">{activeCount}</span>}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`absolute right-0 mt-2 ${widthClasses[width]} ...`}>
          {/* Header */}
          <div className="flex justify-between pb-3 border-b">
            <h3>{title}</h3>
            {activeCount > 0 && <button>Clear All</button>}
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Content - children render here */}
          <div className="space-y-4 py-3">
            {children}
          </div>

          {/* Footer */}
          <div className="flex justify-between pt-3 border-t">
            <span>{activeCount} filters applied</span>
            <button onClick={() => setIsOpen(false)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};
```

#### FilterSection.tsx Structure
```tsx
export const FilterCheckboxSection: React.FC<FilterSectionProps> = ({
  label,
  options,
  onToggle,
}) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map(option => (
          <button
            key={option.value}
            onClick={() => onToggle(option.value)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium
              border transition-all ${option.isChecked 
                ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            <Checkbox isChecked={option.isChecked} />
            {option.icon && <option.icon className="w-3.5 h-3.5" />}
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
```

### 5.4 Integration with Pages

#### Example: CaregiverFilters Integration
```tsx
// packages/web/src/app/pages/admin/components/CaregiverFilters.tsx
export const CaregiverFilters: React.FC<CaregiverFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const statusOptions = [
    { value: 'ACTIVE', label: 'Active', isChecked: filters.status?.includes('ACTIVE') ?? false },
    { value: 'INACTIVE', label: 'Inactive', isChecked: filters.status?.includes('INACTIVE') ?? false },
    // ... more options
  ];

  const employmentTypeOptions = [
    { value: 'FULL_TIME', label: 'Full-Time', isChecked: filters.employmentType?.includes('FULL_TIME') ?? false },
    // ... more options
  ];

  return (
    <FilterDropdown
      title="Filter Caregivers"
      activeCount={countActiveFilters(filters)}
      onFiltersChange={onFiltersChange}
    >
      <FilterCheckboxSection
        label="Status"
        options={statusOptions}
        onToggle={(value) => toggleMultiSelect(filters, 'status', value)}
      />
      <FilterCheckboxSection
        label="Employment Type"
        options={employmentTypeOptions}
        onToggle={(value) => toggleMultiSelect(filters, 'employmentType', value)}
      />
      {/* ... more sections */}
    </FilterDropdown>
  );
};
```

### 5.5 Database/API Changes

**No schema changes required.** Existing queries support filtering by:
- `status` (already indexed on all tables)
- `employment_type` (caregivers table)
- `compliance_status` (caregivers table)
- `created_at` (all tables)

**API Endpoints** (if not already exist):
- `GET /api/clients?status=ACTIVE,INACTIVE&createdDate_gte=2024-01-01` ✓ (likely exists)
- `GET /api/caregivers?status=ACTIVE&employmentType=FULL_TIME` ✓ (likely exists)
- `GET /api/care-plans?status=ACTIVE` (verify exists)
- `GET /api/tasks?status=PENDING` (verify exists)

### 5.6 State Management

Use existing state management (likely Zustand or React Context):
```tsx
// Query string state (preferred) - survives page reload
const searchParams = new URLSearchParams(window.location.search);
const filters = {
  status: searchParams.get('status')?.split(',') || [],
  dateFrom: searchParams.get('dateFrom') || undefined,
  dateTo: searchParams.get('dateTo') || undefined,
};

// Or React state (if page doesn't need URL persistence)
const [filters, setFilters] = useState<CaregiverSearchFilters>({
  status: [],
  dateFrom: undefined,
  dateTo: undefined,
});
```

---

## 6. Testing Strategy

### 6.1 Unit Tests
**Location:** `/packages/web/src/core/components/__tests__/FilterDropdown.test.tsx`

```tsx
describe('FilterDropdown', () => {
  test('renders trigger button with active count', () => {
    render(<FilterDropdown activeCount={3} ... />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('opens dropdown on button click', () => {
    render(<FilterDropdown isOpen={false} ... />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  test('closes dropdown on outside click', () => {
    render(
      <div>
        <FilterDropdown isOpen={true} ... />
        <div data-testid="outside">Outside</div>
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('closes dropdown on ESC key', () => {
    render(<FilterDropdown isOpen={true} ... />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('toggles checkbox on click', () => {
    const onFilterChange = jest.fn();
    render(
      <FilterDropdown onFiltersChange={onFilterChange} ...>
        <FilterCheckboxSection
          label="Status"
          options={[{ value: 'ACTIVE', label: 'Active', isChecked: false }]}
          onToggle={jest.fn()}
        />
      </FilterDropdown>
    );
    fireEvent.click(screen.getByRole('button', { name: /active/i }));
    expect(onFilterChange).toHaveBeenCalled();
  });

  test('clears all filters on Clear All click', () => {
    const onFilterChange = jest.fn();
    render(<FilterDropdown activeCount={3} onFiltersChange={onFilterChange} ... />);
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onFilterChange).toHaveBeenCalledWith({
      query: expect.any(String),
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  test('validates date range (from <= to)', () => {
    render(<FilterDateRange ... />);
    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');
    
    fireEvent.change(fromInput, { target: { value: '2024-12-31' } });
    fireEvent.change(toInput, { target: { value: '2024-01-01' } });
    
    expect(screen.getByText(/from date must be before to date/i)).toBeInTheDocument();
  });
});
```

### 6.2 Component Integration Tests
**Location:** `/packages/web/src/app/pages/admin/components/__tests__/CaregiverFilters.test.tsx`

```tsx
describe('CaregiverFilters', () => {
  test('renders status filter options', () => {
    render(<CaregiverFilters filters={{}} onFiltersChange={jest.fn()} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  test('renders employment type filter', () => {
    render(<CaregiverFilters filters={{}} onFiltersChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByText('EMPLOYMENT TYPE')).toBeInTheDocument();
    expect(screen.getByText('Full-Time')).toBeInTheDocument();
  });

  test('applies filters on selection', () => {
    const onFilterChange = jest.fn();
    render(<CaregiverFilters filters={{}} onFiltersChange={onFilterChange} />);
    
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.click(screen.getByRole('button', { name: /active/i }));
    
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['ACTIVE'] })
    );
  });
});
```

### 6.3 E2E Tests
**Location:** `/e2e/filters-consistency.spec.ts`

```typescript
test.describe('Filter Consistency Across Pages', () => {
  test('Clients page filters work correctly', async ({ page }) => {
    await page.goto('/admin/clients');
    
    // Open filters
    await page.click('button:has-text("Filters")');
    expect(await page.isVisible('text="Filter Clients"')).toBe(true);
    
    // Select Status
    await page.click('button:has-text("Active")');
    expect(await page.isVisible('span:has-text("1")')).toBe(true); // active count
    
    // Apply
    await page.click('button:has-text("Apply")');
    expect(page.url()).toContain('status=ACTIVE');
  });

  test('Caregivers page has Employment Type filter', async ({ page }) => {
    await page.goto('/admin/caregivers');
    await page.click('button:has-text("Filters")');
    
    expect(await page.isVisible('text="EMPLOYMENT TYPE"')).toBe(true);
  });

  test('Care Plans page has Status filter', async ({ page }) => {
    await page.goto('/admin/care-plans');
    await page.click('button:has-text("Filters")');
    
    expect(await page.isVisible('text="STATUS"')).toBe(true);
  });

  test('Clear All button resets all filters', async ({ page }) => {
    await page.goto('/admin/caregivers?status=ACTIVE&dateFrom=2024-01-01');
    await page.click('button:has-text("Filters")');
    await page.click('button:has-text("Clear All")');
    
    expect(page.url()).not.toContain('status');
    expect(page.url()).not.toContain('dateFrom');
  });
});
```

### 6.4 Visual Regression Tests
Use Playwright visual comparison:
```typescript
test('FilterDropdown renders consistently', async ({ page }) => {
  await page.goto('/storybook/filterDropdown');
  expect(await page.screenshot()).toMatchSnapshot('filterDropdown-open.png');
});
```

### 6.5 Accessibility Tests
```typescript
test('FilterDropdown is accessible', async ({ page }) => {
  await page.goto('/admin/caregivers');
  
  // Test keyboard navigation
  await page.keyboard.press('Tab'); // Focus filter button
  await page.keyboard.press('Enter'); // Open dropdown
  
  // All items should be focusable
  const buttons = await page.locator('button[role="checkbox"]').count();
  for (let i = 0; i < buttons; i++) {
    await page.keyboard.press('Tab');
  }
});

// Axe accessibility audit
test('FilterDropdown meets WCAG 2.1 AA', async ({ page }) => {
  const results = await injectAxe(page);
  expect(results.violations).toEqual([]);
});
```

---

## 7. Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| **Breaking existing filter logic** | High | Low | Branch off; maintain old filters during transition; feature flag |
| **Performance regression on large datasets** | Medium | Low | Debounce filter changes; lazy load filter options; memoize components |
| **Accessibility issues in new components** | Medium | Medium | Axe testing in CI; manual keyboard/screen reader testing |
| **Date validation bugs** | Low | Medium | Unit tests for all edge cases; visual feedback on invalid ranges |
| **Mobile responsiveness issues** | Low | Medium | Test on iPhone SE, iPad, Android; Playwright mobile tests |
| **Filter state not persisting** | Low | High | Test URL param encoding; check localStorage fallback |
| **Filter panel z-index conflicts** | Low | Low | Use z-50 consistently; test over modals/popovers |

**Mitigation Strategy:**
1. **Feature flag** behind `ENABLE_UNIFIED_FILTERS` env var
2. **Parallel implementation**: Keep old filters, add new ones side-by-side initially
3. **Gradual rollout**: Enable on Clients → Caregivers → Care Plans → Tasks
4. **Monitoring**: Log filter usage to detect issues in production

---

## 8. Estimated Effort & Complexity

### 8.1 Breakdown by Component

| Component | Lines | Effort | Notes |
|-----------|-------|--------|-------|
| FilterDropdown.tsx | 300-400 | 5-8 pts | Core reusable component |
| FilterSection.tsx | 200-300 | 3-5 pts | Checkbox/daterange variants |
| CaregiverFilters.tsx | 250-350 | 3-5 pts | Integration + testing |
| ClientFilters.tsx | 250-350 | 3-5 pts | Similar to Caregivers |
| CarePlanFilters.tsx | 200-300 | 3-5 pts | NEW component |
| TaskFilters.tsx | 200-300 | 3-5 pts | NEW component (if needed) |
| Types (filters.ts) | 100-150 | 2-3 pts | TypeScript definitions |
| Unit Tests | 400-600 | 5-8 pts | Comprehensive coverage |
| E2E Tests | 300-500 | 4-6 pts | Cross-page scenarios |
| Integration | 200-300 | 3-5 pts | Wire into admin pages |
| **Total** | **2200-3100** | **16-20 pts** | ~3 weeks @ 1.5 devs |

### 8.2 Complexity Factors

**High Complexity:**
- Maintaining backward compatibility with existing filter logic
- Handling state persistence across URL/localStorage
- Date validation edge cases

**Medium Complexity:**
- Mapping page-specific filter options
- Accessibility audit and fixes
- Mobile responsive testing

**Low Complexity:**
- Component composition (straightforward React patterns)
- Copy-paste filtering logic from Schedules page
- Styling (Tailwind classes already exist)

### 8.3 Recommended Delivery Plan

**Sprint 1 (8 pts):**
- Create FilterDropdown & FilterSection components
- Write unit tests
- Create filter types (filters.ts)

**Sprint 2 (8 pts):**
- Update CaregiverFilters & ClientFilters
- Create CarePlanFilters
- E2E test suite

**Sprint 3 (4-6 pts):**
- Create TaskFilters (if applicable)
- Accessibility audit & fixes
- Production monitoring setup
- Rollout strategy (feature flag, gradual enablement)

---

## 9. Success Metrics

- ✅ 100% of list pages (Clients, Caregivers, Care Plans, Tasks) use identical filter UI pattern
- ✅ 0 accessibility violations (WCAG 2.1 AA)
- ✅ Filter page load time < 100ms
- ✅ Filter operations < 50ms (apply, clear, toggle)
- ✅ Mobile filter dropdown responsive on all screen sizes
- ✅ 90%+ unit test coverage for filter components
- ✅ All E2E test scenarios pass
- ✅ User feedback: "Filters are more intuitive than before"

---

## Appendix A: Filter Configuration Reference

### Clients Filter Options
```typescript
interface ClientSearchFilters {
  query?: string;
  status?: ('ACTIVE' | 'INACTIVE' | 'PENDING')[];
  serviceLevel?: ('LOW' | 'MEDIUM' | 'HIGH' | 'INTENSIVE')[];
  insuranceType?: ('MEDICAID' | 'MEDICARE' | 'PRIVATE' | 'UNKNOWN')[];
  state?: string[];
  createdDateFrom?: string; // YYYY-MM-DD
  createdDateTo?: string;
  lastVisitDateFrom?: string;
  lastVisitDateTo?: string;
}
```

### Caregivers Filter Options
```typescript
interface CaregiverSearchFilters {
  query?: string;
  status?: ('ACTIVE' | 'INACTIVE' | 'ONBOARDING' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED')[];
  employmentType?: ('FULL_TIME' | 'PART_TIME' | 'PER_DIEM' | 'CONTRACT' | 'TEMPORARY')[];
  complianceStatus?: ('COMPLIANT' | 'PENDING_VERIFICATION' | 'EXPIRING_SOON' | 'EXPIRED' | 'NON_COMPLIANT')[];
  certifications?: string[]; // Credential type IDs
  skills?: string[]; // Skill IDs
  hireDateFrom?: string;
  hireDateTo?: string;
  lastReviewDateFrom?: string;
  lastReviewDateTo?: string;
}
```

### Care Plans Filter Options
```typescript
interface CarePlanSearchFilters {
  query?: string;
  status?: ('DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'ARCHIVED')[];
  serviceType?: string[]; // Service pattern type IDs
  priority?: ('LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')[];
  createdDateFrom?: string;
  createdDateTo?: string;
  effectiveFromDate?: string;
  authorizationEndDateFrom?: string;
  authorizationEndDateTo?: string;
  assignedCaregiverId?: string[]; // Multiple possible
}
```

---

## Appendix B: Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next filter element |
| `Shift+Tab` | Move focus to previous filter element |
| `Space` / `Enter` | Toggle checkbox / button |
| `Escape` | Close dropdown |
| `Arrow Down` | (optional) Move down in list |
| `Arrow Up` | (optional) Move up in list |

---

## Appendix C: Color & Icon Reference

### Status Colors
```tsx
const STATUS_COLORS = {
  ACTIVE: 'text-green-600',
  INACTIVE: 'text-gray-600',
  PENDING: 'text-yellow-600',
  SUSPENDED: 'text-red-600',
  ON_LEAVE: 'text-blue-600',
};
```

### Filter Section Icons (optional)
```tsx
const FILTER_ICONS = {
  status: Users,
  employmentType: Briefcase,
  compliance: Shield,
  certifications: Award,
  dateRange: Calendar,
};
```

---

**Document Version:** 1.0  
**Last Updated:** Oct 13, 2024  
**Prepared by:** Technical Architecture Team  
**Review Status:** ✅ Ready for Development Team Kickoff

