import React, { useState } from 'react';
import { Grid, List } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useOpenShifts, useMatchingMetrics } from '../hooks';
import { OpenShiftCard, MatchingMetricsCard } from '../components';
import type { OpenShiftSearchFilters, MatchingStatus, ShiftPriority } from '../types';
import toast from 'react-hot-toast';

export const OpenShiftList: React.FC = () => {
  const [filters, setFilters] = useState<OpenShiftSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data: shiftsData, isLoading, error, refetch } = useOpenShifts(filters);
  const { data: metrics } = useMatchingMetrics();

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
        message={(error as Error).message || 'Failed to load open shifts'}
        retry={() => {
          refetch().catch((err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'Failed to reload shifts');
          });
        }}
      />
    );
  }

  const shifts = shiftsData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Matching</h1>
          <p className="text-gray-600 mt-1">
            {shiftsData?.total ?? 0} open shifts
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-gray-300 rounded-md p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
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

      {metrics && <MatchingMetricsCard metrics={metrics} />}

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1.5">
                Status
              </Label>
              <Select
                value={filters.matchingStatus ?? 'ALL'}
                onValueChange={(val) =>
                  setFilters({
                    ...filters,
                    matchingStatus: val === 'ALL' ? undefined : (val as MatchingStatus),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="MATCHING">Matching</SelectItem>
                  <SelectItem value="MATCHED">Matched</SelectItem>
                  <SelectItem value="PROPOSED">Proposed</SelectItem>
                  <SelectItem value="NO_MATCH">No Match</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1.5">
                Priority
              </Label>
              <Select
                value={filters.priority ?? 'ALL'}
                onValueChange={(val) =>
                  setFilters({
                    ...filters,
                    priority: val === 'ALL' ? undefined : (val as ShiftPriority),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Priorities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1.5">
                From Date
              </Label>
              <Input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1.5">
                To Date
              </Label>
              <Input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {shifts.length === 0 ? (
        <EmptyState
          title="No open shifts found"
          description="All shifts are currently assigned or there are no shifts matching your filters."
        />
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {shifts.map((shift) => (
            <OpenShiftCard
              key={shift.id}
              shift={shift}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
