# Canonical In-Page Search Pattern

**Reference Implementation:** `packages/web/src/verticals/scheduling-visits/pages/VisitList.tsx`  
**Verified Against:** Commit 1e328842 on `origin/preview`  
**ClickUp Ticket:** wdvf3acgzh

## Overview

This document defines the canonical search pattern for all in-page search bars across the MHC Portal. The reference implementation in VisitList demonstrates the user's preferred search experience:

- ✅ **300ms debounce** - No network request or page reload per keystroke
- ✅ **Client-side filtering** - Results recompute from already-loaded data
- ✅ **Active filter chips** - Each filter shown with individual X to remove
- ✅ **Multiple reset options** - Toolbar button, chip row link, empty state
- ✅ **Clear X in input** - Direct way to clear just the search query
- ✅ **Empty state guidance** - Explains what to adjust when no results

## Anti-Patterns to Avoid

❌ **NEVER** use `window.location.reload()` on search  
❌ **NEVER** trigger full-page refetch per keystroke  
❌ **NEVER** make server-side search queries per character typed  
❌ **NEVER** put search query directly in useMemo deps (must debounce first)

## Pattern Components

### 1. Debounced Search State (300ms)

The search input maintains two pieces of state:
- `searchQuery`: Raw input value (updates immediately on keystroke)
- `debouncedSearch`: Debounced value (updates 300ms after typing stops)

```typescript
// State declarations
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

// Debounce effect
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchQuery.trim().toLowerCase());
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

**Why this matters:** Users can type full words or phrases without triggering a network request or computation for every character. Only the final value (after 300ms of inactivity) triggers filtering.

### 2. Client-Side Filtering (useMemo)

A dedicated `matchesSearchQuery` function tests each item against the debounced search term:

```typescript
const matchesSearchQuery = (v: Visit, debouncedSearch: string): boolean => {
  if (!debouncedSearch) return true;
  
  const clientName = `${v.clientFirstName ?? ''} ${v.clientLastName ?? ''}`.toLowerCase();
  const serviceName = v.serviceTypeName.toLowerCase();
  const visitNum = v.visitNumber.toLowerCase();
  const address = `${v.address.line1} ${v.address.city} ${v.address.state} ${v.address.postalCode}`.toLowerCase();

  return (
    clientName.includes(debouncedSearch) ||
    serviceName.includes(debouncedSearch) ||
    visitNum.includes(debouncedSearch) ||
    address.includes(debouncedSearch)
  );
};

const filteredVisits = useMemo(() => {
  return visitList.filter((v) => {
    // 1. Search query filter (debounced)
    if (!matchesSearchQuery(v, debouncedSearch)) {
      return false;
    }
    
    // 2. Other filters (status, type, date range, etc.)
    // ... additional filter logic
    
    return true;
  });
}, [visitList, debouncedSearch, /* other filter dependencies */]);
```

**Why this matters:** Results update instantly (within the debounce window) without network round-trips. The list region updates smoothly via React's reconciliation, not a full page refresh.

### 3. Search Input with Clear Button

The search input includes:
- Left-aligned search icon (visual affordance)
- Responsive placeholder text
- Right-aligned clear button (only visible when query exists)

```tsx
<div className="relative flex-1">
  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  <Input
    type="text"
    placeholder="Search by client, caregiver, service, address, or visit #..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-9 pr-9 bg-white"
  />
  {searchQuery && (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={() => setSearchQuery('')}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 h-6 w-6"
      aria-label="Clear search"
    >
      <X className="w-4 h-4" />
    </Button>
  )}
