import React from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Badge } from '@/components/ui/badge.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { CarePlanSearchFilters, CarePlanStatus, CarePlanType, ComplianceStatus } from '../types';

export interface CarePlanSearchProps {
  filters: CarePlanSearchFilters;
  onFiltersChange: (filters: CarePlanSearchFilters) => void;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
  { value: 'COMPLETED', label: 'Completed' },
];

const planTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'PERSONAL_CARE', label: 'Personal Care' },
  { value: 'COMPANION', label: 'Companion' },
  { value: 'SKILLED_NURSING', label: 'Skilled Nursing' },
  { value: 'THERAPY', label: 'Therapy' },
  { value: 'HOSPICE', label: 'Hospice' },
  { value: 'RESPITE', label: 'Respite' },
  { value: 'LIVE_IN', label: 'Live In' },
  { value: 'CUSTOM', label: 'Custom' },
];

const complianceOptions = [
  { value: '', label: 'All Compliance Statuses' },
  { value: 'COMPLIANT', label: 'Compliant' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'NON_COMPLIANT', label: 'Non-Compliant' },
];

export const CarePlanSearch: React.FC<CarePlanSearchProps> = ({ filters, onFiltersChange }) => {
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
    if (filters.planType && filters.planType.length > 0) count++;
    if (filters.complianceStatus && filters.complianceStatus.length > 0) count++;
    if (filters.coordinatorId?.trim()) count++;
    if (filters.clientId?.trim()) count++;
    if (filters.organizationId?.trim()) count++;
    if (filters.branchId?.trim()) count++;
    if (filters.expiringWithinDays !== undefined) count++;
    return count;
  }, [filters]);

  const hasAnyActiveFilter = Boolean(queryInput) || activeFilterCount > 0;

  const handleClearFilters = () => {
    setQueryInput('');
    onFiltersChange({});
  };

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input styled uniform with Client and Caregiver search */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            id="care-plan-search-input"
            type="text"
            placeholder="Search by name, plan number, or client ID..."
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

        {/* Filter Toggle & Clear Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant={showAdvanced || activeFilterCount > 0 ? 'secondary' : 'outline'}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {hasAnyActiveFilter && (
            <Button
              type="button"
              variant="ghost"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="care-plan-status-select">Status</Label>
            <Select
              value={filters.status?.[0] ?? 'ALL'}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  status: val === 'ALL' || !val ? undefined : [val as CarePlanStatus],
                })
              }
            >
              <SelectTrigger id="care-plan-status-select">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-plan-type-select">Plan Type</Label>
            <Select
              value={filters.planType?.[0] ?? 'ALL'}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  planType: val === 'ALL' || !val ? undefined : [val as CarePlanType],
                })
              }
            >
              <SelectTrigger id="care-plan-type-select">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {planTypeOptions.map((opt) => (
                  <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-plan-compliance-select">Compliance Status</Label>
            <Select
              value={filters.complianceStatus?.[0] ?? 'ALL'}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  complianceStatus: val === 'ALL' || !val ? undefined : [val as ComplianceStatus],
                })
              }
            >
              <SelectTrigger id="care-plan-compliance-select">
                <SelectValue placeholder="All Compliance Statuses" />
              </SelectTrigger>
              <SelectContent>
                {complianceOptions.map((opt) => (
                  <SelectItem key={opt.value || 'ALL'} value={opt.value || 'ALL'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="coordinator-id-input">Coordinator ID</Label>
            <Input
              id="coordinator-id-input"
              value={filters.coordinatorId ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, coordinatorId: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-id-input">Client ID</Label>
            <Input
              id="client-id-input"
              value={filters.clientId ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, clientId: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-id-input">Organization ID</Label>
            <Input
              id="org-id-input"
              value={filters.organizationId ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, organizationId: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="branch-id-input">Branch ID</Label>
            <Input
              id="branch-id-input"
              value={filters.branchId ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, branchId: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expiring-within-input">Expiring Within (days)</Label>
            <Input
              id="expiring-within-input"
              type="number"
              value={filters.expiringWithinDays?.toString() ?? ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  expiringWithinDays: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
