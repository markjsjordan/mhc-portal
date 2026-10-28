import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useAuth } from '@/core/hooks';
import { useCreatePayPeriod, useOpenPayPeriod } from '../hooks';
import type { PayPeriodType } from '../types';

export interface CreatePayPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const periodTypeOptions = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-Weekly' },
  { value: 'SEMI_MONTHLY', label: 'Semi-Monthly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export const CreatePayPeriodModal: React.FC<CreatePayPeriodModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { user } = useAuth();
  const createPayPeriod = useCreatePayPeriod();
  const openPayPeriod = useOpenPayPeriod();

  const [periodType, setPeriodType] = useState<PayPeriodType>('BI_WEEKLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payDate, setPayDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organizationId) return;

    try {
      const period = await createPayPeriod.mutateAsync({
        organizationId: user.organizationId,
        periodType,
        startDate,
        endDate,
        payDate,
      });
      // New pay periods are created in DRAFT status; immediately open them
      // for timesheet submission so they're usable right away (Lock in
      // PayPeriodManagement only applies to OPEN periods).
      await openPayPeriod.mutateAsync(period.id);
      onCreated?.();
      onClose();
    } catch {
      // Error is handled by the mutation
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full border">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create Pay Period</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={(e) => { handleSubmit(e).catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to submit'); }); }}>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-period-type">
                Period Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={periodType}
                onValueChange={(val) => setPeriodType(val as PayPeriodType)}
              >
                <SelectTrigger id="create-period-type">
                  <SelectValue placeholder="Select period type" />
                </SelectTrigger>
                <SelectContent>
                  {periodTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-period-start-date">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-period-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-period-end-date">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-period-end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-period-pay-date">
                Pay Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-period-pay-date"
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t bg-muted/30">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPayPeriod.isPending}>
              {createPayPeriod.isPending ? 'Creating...' : 'Create Pay Period'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
