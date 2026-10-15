import React from 'react';
import { Search, X } from 'lucide-react';
import {
  FilterDropdown,
  FilterCheckboxSection,
  FilterDateRangeSection,
} from '@/core/components';
import type { TaskInstanceSearchFilters, TaskStatus, TaskCategory } from '../types';

export interface TaskFiltersProps {
  filters: TaskInstanceSearchFilters;
  onFiltersChange: (filters: TaskInstanceSearchFilters) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'MISSED', label: 'Missed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ISSUE_REPORTED', label: 'Issue Reported' },
];


const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: 'PERSONAL_HYGIENE', label: 'Personal Hygiene' },
  { value: 'BATHING', label: 'Bathing' },
  { value: 'DRESSING', label: 'Dressing' },
  { value: 'GROOMING', label: 'Grooming' },
  { value: 'TOILETING', label: 'Toileting' },
  { value: 'MOBILITY', label: 'Mobility' },
  { value: 'TRANSFERRING', label: 'Transferring' },
  { value: 'AMBULATION', label: 'Ambulation' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'MEAL_PREPARATION', label: 'Meal Preparation' },
  { value: 'FEEDING', label: 'Feeding' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'LAUNDRY', label: 'Laundry' },
  { value: 'SHOPPING', label: 'Shopping' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'COMPANIONSHIP', label: 'Companionship' },
  { value: 'MONITORING', label: 'Monitoring' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'OTHER', label: 'Other' },
];

export const TaskFilters: React.FC<TaskFiltersProps> = ({
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
    if (filters.category?.length) count++;
    if (filters.scheduledDateFrom) count++;
    if (filters.scheduledDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (status: TaskStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleCategory = (category: TaskCategory) => {
    const current = filters.category || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    onFiltersChange({
      ...filters,
      category: updated.length > 0 ? updated : undefined,
    });
  };

  const handleClearAll = () => {
    setQueryInput('');
    onFiltersChange({
      ...Object.fromEntries(
        Object.entries(filters).filter(
          ([key]) => key === 'clientId' || key === 'carePlanId'
        )
      ),
      query: undefined,
      status: undefined,
      category: undefined,
      scheduledDateFrom: undefined,
      scheduledDateTo: undefined,
    } as TaskInstanceSearchFilters);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks by description..."
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
          title="Filter Tasks"
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
            onToggle={(value: string) => toggleStatus(value as TaskStatus)}
          />

          {/* Category Section */}
          <FilterCheckboxSection
            label="Category"
            options={CATEGORY_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.category?.includes(opt.value) ?? false,
            }))}
            onToggle={(value: string) => toggleCategory(value as TaskCategory)}
          />

          {/* Date Range Section */}
          <FilterDateRangeSection
            label="Scheduled Date"
            fromValue={filters.scheduledDateFrom}
            toValue={filters.scheduledDateTo}
            onFromChange={(value) =>
              onFiltersChange({
                ...filters,
                scheduledDateFrom: value || undefined,
              })
            }
            onToChange={(value) =>
              onFiltersChange({
                ...filters,
                scheduledDateTo: value || undefined,
              })
            }
          />
        </FilterDropdown>
      </div>
    </div>
  );
};
