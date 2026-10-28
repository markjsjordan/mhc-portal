import React, { useState } from 'react';
import { toast } from 'sonner';
import { Download, Eye } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/core/hooks';
import { usePayStubs, useDownloadPayStubPdf } from '../hooks';
import { formatCurrency, formatDate } from '../utils';
import { Link } from 'react-router-dom';

export const CaregiverPayStubs: React.FC = () => {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { data: payStubData, isLoading, error, refetch } = usePayStubs({
    caregiverId: user?.id,
  });

  const downloadPdf = useDownloadPayStubPdf();

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

  // Calculate YTD totals
  const ytdTotals = payStubs.reduce(
    (acc, stub) => ({
      hours: acc.hours + stub.totalHours,
      grossPay: acc.grossPay + stub.currentGrossPay,
      netPay: acc.netPay + stub.currentNetPay,
      taxes: acc.taxes + stub.totalTaxWithheld,
    }),
    { hours: 0, grossPay: 0, netPay: 0, taxes: 0 }
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      CALCULATED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
      PAID: 'bg-green-100 text-green-800 border-green-300',
      VOID: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Pay Stubs</h1>
          <p className="text-gray-600 mt-1">
            View and download your pay stubs
          </p>
        </div>
        <div className="w-40">
          <Label htmlFor="caregiver-year-select" className="sr-only">
            Select year
          </Label>
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(parseInt(val))}
          >
            <SelectTrigger id="caregiver-year-select" aria-label="Select year">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
              <SelectItem value={String(currentYear - 1)}>{currentYear - 1}</SelectItem>
              <SelectItem value={String(currentYear - 2)}>{currentYear - 2}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* YTD Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">YTD Hours</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {ytdTotals.hours.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">YTD Gross Pay</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(ytdTotals.grossPay)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">YTD Taxes</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(ytdTotals.taxes)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">YTD Net Pay</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(ytdTotals.netPay)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pay Stubs List */}
      {payStubs.length === 0 ? (
        <EmptyState
          title="No pay stubs available"
          description="Your pay stubs will appear here once payroll is processed."
        />
      ) : (
        <div className="space-y-4">
          {payStubs.map((payStub) => (
            <Card key={payStub.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pay Period: {formatDate(payStub.payPeriodStartDate)} - {formatDate(payStub.payPeriodEndDate)}
                      </h3>
                      <Badge variant="outline" className={getStatusColor(payStub.status)}>
                        {payStub.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Pay Date</Label>
                        <p className="text-sm font-medium mt-1">{formatDate(payStub.payDate)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Hours</Label>
                        <p className="text-sm font-medium mt-1">{payStub.totalHours.toFixed(2)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Gross Pay</Label>
                        <p className="text-sm font-medium mt-1">{formatCurrency(payStub.currentGrossPay)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Deductions</Label>
                        <p className="text-sm font-medium text-red-600 mt-1">
                          -{formatCurrency(payStub.totalTaxWithheld + payStub.totalOtherDeductions)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Net Pay</Label>
                        <p className="text-sm font-medium text-green-600 mt-1">
                          {formatCurrency(payStub.currentNetPay)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Link to={`/payroll/pay-stubs/${payStub.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-1.5" />
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPdf.mutate(payStub.id)}
                      disabled={downloadPdf.isPending}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tax Documents */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4">Tax Documents</h2>
          <p className="text-gray-600 mb-4">
            Your W-2 and other tax documents will be available here at year-end.
          </p>
          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Download W-2 (Available in January)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