</div>
```

**Accessibility notes:**
- `aria-label` on clear button
- Placeholder text describes searchable fields
- Clear button only appears when needed (reduces visual clutter)

### 4. Active Filter Chips

When any filters are active, a chip row displays:
- Label prefix ("Active filters:")
- Individual chips for each active filter type
- Per-chip X button to remove just that filter
- "Reset all" link to clear everything

```tsx
{hasAnyFilterActive && (
  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
    <span className="text-muted-foreground font-medium">Active filters:</span>
    
    {/* Search query chip */}
    {debouncedSearch && (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground font-medium">
        Search: &quot;{debouncedSearch}&quot;
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setSearchQuery('')}
          className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
          aria-label="Remove search filter"
        >
          <X className="w-3 h-3" />
        </Button>
      </span>
    )}
    
    {/* Status filter chips */}
    {advancedFilters.status?.map((st) => (
      <span
        key={st}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
      >
        Status: {VISIT_STATUS_LABELS[st] || st}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            setAdvancedFilters({
              ...advancedFilters,
              status: advancedFilters.status?.filter((s) => s !== st),
            })
          }
          className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
          aria-label={`Remove status ${st} filter`}
        >
          <X className="w-3 h-3" />
        </Button>
      </span>
    ))}
    
    {/* Other filter chips (type, date range, etc.) */}
    {/* ... */}
    
    {/* Reset all link */}
    <Button
      type="button"
      variant="link"
      size="xs"
      onClick={clearAllFilters}
      className="font-medium ml-1 h-auto p-0"
    >
      Reset all
    </Button>
  </div>
)}
```

**Why this matters:** Users can see exactly what filters are active and remove individual filters without starting over. The "Reset all" link provides a quick escape hatch.

### 5. Clear All Button (Toolbar)

A dedicated button in the toolbar provides another way to reset filters:

```tsx
{hasAnyFilterActive && (
  <Button
    variant="outline"
    size="sm"
    onClick={clearAllFilters}
    title="Clear all active filters"
  >
    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
    <span className="hidden sm:inline">Clear All</span>
  </Button>
)}
```

**Why this matters:** Toolbar placement makes it visible even when scrolled. Responsive design (icon-only on mobile) saves space.

### 6. Empty State with Reset Action

When filters produce zero results, guide users to adjust:

```tsx
{totalVisits > 0 && filteredVisits.length === 0 && (
  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-500">
      <Search className="w-6 h-6" />
    </div>
    <h3 className="text-base font-semibold text-gray-900">
      No visits match your filter
    </h3>
    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
      Try adjusting your search query, status filters, or date range to see more results.
    </p>
    <div className="mt-4">
      <Button variant="outline" size="sm" onClick={clearAllFilters}>
        Reset Filters
      </Button>
    </div>
  </div>
)}
```

**Why this matters:** Users understand WHY they see no results (active filters) and HOW to fix it (reset button). Avoids confusion about missing data.

### 7. hasAnyFilterActive Helper

Determines when to show filter-related UI:

```typescript
const hasAnyFilterActive = useMemo(() => {
  return (
    Boolean(debouncedSearch) ||
    Boolean(activeSummaryFilter) ||
    activeAdvancedFilterCount > 0
  );
}, [debouncedSearch, activeSummaryFilter, activeAdvancedFilterCount]);
```

### 8. clearAllFilters Handler

Resets all filter state in one action:

```typescript
const clearAllFilters = () => {
  setSearchQuery('');
  setDebouncedSearch('');
  setActiveSummaryFilter(null);
  setAdvancedFilters({});
  setPage(1); // Reset pagination
};
```

**Important:** Must clear BOTH `searchQuery` (raw input) and `debouncedSearch` (filtered value) to ensure immediate UI update.

## Implementation Checklist

When implementing this pattern on a new page:

- [ ] Add `searchQuery` and `debouncedSearch` state
- [ ] Add 300ms debounce useEffect
- [ ] Create `matchesSearchQuery` function for your entity type
- [ ] Add search filter to main `useMemo` filtering logic
- [ ] Render search input with left icon and right clear button
- [ ] Add active filter chips section (if not present)
- [ ] Add search chip with per-chip X button
- [ ] Add "Reset all" link to chip row
- [ ] Add "Clear All" button to toolbar (if applicable)
- [ ] Add empty state with reset action
- [ ] Update `hasAnyFilterActive` to include `debouncedSearch`
- [ ] Update `clearAllFilters` to reset both search states
- [ ] Test: Type multi-character query without triggering per-keystroke updates
- [ ] Test: Clear X button clears input immediately
- [ ] Test: Filter chip X removes just search (preserves other filters)
- [ ] Test: "Reset all" clears everything
- [ ] Test: Empty state shows reset button

## Adaptation Notes

### For Different Entity Types

Replace `Visit` with your entity type and adjust searchable fields:

```typescript
// Example: Client search
const matchesSearchQuery = (c: Client, debouncedSearch: string): boolean => {
  if (!debouncedSearch) return true;
  
  const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase();
  const clientNumber = (c.clientNumber ?? '').toLowerCase();
  const address = `${c.address.city ?? ''} ${c.address.state ?? ''}`.toLowerCase();

  return (
    fullName.includes(debouncedSearch) ||
    clientNumber.includes(debouncedSearch) ||
    address.includes(debouncedSearch)
  );
};
```

### For Server-Side Search

If your dataset is too large for client-side filtering, adapt the pattern:

1. Keep the 300ms debounce (even more important for network requests)
2. Pass `debouncedSearch` to your query hook, not raw `searchQuery`
3. Include `debouncedSearch` in React Query's `queryKey`
4. Keep all other UI components (chips, clear buttons, empty state) unchanged

```typescript
// Example: Server-side search
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchQuery.trim().toLowerCase());
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// Pass debounced value to query hook
const { data, isLoading } = useClients({
  query: debouncedSearch,
  // ... other filters
});
```

**Critical:** NEVER pass raw `searchQuery` directly to a query hook. Always debounce first.

## Visual Design Tokens

Match the reference implementation's styling:

```css
/* Search input container */
.relative.flex-1

