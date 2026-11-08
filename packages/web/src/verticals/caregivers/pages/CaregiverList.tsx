/**
 * Caregiver List Page
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Grid, List, Users, Sparkles, Search, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { 
  LoadingSpinner, 
  EmptyState, 
  ErrorMessage
} from '@/core/components/index.js';
import { Badge } from '@/components/ui/badge.js';
import { usePermissions, useSectionAccess, useDemoData } from '@/core/hooks/index.js';
import { useCaregivers } from '../hooks/index.js';
import { CaregiverCard, CaregiverFilters } from '../components/index.js';
import type { CaregiverSearchFilters, CaregiverListItem } from '../types/index.js';

// Map label display for filter chips
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ONBOARDING: 'Onboarding',
  ON_LEAVE: 'On Leave',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-Time',
  PART_TIME: 'Part-Time',
  PER_DIEM: 'Per Diem',
  CONTRACT: 'Contract',
  TEMPORARY: 'Temporary',
};

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  COMPLIANT: 'Compliant',
  PENDING_VERIFICATION: 'Pending Verification',
  EXPIRING_SOON: 'Expiring Soon',
  EXPIRED: 'Expired',
  NON_COMPLIANT: 'Non-Compliant',
};

/**
 * Matches caregiver against search query
 * Searches: name, employee number
 */
const matchesSearchQuery = (c: CaregiverListItem, debouncedSearch: string): boolean => {
  if (!debouncedSearch) return true;
  
  const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
  const employeeNumber = c.employeeNumber.toLowerCase();
  
  return (
    fullName.includes(debouncedSearch) ||
    employeeNumber.includes(debouncedSearch)
  );
};

