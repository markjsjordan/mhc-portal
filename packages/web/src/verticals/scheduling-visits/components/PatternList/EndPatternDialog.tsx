import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import type { PatternListItem } from '../../services/visit-api.js';

interface EndPatternDialogProps {
  pattern: PatternListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (patternId: string, reason: string, effectiveDate?: string) => Promise<void>;
  isLoading?: boolean;
}

export const EndPatternDialog: React.FC<EndPatternDialogProps> = ({
  pattern,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);

  if (!pattern) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason is required for the audit trail');
      return;
    }
    setError(null);
    try {
      await onConfirm(pattern.id, reason.trim(), effectiveDate !== '' ? effectiveDate : undefined);
      setReason('');
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setError(apiErr.response?.data?.error ?? apiErr.response?.data?.message ?? apiErr.message ?? 'Failed to end pattern');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <DialogHeader>
            <DialogTitle>End Recurring Pattern</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              End recurring pattern for <strong className="text-foreground">{pattern.clientName}</strong> ({pattern.recurrenceSummary}).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
              <div>
                This stops future visit generation. Already scheduled visits (
                <strong>{pattern.futureVisitCount}</strong>) and history are kept.
                Cancel individual visits separately if needed.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="effective-date">Effective Date</Label>
              <Input
                id="effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="end-reason"
                placeholder="Reason for ending this pattern (required for compliance and audit trail)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                required
              />
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isLoading || !reason.trim()}
            >
              {isLoading ? 'Ending...' : 'End Pattern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
