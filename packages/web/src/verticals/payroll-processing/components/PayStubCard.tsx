import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '../utils';
import { useDownloadPayStubPdf } from '../hooks';
import type { PayStub } from '../types';

interface PayStubCardProps {
  payStub: PayStub;
  compact?: boolean;
}

export const PayStubCard: React.FC<PayStubCardProps> = ({ payStub, compact = false }) => {
  const downloadPdf = useDownloadPayStubPdf();

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      CALCULATED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
      PAID: 'bg-green-100 text-green-800 border-green-300',
      VOID: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{payStub.caregiverName}</h3>
                  <p className="text-sm text-gray-600">
                    {formatDate(payStub.payPeriodStartDate)} - {formatDate(payStub.payPeriodEndDate)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Net Pay</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(payStub.currentNetPay)}
                </p>
              </div>
              <Badge variant="outline" className={getStatusColor(payStub.status)}>
                {payStub.status}
              </Badge>
              <div className="flex gap-2">
                <Link to={`/payroll/pay-stubs/${payStub.id}`}>
                  <Button variant="outline" size="icon-sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => downloadPdf.mutate(payStub.id)}
                  disabled={downloadPdf.isPending}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{payStub.caregiverName}</h3>
            <p className="text-sm text-gray-600 mt-1">#{payStub.stubNumber}</p>
          </div>
          <Badge variant="outline" className={getStatusColor(payStub.status)}>
            {payStub.status}
          </Badge>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <Label className="text-xs text-gray-500">Pay Period</Label>
            <p className="text-sm font-medium mt-1">
              {formatDate(payStub.payPeriodStartDate)} - {formatDate(payStub.payPeriodEndDate)}
            </p>
          </div>

          <div>
            <Label className="text-xs text-gray-500">Pay Date</Label>
            <p className="text-sm font-medium mt-1">{formatDate(payStub.payDate)}</p>
          </div>

          <div className="pt-3 border-t">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Hours</span>
              <span className="font-medium">{payStub.totalHours.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Gross Pay</span>
              <span className="font-medium">{formatCurrency(payStub.currentGrossPay)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Deductions</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(payStub.totalTaxWithheld + payStub.totalOtherDeductions)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-gray-900">Net Pay</span>
              <span className="font-bold text-green-600">
                {formatCurrency(payStub.currentNetPay)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link to={`/payroll/pay-stubs/${payStub.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => downloadPdf.mutate(payStub.id)}
            disabled={downloadPdf.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
