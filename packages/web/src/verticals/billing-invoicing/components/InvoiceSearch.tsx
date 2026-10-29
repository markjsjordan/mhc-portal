import React from 'react';
import { Label } from '@/components/ui/label.js';
import { Input } from '@/components/ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { BillingSearchFilters, InvoiceStatus } from '../types';

interface InvoiceSearchProps {
  filters: BillingSearchFilters;
  onFiltersChange: (filters: BillingSearchFilters) => void;
}

export const InvoiceSearch: React.FC<InvoiceSearchProps> = ({ 
  filters, 
  onFiltersChange 
}) => {
  const handleFilterChange = (key: keyof BillingSearchFilters, value: string | number | boolean) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border shadow-sm p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-status-filter">
            Status
          </Label>
          <Select
            value={filters.status ?? 'ALL'}
            onValueChange={(val) =>
              handleFilterChange('status', val === 'ALL' ? '' : (val as InvoiceStatus))
            }
          >
            <SelectTrigger id="invoice-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PAST_DUE">Past Due</SelectItem>
              <SelectItem value="DISPUTED">Disputed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="VOIDED">Voided</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice-start-date">
            Start Date
          </Label>
          <Input
            id="invoice-start-date"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice-end-date">
            End Date
          </Label>
          <Input
            id="invoice-end-date"
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice-min-amount">
            Min Amount
          </Label>
          <Input
            id="invoice-min-amount"
            type="number"
            value={filters.minAmount ?? ''}
            onChange={(e) =>
              handleFilterChange(
                'minAmount',
                e.target.value ? parseFloat(e.target.value) : '',
              )
            }
            placeholder="0.00"
          />
        </div>
      </div>
    </div>
  );
};
