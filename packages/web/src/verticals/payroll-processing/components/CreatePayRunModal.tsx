import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useAuth } from '@/core/hooks';
import { useCreatePayRun, usePayPeriods } from '../hooks';

export interface CreatePayRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** Pre-select a pay period, e.g. when triggered from a specific period's row */
  defaultPayPeriodId?: string;
}

const runTypeOptions = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'OFF_CYCLE', label: 'Off-Cycle' },
  { value: 'CORRECTION', label: 'Correction' },
];

export const CreatePayRunModal: React.FC<CreatePayRunModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  defaultPayPeriodId,
}) => {
  const { user } = useAuth();
  const createPayRun = useCreatePayRun();
  const { data: payPeriodData } = usePayPeriods({ status: 'OPEN' });

  const [payPeriodId, setPayPeriodId] = useState(defaultPayPeriodId ?? '');
  const [runType, setRunType] = useState('REGULAR');

  if (!isOpen) return null;

  const payPeriodOptions = (payPeriodData?.items ?? []).map((period) => ({
    value: period.id,
    label: `#${period.periodNumber} - ${period.periodYear} (${period.startDate.slice(0, 10)} to ${period.endDate.slice(0, 10)})`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organizationId || !payPeriodId) return;

    try {
      await createPayRun.mutateAsync({
        organizationId: user.organizationId,
        payPeriodId,
        runType,
      });
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
          <h2 className="text-xl font-semibold text-gray-900">New Pay Run</h2>
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
              <Label htmlFor="pay-run-period">
                Pay Period <span className="text-destructive">*</span>
              </Label>
              <Select
                value={payPeriodId}
                onValueChange={setPayPeriodId}
              >
                <SelectTrigger id="pay-run-period">
                  <SelectValue placeholder="Select an open pay period" />
                </SelectTrigger>
                <SelectContent>
                  {payPeriodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-run-type">
                Run Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={runType}
                onValueChange={setRunType}
              >
                <SelectTrigger id="pay-run-type">
                  <SelectValue placeholder="Select run type" />
                </SelectTrigger>
                <SelectContent>
                  {runTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {payPeriodOptions.length === 0 && (
              <p className="text-sm text-gray-500">
                No open pay periods available. Create a pay period first.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t bg-muted/30">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPayRun.isPending || !payPeriodId}>
              {createPayRun.isPending ? 'Creating...' : 'Create Pay Run'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
