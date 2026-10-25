/**
 * Payroll Dashboard
 *
 * Main dashboard for payroll management
 * Shows current pay period, recent periods, and quick actions
 */

import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../core/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PayrollSummaryCard } from '../components/PayrollSummaryCard';
import { CreatePayPeriodModal } from '../components/CreatePayPeriodModal';
import { CreatePayRunModal } from '../components/CreatePayRunModal';

interface PayPeriod {
  id: string;
  periodNumber: number;
  periodYear: number;
  periodType: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: string;
  totalCaregivers?: number;
  totalHours?: number;
  totalGrossPay?: number;
  totalNetPay?: number;
}

/**
 * Fetch current pay period
 */
async function fetchCurrentPeriod(organizationId: string): Promise<PayPeriod | null> {
  const response = await fetch(`/api/payroll/current-period?organizationId=${organizationId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch current pay period');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Fetch recent pay periods
 */
async function fetchRecentPeriods(organizationId: string, limit: number = 5): Promise<PayPeriod[]> {
  const response = await fetch(`/api/payroll/periods?organizationId=${organizationId}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recent pay periods');
  }
  const data = await response.json();
  return data.data;
}

/**
 * Payroll Dashboard Component
 */
export const PayrollDashboard: React.FC = () => {
  const { user } = useAuth();
  const organizationId = user?.organizationId || '';
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);
  const [isCreateRunOpen, setIsCreateRunOpen] = useState(false);

  const { data: currentPeriod, isLoading: isLoadingCurrent, refetch: refetchCurrent } = useQuery({
    queryKey: ['payroll', 'current-period', organizationId],
    queryFn: () => fetchCurrentPeriod(organizationId),
  });

  const { data: recentPeriods = [], isLoading: isLoadingRecent, refetch: refetchRecent } = useQuery({
    queryKey: ['payroll', 'periods', organizationId],
    queryFn: () => fetchRecentPeriods(organizationId, 5),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
        <Button onClick={() => setIsCreatePeriodOpen(true)}>
          Create New Period
        </Button>
      </div>

      <CreatePayPeriodModal
        isOpen={isCreatePeriodOpen}
        onClose={() => setIsCreatePeriodOpen(false)}
        onCreated={() => {
          Promise.all([refetchCurrent(), refetchRecent()]).catch((err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'Failed to refresh payroll data');
          });
        }}
      />
      <CreatePayRunModal
        isOpen={isCreateRunOpen}
        onClose={() => setIsCreateRunOpen(false)}
      />

      {/* Current Period Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Pay Period</h2>
        {isLoadingCurrent ? (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ) : currentPeriod ? (
          <PayPeriodCard period={currentPeriod} isCurrent />
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-500">No active pay period. Create a new period to get started.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Quick Actions */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            title="Manage Pay Runs"
            description="View and manage payroll runs"
            link="/payroll/runs"
            icon="📋"
          />
          <button onClick={() => setIsCreateRunOpen(true)} className="block text-left w-full">
            <Card className="hover:shadow-lg transition-shadow duration-200 h-full">
              <CardContent className="p-6">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Run Payroll</h3>
                <p className="text-sm text-gray-600">Process payroll for current period</p>
              </CardContent>
            </Card>
          </button>
          <QuickActionCard
            title="View Reports"
            description="Access payroll reports and analytics"
            link="/payroll/reports"
            icon="📄"
          />
        </div>
      </section>

      {/* Recent Pay Periods */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Pay Periods</h2>
        {isLoadingRecent ? (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ) : recentPeriods.length > 0 ? (
          <div className="space-y-4">
            {recentPeriods.map((period) => (
              <PayPeriodCard key={period.id} period={period} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-500">No pay periods found.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Summary Statistics */}
      {currentPeriod?.totalGrossPay && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>
          <PayrollSummaryCard
            summary={{
              totalEmployees: currentPeriod.totalCaregivers || 0,
              totalCaregivers: currentPeriod.totalCaregivers || 0,
              totalHours: currentPeriod.totalHours || 0,
              totalGrossPay: currentPeriod.totalGrossPay || 0,
              totalTaxWithheld: 0,
              pendingApprovals: 0,
              upcomingPayDate: currentPeriod.payDate,
              recentPayRuns: {
                total: 0,
                completed: 0,
                failed: 0,
              },
              ytdTotals: {
                grossPay: 0,
                netPay: 0,
                taxWithheld: 0,
              },
            }}
          />
        </section>
      )}
    </div>
  );
};

/**
 * Pay Period Card Component
 */
interface PayPeriodCardProps {
  period: PayPeriod;
  isCurrent?: boolean;
}

const PayPeriodCard: React.FC<PayPeriodCardProps> = ({ period, isCurrent = false }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 border-gray-300',
    OPEN: 'bg-green-100 text-green-800 border-green-300',
    LOCKED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    PROCESSING: 'bg-blue-100 text-blue-800 border-blue-300',
    APPROVED: 'bg-purple-100 text-purple-800 border-purple-300',
    PAID: 'bg-green-100 text-green-800 border-green-300',
    CLOSED: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <Card className={isCurrent ? 'border-2 border-primary' : ''}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Pay Period #{period.periodNumber} - {period.periodYear}
            </h3>
            <p className="text-sm text-gray-600">
              {formatDate(period.startDate)} - {formatDate(period.endDate)}
            </p>
          </div>
          <Badge variant="outline" className={statusColors[period.status] ?? statusColors.DRAFT}>
            {period.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Pay Date</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(period.payDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Period Type</p>
            <p className="text-sm font-medium text-gray-900">{period.periodType.replace('_', ' ')}</p>
          </div>
        </div>

        {period.totalGrossPay !== undefined && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500">Caregivers</p>
              <p className="text-sm font-medium text-gray-900">{period.totalCaregivers || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Hours</p>
              <p className="text-sm font-medium text-gray-900">{(period.totalHours || 0).toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Gross Pay</p>
              <p className="text-sm font-medium text-gray-900">
                ${(period.totalGrossPay || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link to={`/payroll/periods/${period.id}`}>
            <Button size="sm">
              View Details
            </Button>
          </Link>
          {period.status === 'OPEN' && (
            <Link to={`/payroll/runs?periodId=${period.id}`}>
              <Button variant="secondary" size="sm">
                View Pay Runs
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Quick Action Card Component
 */
interface QuickActionCardProps {
  title: string;
  description: string;
  link: string;
  icon: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, description, link, icon }) => {
  return (
    <Link to={link} className="block">
      <Card className="hover:shadow-lg transition-shadow duration-200 h-full">
        <CardContent className="p-6">
          <div className="text-4xl mb-4">{icon}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
};

export default PayrollDashboard;
