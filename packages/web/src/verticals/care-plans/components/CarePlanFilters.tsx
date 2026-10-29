import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import {
  FilterDropdown,
  FilterCheckboxSection,
  FilterDateRangeSection,
} from '@/core/components';
import type { CarePlanSearchFilters, CarePlanStatus, Priority } from '../types';

export interface CarePlanFiltersProps {
  filters: CarePlanSearchFilters;
  onFiltersChange: (filters: CarePlanSearchFilters) => void;
}

const STATUS_OPTIONS: { value: CarePlanStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const CarePlanFilters: React.FC<CarePlanFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [queryInput, setQueryInput] = React.useState(filters.query ?? '');

  // Sync input when filters change externally
  React.useEffect(() => {
    setQueryInput(filters.query ?? '');
  }, [filters.query]);

  // Debounced query update
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.query ?? '') !== queryInput) {
        onFiltersChange({ ...filters, query: queryInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput, filters, onFiltersChange]);

  const activeCount = React.useMemo(() => {
    let count = 0;
    if (filters.status?.length) count++;
    if (filters.priority?.length) count++;
    if (filters.createdDateFrom) count++;
    if (filters.createdDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (value: string) => {
    const status = value as CarePlanStatus;
    const current = filters.status ?? [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const togglePriority = (value: string) => {
    const priority = value as Priority;
    const current = filters.priority ?? [];
    const updated = current.includes(priority)
      ? current.filter((p) => p !== priority)
      : [...current, priority];
    onFiltersChange({
      ...filters,
      priority: updated.length > 0 ? updated : undefined,
    });
  };

  const handleClearAll = () => {
    setQueryInput('');
    onFiltersChange({
      query: undefined,
      status: undefined,
      priority: undefined,
      createdDateFrom: undefined,
      createdDateTo: undefined,
    });
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            id="care-plan-filters-search-input"
            type="text"
            placeholder="Search by plan name or client name..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="pl-10 pr-9"
          />
          {queryInput && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQueryInput('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Filter Dropdown */}
        <FilterDropdown
          title="Filter Care Plans"
          activeCount={activeCount}
          onClearAll={handleClearAll}
          width="md"
        >
          {/* Status Section */}
          <FilterCheckboxSection
            label="Status"
            options={STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.status?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleStatus}
          />

          {/* Priority Section */}
          <FilterCheckboxSection
            label="Priority"
            options={PRIORITY_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.priority?.includes(opt.value as Priority) ?? false,
            }))}
            onToggle={togglePriority}
          />

          {/* Date Range Section */}
          <FilterDateRangeSection
            label="Created Date"
            fromValue={filters.createdDateFrom}
            toValue={filters.createdDateTo}
            onFromChange={(value) =>
              onFiltersChange({
                ...filters,
                createdDateFrom: value || undefined,
              })
            }
            onToChange={(value) =>
              onFiltersChange({
                ...filters,
                createdDateTo: value || undefined,
              })
            }
          />
        </FilterDropdown>
      </div>
    </div>
  );
};
