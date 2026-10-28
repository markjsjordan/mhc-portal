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
import type { EVVSearchFilters, VerificationLevel } from '../types';

interface EVVRecordSearchProps {
  filters: EVVSearchFilters;
  onFiltersChange: (filters: EVVSearchFilters) => void;
}

export const EVVRecordSearch: React.FC<EVVRecordSearchProps> = ({ 
  filters, 
  onFiltersChange 
}) => {
  const handleFilterChange = (key: keyof EVVSearchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value && value !== 'ALL' ? value : undefined,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="evv-search-status" className="block text-sm font-medium text-foreground">
            Status
          </Label>
          <Select
            value={filters.status ?? 'ALL'}
            onValueChange={(val) => handleFilterChange('status', val)}
          >
            <SelectTrigger id="evv-search-status" className="w-full">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="COMPLETE">Complete</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="AMENDED">Amended</SelectItem>
              <SelectItem value="VOIDED">Voided</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="evv-search-level" className="block text-sm font-medium text-foreground">
            Verification Level
          </Label>
          <Select
            value={filters.verificationLevel ?? 'ALL'}
            onValueChange={(val) => handleFilterChange('verificationLevel', val as VerificationLevel)}
          >
            <SelectTrigger id="evv-search-level" className="w-full">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Levels</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="PHONE">Phone</SelectItem>
              <SelectItem value="EXCEPTION">Exception</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="evv-search-date" className="block text-sm font-medium text-foreground">
            Start Date
          </Label>
          <Input
            id="evv-search-date"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