/* Search icon (left) */
.w-4.h-4.text-gray-400.absolute.left-3.top-1/2.-translate-y-1/2.pointer-events-none

/* Clear button (right) */
.absolute.right-2.5.top-1/2.-translate-y-1/2.text-muted-foreground.hover:text-foreground.p-0.5.h-6.w-6

/* Filter chip row */
.flex.flex-wrap.items-center.gap-2.pt-2.border-t.border-border.text-xs

/* Search chip */
.inline-flex.items-center.gap-1.px-2.5.py-1.rounded-full.bg-muted.text-foreground.font-medium

/* Chip X button */
.hover:text-inherit.ml-0.5.h-3.5.w-3.5.p-0.hover:bg-transparent

/* Reset all link */
.font-medium.ml-1.h-auto.p-0
```

## Testing Strategy

### Manual Testing

1. **Debounce verification:**
   - Type a 4+ character query rapidly
   - Verify: Only ONE update occurs ~300ms after typing stops
   - Verify: No intermediate updates per keystroke

2. **Clear button:**
   - Enter a search query
   - Click the X button in the input
   - Verify: Input clears immediately
   - Verify: Results reset to unfiltered state

3. **Filter chips:**
   - Enter a search query
   - Apply other filters (status, type, etc.)
   - Verify: All active filters show as chips
   - Click X on search chip
   - Verify: Only search clears (other filters remain)

4. **Reset all:**
   - Apply multiple filters including search
   - Click "Reset all" link
   - Verify: All filters clear
   - Verify: Results show full unfiltered list

5. **Empty state:**
   - Apply filters that produce zero results
   - Verify: Empty state message displays
   - Verify: "Reset Filters" button appears
   - Click reset button
   - Verify: Filters clear and results reappear

### Automated Testing (Playwright/Vitest)

```typescript
// Example: Debounce test
test('search debounces 300ms', async ({ page }) => {
  await page.goto('/visits');
  
  const searchInput = page.locator('input[placeholder*="Search"]');
  
  // Type rapidly
  await searchInput.type('Jane');
  
  // Wait for debounce
  await page.waitForTimeout(350);
  
  // Verify: Only one network request made
  const requests = await page.context().requests();
  const searchRequests = requests.filter(r => r.url().includes('visits?'));
  expect(searchRequests.length).toBe(1);
});
```

## Migration Path

To migrate an existing search implementation to this pattern:

1. **Audit current implementation:**
   - Does it debounce? (If no, high priority)
   - Does it show active filters as chips? (If no, medium priority)
   - Does it have clear/reset actions? (If no, medium priority)

2. **Implement in priority order:**
   - Phase 1: Add debounce (fixes performance/UX bugs)
   - Phase 2: Add filter chips (improves discoverability)
   - Phase 3: Add empty state guidance (reduces confusion)

3. **Test thoroughly:**
   - Run existing tests (should still pass)
   - Add new tests for debounce behavior
   - Manual QA of all filter combinations

## Related Documentation

- `docs/ta-spec-search-debounce-standardization.md` - Original spec for Clients/Caregivers search fixes (FC-SEARCH-001)
- `packages/web/src/verticals/scheduling-visits/pages/VisitList.tsx` - Reference implementation

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-11-02 | Initial documentation from VisitList.tsx reference | AI Agent (wdvf3acgzh) |

---

**Questions or feedback?** This is the canonical pattern. If you need to deviate, document why and propose an alternative for team review.
