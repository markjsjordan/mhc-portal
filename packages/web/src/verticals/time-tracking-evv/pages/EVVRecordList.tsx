import React, { useState } from 'react';
import { Clock, Grid, List } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { useEVVRecords } from '../hooks';
import { EVVRecordCard, EVVRecordSearch } from '../components';
import type { EVVSearchFilters } from '../types';
import { toast } from 'sonner';

export const EVVRecordList: React.FC = () => {
  const [filters, setFilters] = useState<EVVSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data, isLoading, error, refetch } = useEVVRecords(filters);

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
        message={(error as Error).message || 'Failed to load EVV records'}
        retry={() => {
          refetch().catch((err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'Failed to reload records');
          });
        }}
      />
    );
  }

  const records = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking & EVV</h1>
          <p className="text-gray-600 mt-1">
            {data?.total ?? 0} total records
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-md p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <EVVRecordSearch filters={filters} onFiltersChange={setFilters} />

      {records.length === 0 ? (
        <EmptyState
          title="No EVV records found"
          description="Visit records will appear here once caregivers clock in."
          icon={(() => { 
            // @ts-ignore 
            return <Clock className="h-12 w-12" />; 
          })()}
        />
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {records.map((record) => (
            <EVVRecordCard
              key={record.id}
              record={record}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
