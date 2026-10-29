import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Grid, List } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/core/hooks';
import { usePayRuns, usePayrollSummary } from '../hooks';
import { PayRunCard, PayRunSearch, PayrollSummaryCard, CreatePayRunModal } from '../components';
import type { PayRunSearchFilters } from '../types';

export const PayRunList: React.FC = () => {
  const { can } = usePermissions();
  const [filters, setFilters] = useState<PayRunSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateRunOpen, setIsCreateRunOpen] = useState(false);
  const { data: payRunData, isLoading, error, refetch } = usePayRuns(filters);
  const { data: summary, isLoading: isSummaryLoading, error: summaryError, refetch: refetchSummary } = usePayrollSummary();

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
        message={(error as Error).message || 'Failed to load pay runs'}
        retry={() => { refetch().catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to refresh pay runs'); }); }}
      />
    );
  }

  const payRuns = payRunData?.items ?? [];

  const renderSummary = (): React.JSX.Element | null => {
    if (isSummaryLoading) {
      return (
        <div className="flex justify-center items-center py-6">
          <LoadingSpinner size="md" />
        </div>
      );
    }
    if (summaryError) {
      return (
        <ErrorMessage
          message={(summaryError as Error).message || 'Failed to load payroll summary'}
          retry={() => { refetchSummary().catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to refresh payroll summary'); }); }}
        />
      );
    }
    if (summary) {
      return <PayrollSummaryCard summary={summary} />;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Processing</h1>
          <p className="text-gray-600 mt-1">
            {payRunData?.total ?? 0} total pay runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-input rounded-md p-0.5 bg-background">
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
          {can('payroll:write') && (
            <Button onClick={() => setIsCreateRunOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Pay Run
            </Button>
          )}
        </div>
      </div>

      <CreatePayRunModal
        isOpen={isCreateRunOpen}
        onClose={() => setIsCreateRunOpen(false)}
        onCreated={() => { refetch().catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to refresh pay runs'); }); }}
      />

      {renderSummary()}

      <PayRunSearch filters={filters} onFiltersChange={setFilters} />

      {payRuns.length === 0 ? (
        <EmptyState
          title="No pay runs found"
          description="Get started by creating your first pay run."
          action={
            can('payroll:write') ? (
              <Button onClick={() => setIsCreateRunOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Pay Run
              </Button>
            ) : undefined
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
          {payRuns.map((payRun) => (
            <PayRunCard
              key={payRun.id}
              payRun={payRun}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
