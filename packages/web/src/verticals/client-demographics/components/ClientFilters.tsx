import React from 'react';
import { Search, X } from 'lucide-react';
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
  const [queryInput, setQueryInput] = React.useState(filters.query || '');

  React.useEffect(() => {
    if (filters.query !== queryInput) {
      setQueryInput(filters.query || '');
    }
  }, [filters.query]);

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
    if (filters.serviceLevel?.length) count++;
    if (filters.insuranceType?.length) count++;
    if (filters.createdDateFrom) count++;
    if (filters.createdDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (status: ClientStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleServiceLevel = (level: string) => {
    const current = filters.serviceLevel || [];
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    onFiltersChange({
      ...filters,
      serviceLevel: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleInsuranceType = (type: string) => {
    const current = filters.insuranceType || [];
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
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or client number..."
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

        <FilterDropdown
          title="Filter Clients"
          activeCount={activeCount}
          onClearAll={handleClearAll}
          width="md"
        >
          <FilterCheckboxSection
            label="Status"
            options={STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.status?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleStatus}
          />

          <FilterCheckboxSection
            label="Service Level"
            options={SERVICE_LEVEL_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.serviceLevel?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleServiceLevel}
          />

          <FilterCheckboxSection
            label="Insurance Type"
            options={INSURANCE_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              isChecked: filters.insuranceType?.includes(opt.value) ?? false,
            }))}
            onToggle={toggleInsuranceType}
          />

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