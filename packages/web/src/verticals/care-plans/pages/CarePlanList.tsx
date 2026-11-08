import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Grid, List, FileText, Search } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { usePermissions } from '@/core/hooks';
import { useCarePlans } from '../hooks';
import { CarePlanCard, CarePlanFilters } from '../components';
import type { CarePlanSearchFilters } from '../types';

export const CarePlanList: React.FC = () => {
  const { can } = usePermissions();
  const [filters, setFilters] = useState<CarePlanSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data, isLoading, isFetching, error, refetch } = useCarePlans(filters);

  const carePlans = data?.items ?? [];
  const totalCarePlans = data?.total ?? 0;

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(filters.query) ||
      Boolean(filters.status?.length) ||
      Boolean(filters.priority?.length) ||
      Boolean(filters.createdDateFrom) ||
      Boolean(filters.createdDateTo)
    );
  }, [filters]);

  const clearAllFilters = () => {
    setFilters({});
  };

  const getSubtitleText = () => {
    if (totalCarePlans === 0) return 'No care plans found';
    if (hasActiveFilters) {
      return `Showing ${carePlans.length} of ${totalCarePlans} care plans`;
    }
    return `${totalCarePlans} total care plans`;
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
        message={(error as Error).message || 'Failed to load care plans'}
        retry={() => { void refetch(); }}
      />
    );
  }

  const renderContent = () => {
    if (totalCarePlans === 0 && !hasActiveFilters) {
      return (
        <EmptyState
          title="No care plans found"
          description="Get started by creating your first care plan."
          action={
            can('care_plans:write') ? (
              <Link to="/care-plans/new">
                <Button variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Care Plan
                </Button>
              </Link>
            ) : undefined
          }
        />
      );
    }

    if (totalCarePlans > 0 && carePlans.length === 0) {
      return (
        <div className="bg-card text-card-foreground rounded-xl border border-border p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No care plans match your filter</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Try adjusting your search query or filters to see more results.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }
      >
        {carePlans.map((carePlan) => (
          <CarePlanCard
            key={carePlan.id}
            carePlan={carePlan}
            compact={viewMode === 'list'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Care Plans</h1>
            {isFetching ? (
              <LoadingSpinner size="sm" className="text-muted-foreground" />
            ) : null}
          </div>
          <p className="text-gray-600 mt-1">
            {getSubtitleText()}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-input rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className="rounded-none h-9 w-9"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className="rounded-none h-9 w-9"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {can('care_plans:write') && (
            <>
              <Link to="/care-plans/from-template">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  From Template
                </Button>
              </Link>
              <Link to="/care-plans/new">
                <Button variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  New Care Plan
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <CarePlanFilters filters={filters} onFiltersChange={setFilters} />

      {renderContent()}

      {data && data.hasMore && (
        <div className="flex justify-center">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
};