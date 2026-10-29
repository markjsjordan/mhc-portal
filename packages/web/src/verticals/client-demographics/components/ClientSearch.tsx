import React from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { ClientSearchFilters, ClientStatus } from '../types';

export interface ClientSearchProps {
  filters: ClientSearchFilters;
  onFiltersChange: (filters: ClientSearchFilters) => void;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'PENDING_INTAKE', label: 'Pending Intake' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DISCHARGED', label: 'Discharged' },
];

export const ClientSearch: React.FC<ClientSearchProps> = ({ filters, onFiltersChange }) => {
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
        onFiltersChange({ ...filters, query: queryInput.trim() !== '' ? queryInput : undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput, filters, onFiltersChange]);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.status && filters.status.length > 0) count++;
    if (filters.city?.trim()) count++;
    if (filters.state?.trim()) count++;
    return count;
  }, [filters]);

  const hasAnyActiveFilter = Boolean(queryInput) || activeFilterCount > 0;

  // Clear all filters
  const handleClearFilters = () => {
    setQueryInput('');
    onFiltersChange({});
  };

  // Get current status value, ensuring it defaults to empty string
  const currentStatusValue = React.useMemo(() => {
    return filters.status && filters.status.length > 0 ? filters.status[0] : '';
  }, [filters.status]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar styled like Schedule page */}
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
          <div className="space-y-1.5">
            <Label htmlFor="client-search-status" className="text-sm font-medium text-foreground">Status</Label>
            <Select
              value={currentStatusValue !== '' ? currentStatusValue : 'ALL'}
              onValueChange={(val) =>
                onFiltersChange({
                  ...filters,
                  status: val === 'ALL' ? undefined : [val as ClientStatus],
                })
              }
            >
              <SelectTrigger id="client-search-status" className="w-full">
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
            <Label htmlFor="client-search-city" className="text-sm font-medium text-foreground">City</Label>
            <Input
              id="client-search-city"
              value={filters.city ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, city: e.target.value })}
              placeholder="Filter by city..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-search-state" className="text-sm font-medium text-foreground">State</Label>
            <Input
              id="client-search-state"
              value={filters.state ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, state: e.target.value })}
              placeholder="Filter by state..."
            />
          </div>
        </div>
      )}
    </div>
  );
};
