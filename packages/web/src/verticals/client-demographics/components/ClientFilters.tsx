import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import {
  FilterDropdown,
  FilterCheckboxSection,
  FilterDateRangeSection,
} from '@/core/components';
import type { ClientSearchFilters, ClientStatus } from '../types';

export interface ClientFiltersProps {
  filters: ClientSearchFilters;
  onFiltersChange: (filters: ClientSearchFilters) => void;
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'PENDING_INTAKE', label: 'Pending Intake' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DISCHARGED', label: 'Discharged' },
];

const SERVICE_LEVEL_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'INTENSIVE', label: 'Intensive' },
];

const INSURANCE_TYPE_OPTIONS = [
  { value: 'MEDICAID', label: 'Medicaid' },
  { value: 'MEDICARE', label: 'Medicare' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export const ClientFilters: React.FC<ClientFiltersProps> = ({
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
    if (filters.serviceLevel?.length) count++;
    if (filters.insuranceType?.length) count++;
    if (filters.createdDateFrom) count++;
    if (filters.createdDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (value: string) => {
    const status = value as ClientStatus;
    const current = filters.status ?? [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleServiceLevel = (level: string) => {
    const current = filters.serviceLevel ?? [];
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    onFiltersChange({
      ...filters,
      serviceLevel: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleInsuranceType = (type: string) => {
    const current = filters.insuranceType ?? [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({
      ...filters,
      insuranceType: updated.length > 0 ? updated : undefined,
    });
  };

  const handleClearAll = () => {
    setQueryInput('');
    onFiltersChange({
      query: undefined,
      status: undefined,
      serviceLevel: undefined,
      insuranceType: undefined,
      createdDateFrom: undefined,
      createdDateTo: undefined,
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
            placeholder="Search by name or client number..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="pl-9 pr-9"
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
          title="Filter Clients"
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

          {/* Service Level Section */}
          <FilterCheckboxSection
            label="Service Level"
            options={SERVICE_LEVEL_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.serviceLevel?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleServiceLevel}
          />

          {/* Insurance Type Section */}
          <FilterCheckboxSection
            label="Insurance Type"
            options={INSURANCE_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.insuranceType?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleInsuranceType}
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
