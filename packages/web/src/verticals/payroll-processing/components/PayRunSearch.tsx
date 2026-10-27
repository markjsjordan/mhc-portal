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
import type { PayRunSearchFilters, PayRunStatus } from '../types';

interface PayRunSearchProps {
  filters: PayRunSearchFilters;
  onFiltersChange: (filters: PayRunSearchFilters) => void;
}

export const PayRunSearch: React.FC<PayRunSearchProps> = ({ 
  filters, 
  onFiltersChange 
}) => {
  const handleFilterChange = (key: keyof PayRunSearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border shadow-sm p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pay-run-status-filter">
            Status
          </Label>
          <Select
            value={filters.status ?? 'ALL'}
            onValueChange={(val) =>
              handleFilterChange('status', val === 'ALL' ? '' : (val as PayRunStatus))
            }
          >
            <SelectTrigger id="pay-run-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="CALCULATING">Calculating</SelectItem>
              <SelectItem value="CALCULATED">Calculated</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="PROCESSED">Processed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-run-start-date">
            Start Date
          </Label>
          <Input
            id="pay-run-start-date"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pay-run-end-date">
            End Date
          </Label>
          <Input
            id="pay-run-end-date"
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
