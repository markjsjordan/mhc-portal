import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
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

const STATUS_LABELS: Record<ClientStatus, string> = {
  INQUIRY: 'Inquiry',
  PENDING_INTAKE: 'Pending Intake',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_HOLD: 'On Hold',
  DISCHARGED: 'Discharged',
  DECEASED: 'Deceased',
};

export const ClientFilters: React.FC<ClientFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [queryInput, setQueryInput] = React.useState(filters.query ?? '');
  const [debouncedQuery, setDebouncedQuery] = React.useState(filters.query ?? '');

  // Sync input when filters change externally
  React.useEffect(() => {
    setQueryInput(filters.query ?? '');
  }, [filters.query]);

  // Debounced query update (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(queryInput.trim());
      if ((filters.query ?? '') !== queryInput.trim()) {
        onFiltersChange({ ...filters, query: queryInput.trim() || undefined });
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

  const hasAnyFilterActive = React.useMemo(() => {
    return Boolean(debouncedQuery) || activeCount > 0;
  }, [debouncedQuery, activeCount]);

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
    setDebouncedQuery('');
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
              size="icon-xs"
              onClick={() => setQueryInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 h-6 w-6"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Filter Dropdown & Clear All */}
        <div className="flex items-center gap-2">
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

          {hasAnyFilterActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              title="Clear all active filters"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasAnyFilterActive && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
          <span className="text-muted-foreground font-medium">Active filters:</span>

          {debouncedQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground font-medium">
              Search: &quot;{debouncedQuery}&quot;
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setQueryInput('')}
                className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                aria-label="Remove search filter"
              >
                <X className="w-3 h-3" />
              </Button>
            </span>
          )}

          {filters.status?.map((st) => (
            <span
              key={st}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
            >
              Status: {STATUS_LABELS[st] || st}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    status: filters.status?.filter((s) => s !== st),
                  })
                }
                className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                aria-label={`Remove status ${st} filter`}
              >
                <X className="w-3 h-3" />
              </Button>
            </span>
          ))}

          {filters.serviceLevel?.map((level) => (
            <span
              key={level}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
            >
              Service Level: {level}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    serviceLevel: filters.serviceLevel?.filter((l) => l !== level),
                  })
                }
                className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                aria-label={`Remove service level ${level} filter`}
              >
                <X className="w-3 h-3" />
              </Button>
            </span>
          ))}

          {filters.insuranceType?.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
            >
              Insurance: {type}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    insuranceType: filters.insuranceType?.filter((t) => t !== type),
                  })
                }
                className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                aria-label={`Remove insurance type ${type} filter`}
              >
                <X className="w-3 h-3" />
              </Button>
            </span>
          ))}

          {(filters.createdDateFrom ?? filters.createdDateTo) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
              Date: {String(filters.createdDateFrom ?? 'Any')} to {String(filters.createdDateTo ?? 'Any')}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    createdDateFrom: undefined,
                    createdDateTo: undefined,
                  })
                }
                className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                aria-label="Remove date filter"
              >
                <X className="w-3 h-3" />
              </Button>
            </span>
          )}

          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={handleClearAll}
            className="font-medium ml-1 h-auto p-0"
          >
            Reset all
          </Button>
        </div>
      )}
    </div>
  );
};
