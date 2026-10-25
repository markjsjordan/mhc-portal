/**
 * Caregiver List Page
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Grid, List, Users, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { 
  LoadingSpinner, 
  EmptyState, 
  ErrorMessage
} from '@/core/components/index.js';
import { usePermissions, useDemoData } from '@/core/hooks/index.js';
import { useCaregivers } from '../hooks/index.js';
import { CaregiverCard, CaregiverFilters } from '../components/index.js';
import type { CaregiverSearchFilters } from '../types/index.js';

export const CaregiverList: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [filters, setFilters] = useState<CaregiverSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data, isLoading, error, refetch } = useCaregivers(filters);
  const {
    hasDemoData,
    isSeeding,
    seedDemoData,
  } = useDemoData();

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

  const caregivers = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caregivers</h1>
          <p className="text-gray-600 mt-1">
            {data?.total ?? 0} total caregivers
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
          {can('caregivers:write') && (
            <Link to="/caregivers/new">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                New Caregiver
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Demo Data Banner removed: not shown in the current build */}

      <CaregiverFilters filters={filters} onFiltersChange={setFilters} />

      {caregivers.length === 0 ? (
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
              can('caregivers:write') && (
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
            !hasDemoData && can('caregivers:write') ? (
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
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {caregivers.map((caregiver) => (
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
