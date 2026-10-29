import React from 'react';
import { toast } from 'sonner';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, CheckCircle, Play, AlertCircle } from 'lucide-react';
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/core/hooks';
import { 
  usePayRun, 
  usePayStubs, 
  useCalculatePayRun, 
  useApprovePayRun, 
  useProcessPayRun 
} from '../hooks';
import { formatCurrency, formatHours, getPayRunStatusColor } from '../utils';

export const PayRunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const { data: payRun, isLoading, error } = usePayRun(id);
  const { data: payStubsData } = usePayStubs({ payRunId: id });
  const calculatePayRun = useCalculatePayRun();
  const approvePayRun = useApprovePayRun();
  const processPayRun = useProcessPayRun();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !payRun) {
    return (
      <ErrorMessage
        message="Failed to load pay run"
        retry={() => { Promise.resolve(navigate('/payroll')).catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Navigation failed'); }); }}
      />
    );
  }

  const statusColor = getPayRunStatusColor(payRun.status);
  const payStubs = payStubsData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => { Promise.resolve(navigate('/payroll')).catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Navigation failed'); }); }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Pay Run {payRun.runNumber}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={statusColor}>
                {payRun.status.replace(/_/g, ' ')}
              </Badge>
              {payRun.hasErrors && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Has Errors
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {can('payroll:write') && payRun.status === 'DRAFT' && (
            <Button
              onClick={() => calculatePayRun.mutate(payRun.id)}
              disabled={calculatePayRun.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calculate
            </Button>
          )}
          {can('payroll:approve') && payRun.status === 'PENDING_APPROVAL' && (
            <Button
              onClick={() => approvePayRun.mutate({ id: payRun.id })}
              disabled={approvePayRun.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {can('payroll:process') && payRun.status === 'APPROVED' && (
            <Button
              onClick={() => {
                if (window.confirm('Are you sure you want to process this pay run? This will generate payments.')) {
                  processPayRun.mutate(payRun.id);
                }
              }}
              disabled={processPayRun.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              Process Payments
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Pay Period</h3>
              <p className="text-lg">
                {new Date(payRun.payPeriodStartDate).toLocaleDateString()} - {new Date(payRun.payPeriodEndDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Pay Date</h3>
              <p className="text-lg font-semibold">{new Date(payRun.payDate).toLocaleDateString()}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Employees</h3>
              <p className="text-lg font-semibold">{payRun.totalCaregivers}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Hours</h3>
              <p className="text-lg font-semibold">{formatHours(payRun.totalHours)}</p>
            </div>

            {payRun.calculatedAt && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Calculated</h3>
                <p className="text-lg">{new Date(payRun.calculatedAt).toLocaleString()}</p>
              </div>
            )}

            {payRun.approvedAt && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Approved</h3>
                <p className="text-lg">{new Date(payRun.approvedAt).toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Financial Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Pay:</span>
                  <span className="font-semibold">{formatCurrency(payRun.totalGrossPay)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Federal Income Tax:</span>
                  <span className="text-red-600">-{formatCurrency(payRun.totalTaxWithheld)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Other Deductions:</span>
                  <span className="text-red-600">-{formatCurrency(payRun.totalDeductions)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t font-bold text-lg">
                  <span>Net Pay:</span>
                  <span className="text-green-600">{formatCurrency(payRun.totalNetPay)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Direct Deposits:</span>
                  <span>{payRun.directDepositCount} ({formatCurrency(payRun.directDepositAmount)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Checks:</span>
                  <span>{payRun.checkCount} ({formatCurrency(payRun.checkAmount)})</span>
                </div>
              </div>
            </div>
          </div>

          {payRun.notes && (
            <div className="pt-6 border-t">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <p className="text-gray-700">{payRun.notes}</p>
            </div>
          )}

          {payStubs.length > 0 && (
            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Pay Stubs ({payStubs.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Employee</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Hours</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Gross Pay</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Net Pay</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payStubs.map((stub) => (
                      <tr key={stub.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{stub.caregiverName}</p>
                            <p className="text-sm text-gray-500">{stub.caregiverEmployeeId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{formatHours(stub.totalHours)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(stub.currentGrossPay)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(stub.currentNetPay)}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-xs">
                            {stub.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
