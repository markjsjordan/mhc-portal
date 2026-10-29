import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Lock, Unlock, Play } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/core/hooks';
import { usePayPeriods, useCreatePayRun, useLockPayPeriod, useUnlockPayPeriod } from '../hooks';
import { CreatePayPeriodModal } from '../components';
import { formatDate, formatCurrency } from '../utils';
import type { PayrollSearchFilters, PayPeriod } from '../types';

export const PayPeriodManagement: React.FC = () => {
  const { can } = usePermissions();
  const [filters, setFilters] = useState<PayrollSearchFilters>({});
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);

  const { data: payPeriodData, isLoading, error, refetch } = usePayPeriods(filters);
  const createPayRun = useCreatePayRun();
  const lockPayPeriod = useLockPayPeriod();
  const unlockPayPeriod = useUnlockPayPeriod();

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
        message={(error as Error).message || 'Failed to load pay periods'}
        retry={() => { refetch().catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to refresh pay periods'); }); }}
      />
    );
  }

  const payPeriods = payPeriodData?.items ?? [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 border-gray-300',
      OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
      LOCKED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      PROCESSING: 'bg-purple-100 text-purple-800 border-purple-300',
      APPROVED: 'bg-green-100 text-green-800 border-green-300',
      PAID: 'bg-green-100 text-green-800 border-green-300',
      CLOSED: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const handleProcessPayroll = async (payPeriod: PayPeriod) => {
    if (!payPeriod.organizationId) return;

    const confirmed = window.confirm(
      `Process payroll for pay period ${formatDate(payPeriod.startDate)} - ${formatDate(payPeriod.endDate)}?`
    );

    if (confirmed) {
      createPayRun.mutate({
        organizationId: payPeriod.organizationId,
        payPeriodId: payPeriod.id,
        runType: 'REGULAR',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pay Period Management</h1>
          <p className="text-gray-600 mt-1">
            {payPeriodData?.total ?? 0} pay periods
          </p>
        </div>
        {can('payroll:write') && (
          <Button onClick={() => setIsCreatePeriodOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Pay Period
          </Button>
        )}
      </div>

      <CreatePayPeriodModal
        isOpen={isCreatePeriodOpen}
        onClose={() => setIsCreatePeriodOpen(false)}
        onCreated={() => { refetch().catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to refresh pay periods'); }); }}
      />

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="period-status-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </Label>
              <Select
                value={filters.status ?? 'ALL'}
                onValueChange={(val) =>
                  setFilters({ ...filters, status: val === 'ALL' ? undefined : (val as PayrollSearchFilters['status']) })
                }
              >
                <SelectTrigger id="period-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="LOCKED">Locked</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="period-year-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Year
              </Label>
              <Select
                value={filters.year ? String(filters.year) : 'ALL'}
                onValueChange={(val) =>
                  setFilters({ ...filters, year: val === 'ALL' ? undefined : parseInt(val) })
                }
              >
                <SelectTrigger id="period-year-filter">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Years</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="period-type-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Period Type
              </Label>
              <Select
                value={filters.periodType ?? 'ALL'}
                onValueChange={(val) =>
                  setFilters({ ...filters, periodType: val === 'ALL' ? undefined : (val as PayrollSearchFilters['periodType']) })
                }
              >
                <SelectTrigger id="period-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="BI_WEEKLY">Bi-Weekly</SelectItem>
                  <SelectItem value="SEMI_MONTHLY">Semi-Monthly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({})}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {payPeriods.length === 0 ? (
        <EmptyState
          title="No pay periods found"
          description="Create your first pay period to get started with payroll processing."
          action={
            can('payroll:write') ? (
              <Button onClick={() => setIsCreatePeriodOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Pay Period
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {payPeriods.map((period) => (
            <Card key={period.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </h3>
                      <Badge variant="outline" className={getStatusColor(period.status)}>
                        {period.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <Label className="text-xs text-gray-500">Pay Date</Label>
                        <p className="text-sm font-medium mt-1">{formatDate(period.payDate)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Period Type</Label>
                        <p className="text-sm font-medium mt-1">{period.periodType.replace(/_/g, ' ')}</p>
                      </div>
                      {period.totalCaregivers !== undefined && (
                        <div>
                          <Label className="text-xs text-gray-500">Caregivers</Label>
                          <p className="text-sm font-medium mt-1">{period.totalCaregivers}</p>
                        </div>
                      )}
                      {period.totalGrossPay !== undefined && (
                        <div>
                          <Label className="text-xs text-gray-500">Total Gross Pay</Label>
                          <p className="text-sm font-medium mt-1">{formatCurrency(period.totalGrossPay)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {can('payroll:write') && (
                    <div className="flex gap-2 ml-4">
                      {period.status === 'OPEN' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => lockPayPeriod.mutate(period.id)}
                          disabled={lockPayPeriod.isPending}
                        >
                          <Lock className="h-4 w-4 mr-1.5" />
                          Lock
                        </Button>
                      )}
                      {period.status === 'LOCKED' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlockPayPeriod.mutate(period.id)}
                            disabled={unlockPayPeriod.isPending}
                          >
                            <Unlock className="h-4 w-4 mr-1.5" />
                            Unlock
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => { handleProcessPayroll(period).catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to process payroll'); }); }}
                            disabled={createPayRun.isPending}
                          >
                            <Play className="h-4 w-4 mr-1.5" />
                            Process
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