export const CaregiverList: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { canWrite, readOnly } = useSectionAccess('caregivers');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Search state with 300ms debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Advanced filters (from dropdown)
  const [advancedFilters, setAdvancedFilters] = useState<CaregiverSearchFilters>({});

  // Fetch all caregivers (we'll filter client-side)
  const { data, isLoading, error, refetch } = useCaregivers({});
  const {
    hasDemoData,
    isSeeding,
    seedDemoData,
  } = useDemoData();

  const caregiverList: CaregiverListItem[] = useMemo(() => data?.items ?? [], [data]);
  const totalCaregivers = caregiverList.length;

  // Client-side filtering with debounced search
  const filteredCaregivers = useMemo(() => {
    return caregiverList.filter((c) => {
      // 1. Search query filter (debounced)
      if (!matchesSearchQuery(c, debouncedSearch)) {
        return false;
      }

      // 2. Status filter
      if (advancedFilters.status && advancedFilters.status.length > 0) {
        if (!advancedFilters.status.includes(c.status)) return false;
      }

      // 3. Employment Type filter
      if (advancedFilters.employmentType && advancedFilters.employmentType.length > 0) {
        if (!advancedFilters.employmentType.includes(c.employmentType)) return false;
      }

      // 4. Compliance Status filter
      if (advancedFilters.complianceStatus && advancedFilters.complianceStatus.length > 0) {
        if (!advancedFilters.complianceStatus.includes(c.complianceStatus)) return false;
      }

      // 5. Hire Date Range filter
      if (advancedFilters.hireDateFrom) {
        const hireDateStr = c.hireDate.toISOString().split('T')[0]!;
        const fromDateStr = advancedFilters.hireDateFrom;
        if (hireDateStr < fromDateStr) return false;
      }
      if (advancedFilters.hireDateTo) {
        const hireDateStr = c.hireDate.toISOString().split('T')[0]!;
        const toDateStr = advancedFilters.hireDateTo;
        if (hireDateStr > toDateStr) return false;
      }

      return true;
    });
  }, [caregiverList, debouncedSearch, advancedFilters]);

  // Active filter count for dropdown badge
  const activeAdvancedFilterCount = useMemo(() => {
    return (
      (advancedFilters.status?.length ?? 0) +
      (advancedFilters.employmentType?.length ?? 0) +
      (advancedFilters.complianceStatus?.length ?? 0) +
      (advancedFilters.hireDateFrom ? 1 : 0) +
      (advancedFilters.hireDateTo ? 1 : 0)
    );
  }, [advancedFilters]);

  const hasAnyFilterActive = useMemo(() => {
    return (
      Boolean(debouncedSearch) ||
      activeAdvancedFilterCount > 0
    );
  }, [debouncedSearch, activeAdvancedFilterCount]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setAdvancedFilters({});
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        message={(error as Error).message || 'Failed to load caregivers'}
        retry={() => {
          refetch().catch((err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'Failed to reload caregivers');
          });
        }}
      />
    );
  }

  const filteredCount = filteredCaregivers.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-gray-900">Caregivers</h1>{readOnly && <Badge variant="secondary">Read-only</Badge>}</div>
          <p className="text-gray-600 mt-1">
            {(() => {
              if (totalCaregivers === 0) return 'No caregivers';
              if (hasAnyFilterActive) {
                return `Showing ${filteredCount} of ${totalCaregivers} caregivers`;
              }
              return `${totalCaregivers} total caregivers`;
            })()}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-border rounded-md p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {can('caregivers:write') && canWrite && (
            <Link to="/caregivers/new">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                New Caregiver
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by name or employee #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 bg-white"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 h-6 w-6"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <CaregiverFilters 
              filters={advancedFilters} 
              onFiltersChange={setAdvancedFilters}
            />

            {hasAnyFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
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

            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground font-medium">
                Search: &quot;{debouncedSearch}&quot;
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                  aria-label="Remove search filter"
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            )}

            {advancedFilters.status?.map((st) => (
              <span
                key={st}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
              >
                Status: {STATUS_LABELS[st] ?? st}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      status: advancedFilters.status?.filter((s) => s !== st),
                    })
                  }
                  className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                  aria-label={`Remove status ${st} filter`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            ))}

            {advancedFilters.employmentType?.map((et) => (
              <span
                key={et}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
              >
                Type: {EMPLOYMENT_TYPE_LABELS[et] ?? et}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      employmentType: advancedFilters.employmentType?.filter((t) => t !== et),
                    })
                  }
                  className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                  aria-label={`Remove type ${et} filter`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            ))}

            {advancedFilters.complianceStatus?.map((cs) => (
              <span
                key={cs}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
              >
                Compliance: {COMPLIANCE_STATUS_LABELS[cs] ?? cs}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      complianceStatus: advancedFilters.complianceStatus?.filter((c) => c !== cs),
                    })
                  }
                  className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                  aria-label={`Remove compliance ${cs} filter`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            ))}

            {(advancedFilters.hireDateFrom ?? advancedFilters.hireDateTo) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                Hire Date: {String(advancedFilters.hireDateFrom ?? 'Any')} to {String(advancedFilters.hireDateTo ?? 'Any')}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      hireDateFrom: undefined,
                      hireDateTo: undefined,
                    })
                  }
                  className="hover:text-inherit ml-0.5 h-3.5 w-3.5 p-0 hover:bg-transparent"
                  aria-label="Remove hire date filter"
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            )}

            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={clearAllFilters}
              className="font-medium ml-1 h-auto p-0"
            >
              Reset all
            </Button>
          </div>
        )}
      </div>

      {/* Empty State - No Caregivers at All */}
      {totalCaregivers === 0 && (
        <EmptyState
          title="No caregivers found"
          description={
            !hasDemoData
              ? "Get started by loading sample data to explore the platform, or add your first caregiver."
              : "Get started by creating your first caregiver."
          }
          icon={<Users />}
          size="lg"
          action={
            !hasDemoData ? (
              <Button
                variant="default"
                size="lg"
                onClick={() => void seedDemoData()}
                disabled={isSeeding}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isSeeding ? 'Loading...' : 'Load Sample Data'}
              </Button>
            ) : (
              can('caregivers:write') && canWrite && (
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    Promise.resolve(navigate('/caregivers/new')).catch((err: unknown) => {
                      toast.error(err instanceof Error ? err.message : 'Navigation failed');
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Caregiver
                </Button>
              )
            )
          }
          secondaryAction={
            !hasDemoData && can('caregivers:write') && canWrite ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  Promise.resolve(navigate('/caregivers/new')).catch((err: unknown) => {
                    toast.error(err instanceof Error ? err.message : 'Navigation failed');
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Caregiver
              </Button>
            ) : null
          }
        />
      )}

      {/* Filtered Empty State - Caregivers exist but none match filters */}
      {totalCaregivers > 0 && filteredCaregivers.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-500">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">No caregivers match your filter</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, status filters, or other criteria to see more results.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      )}

      {/* Caregiver List */}
      {totalCaregivers > 0 && filteredCaregivers.length > 0 && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {filteredCaregivers.map((caregiver) => (
            <CaregiverCard
              key={caregiver.id}
              caregiver={caregiver}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
};
