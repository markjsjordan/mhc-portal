import React from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/core/components';
import type { CaregiverSearchFilters } from '../types';

export interface CaregiverSearchProps {
  filters: CaregiverSearchFilters;
  onFiltersChange: (filters: CaregiverSearchFilters) => void;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'APPLICATION', label: 'Application' },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'PENDING_ONBOARDING', label: 'Pending Onboarding' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RETIRED', label: 'Retired' },
];

const roleOptions = [
  { value: '', label: 'All Roles' },
  { value: 'RN', label: 'Registered Nurse' },
  { value: 'LPN', label: 'Licensed Practical Nurse' },
  { value: 'CNA', label: 'Certified Nursing Assistant' },
  { value: 'HHA', label: 'Home Health Aide' },
  { value: 'PT', label: 'Physical Therapist' },
  { value: 'OT', label: 'Occupational Therapist' },
  { value: 'THERAPIST', label: 'Therapist' },
  { value: 'SUPPORT', label: 'Support Staff' },
];

const complianceStatusOptions = [
  { value: '', label: 'All Compliance Status' },
  { value: 'COMPLIANT', label: 'Compliant' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'NON_COMPLIANT', label: 'Non-Compliant' },
];

export const CaregiverSearch: React.FC<CaregiverSearchProps> = ({ filters, onFiltersChange }) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Search input state with 300ms debounce
  const [queryInput, setQueryInput] = React.useState(filters.query ?? '');
  const [prevQuery, setPrevQuery] = React.useState(filters.query);

  if (filters.query !== prevQuery) {
    setPrevQuery(filters.query);
    setQueryInput(filters.query ?? '');
  }

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.query ?? '') !== queryInput) {
        onFiltersChange({ ...filters, query: queryInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.status && filters.status.length > 0) count++;
    if (filters.role && filters.role.length > 0) count++;
    if (filters.complianceStatus && filters.complianceStatus.length > 0) count++;
    return count;
  }, [filters]);

  const hasAnyActiveFilter = Boolean(queryInput) || activeFilterCount > 0;

  // Clear all filters
  const handleClearFilters = () => {
    setQueryInput('');
    onFiltersChange({});
  };

  // Get current status value
  const currentStatusValue = React.useMemo(() => {
    return filters.status && filters.status.length > 0 ? filters.status[0] : '';
  }, [filters.status]);

  // Get current role value
  const currentRoleValue = React.useMemo(() => {
    return filters.role && filters.role.length > 0 ? filters.role[0] : '';
  }, [filters.role]);

  // Get current compliance status value
  const currentComplianceStatusValue = React.useMemo(() => {
    return filters.complianceStatus && filters.complianceStatus.length > 0 ? filters.complianceStatus[0] : '';
  }, [filters.complianceStatus]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input styled like Schedule search bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name or employee number..."
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

        {/* Filter Toggle & Clear Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant={showAdvanced || activeFilterCount > 0 ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {hasAnyActiveFilter && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
          <Select
            label="Status"
            options={statusOptions}
            value={currentStatusValue}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                status: e.target.value ? [e.target.value as any] : undefined,
              })
            }
          />
          <Select
            label="Role"
            options={roleOptions}
            value={currentRoleValue}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                role: e.target.value ? [e.target.value as any] : undefined,
              })
            }
          />
          <Select
            label="Compliance Status"
            options={complianceStatusOptions}
            value={currentComplianceStatusValue}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                complianceStatus: e.target.value ? [e.target.value as any] : undefined,
              })
            }
          />
        </div>
      )}
    </div>
  );
};
