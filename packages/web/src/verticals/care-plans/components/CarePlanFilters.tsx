import React from 'react';
import { Search, X } from 'lucide-react';
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

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const CarePlanFilters: React.FC<CarePlanFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [queryInput, setQueryInput] = React.useState(filters.query || '');

  // Sync input when filters change externally
  React.useEffect(() => {
    if (filters.query !== queryInput) {
      setQueryInput(filters.query || '');
    }
  }, [filters.query]);

  // Debounced query update
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.query || '') !== queryInput) {
        onFiltersChange({ ...filters, query: queryInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const activeCount = React.useMemo(() => {
    let count = 0;
    if (filters.status?.length) count++;
    if (filters.priority?.length) count++;
    if (filters.createdDateFrom) count++;
    if (filters.createdDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (status: CarePlanStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const togglePriority = (priority: Priority) => {
    const current = filters.priority || [];
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by plan name or client name..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          {queryInput && (
            <button
              type="button"
              onClick={() => setQueryInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
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
              isChecked: filters.priority?.includes(opt.value) ?? false,
            }))}
            onToggle={(value: string) => togglePriority(value as Priority)}
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
