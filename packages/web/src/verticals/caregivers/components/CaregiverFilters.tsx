import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  FilterDropdown,
  FilterCheckboxSection,
  FilterDateRangeSection,
} from '@/core/components';
import type { CaregiverSearchFilters, CaregiverStatus } from '../types';

export interface CaregiverFiltersProps {
  filters: CaregiverSearchFilters;
  onFiltersChange: (filters: CaregiverSearchFilters) => void;
}

const STATUS_OPTIONS: { value: CaregiverStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-Time' },
  { value: 'PART_TIME', label: 'Part-Time' },
  { value: 'PER_DIEM', label: 'Per Diem' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TEMPORARY', label: 'Temporary' },
];

const COMPLIANCE_STATUS_OPTIONS = [
  { value: 'COMPLIANT', label: 'Compliant' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'NON_COMPLIANT', label: 'Non-Compliant' },
];

export const CaregiverFilters: React.FC<CaregiverFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [queryInput, setQueryInput] = React.useState(filters.query ?? '');

  // Sync input when filters change externally
  React.useEffect(() => {
    if (filters.query !== queryInput) {
      setQueryInput(filters.query ?? '');
    }
  }, [filters.query]);

  // Debounced query update
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.query ?? '') !== queryInput) {
        onFiltersChange({ ...filters, query: queryInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const activeCount = React.useMemo(() => {
    let count = 0;
    if (filters.status?.length) count++;
    if (filters.employmentType?.length) count++;
    if (filters.complianceStatus?.length) count++;
    if (filters.hireDateFrom) count++;
    if (filters.hireDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (value: string) => {
    const status = value as CaregiverStatus;
    const current = filters.status ?? [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleEmploymentType = (type: string) => {
    const current = filters.employmentType ?? [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({
      ...filters,
      employmentType: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleComplianceStatus = (status: string) => {
    const current = filters.complianceStatus ?? [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      complianceStatus: updated.length > 0 ? updated : undefined,
    });
  };

  const handleClearAll = () => {
    setQueryInput('');
    onFiltersChange({
      query: undefined,
      status: undefined,
      employmentType: undefined,
      complianceStatus: undefined,
      hireDateFrom: undefined,
      hireDateTo: undefined,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name or employee #..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {queryInput && (
            <button
              type="button"
              onClick={() => setQueryInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdown */}
        <FilterDropdown
          title="Filter Caregivers"
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

          {/* Employment Type Section */}
          <FilterCheckboxSection
            label="Employment Type"
            options={EMPLOYMENT_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.employmentType?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleEmploymentType}
          />

          {/* Compliance Status Section */}
          <FilterCheckboxSection
            label="Compliance Status"
            options={COMPLIANCE_STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.complianceStatus?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleComplianceStatus}
          />

          {/* Date Range Section */}
          <FilterDateRangeSection
            label="Hire Date"
            fromValue={filters.hireDateFrom}
            toValue={filters.hireDateTo}
            onFromChange={(value) =>
              onFiltersChange({
                ...filters,
                hireDateFrom: value || undefined,
              })
            }
            onToChange={(value) =>
              onFiltersChange({
                ...filters,
                hireDateTo: value || undefined,
              })
            }
          />
        </FilterDropdown>
      </div>
    </div>
  );
};
