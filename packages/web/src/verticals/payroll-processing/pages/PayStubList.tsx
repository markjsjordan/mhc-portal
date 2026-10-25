import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Grid, List, Filter } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayStubs } from '../hooks';
import { PayStubCard } from '../components';
import type { PayStubSearchFilters } from '../types';

export const PayStubList: React.FC = () => {
  const [filters, setFilters] = useState<PayStubSearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const { data: payStubData, isLoading, error, refetch } = usePayStubs(filters);

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
        message={(error as Error).message || 'Failed to load pay stubs'}
        retry={() => { refetch().catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to refresh pay stubs'); }); }}
      />
    );
  }

  const payStubs = payStubData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pay Stubs</h1>
          <p className="text-gray-600 mt-1">
            {payStubData?.total ?? 0} total pay stubs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
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
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="stub-status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </Label>
                <Select
                  value={filters.status ?? 'ALL'}
                  onValueChange={(val) =>
                    setFilters({ ...filters, status: val === 'ALL' ? undefined : (val as PayStubSearchFilters['status']) })
                  }
                >
                  <SelectTrigger id="stub-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="CALCULATED">Calculated</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="VOID">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stub-payment-method-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </Label>
                <Select
                  value={filters.paymentMethod ?? 'ALL'}
                  onValueChange={(val) =>
                    setFilters({ ...filters, paymentMethod: val === 'ALL' ? undefined : (val as PayStubSearchFilters['paymentMethod']) })
                  }
                >
                  <SelectTrigger id="stub-payment-method-filter">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Methods</SelectItem>
                    <SelectItem value="DIRECT_DEPOSIT">Direct Deposit</SelectItem>
                    <SelectItem value="CHECK">Check</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stub-start-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </Label>
                <Input
                  id="stub-start-date"
                  type="date"
                  value={filters.startDate ?? ''}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value || undefined })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setFilters({})}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {payStubs.length === 0 ? (
        <EmptyState
          title="No pay stubs found"
          description="Pay stubs will appear here once payroll is processed."
        />
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }
        >
          {payStubs.map((payStub) => (
            <PayStubCard
              key={payStub.id}
              payStub={payStub}
              compact={viewMode === 'list'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
