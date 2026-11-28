import { useEffect, useState } from 'react';
import { StatusBadge } from '@/core/components';
import { useUpdateClientStatus } from '@/verticals/client-demographics/hooks';
import {
  MANUALLY_SETTABLE_CLIENT_STATUSES,
  type ManuallySettableClientStatus,
} from '@/verticals/client-demographics/types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { blankToUndefined } from './intake-payload.js';

const STATUS_OPTIONS: ReadonlyArray<{ value: ManuallySettableClientStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DISCHARGED', label: 'Discharged' },
  { value: 'DECEASED', label: 'Deceased' },
];

const DESTRUCTIVE_STATUSES: ReadonlySet<ManuallySettableClientStatus> = new Set([
  'DISCHARGED',
  'DECEASED',
]);

function isManuallySettableStatus(status: string | undefined): status is ManuallySettableClientStatus {
  return Boolean(status && (MANUALLY_SETTABLE_CLIENT_STATUSES as readonly string[]).includes(status));
}

interface ClientStatusSectionProps {
  clientId: string;
  currentStatus?: string;
  onStatusUpdated?: (newStatus: ManuallySettableClientStatus) => void;
}

export function ClientStatusSection({
  clientId,
  currentStatus,
  onStatusUpdated,
}: ClientStatusSectionProps) {
  const updateStatusMutation = useUpdateClientStatus();
  const [selectedStatus, setSelectedStatus] = useState<ManuallySettableClientStatus | ''>(
    isManuallySettableStatus(currentStatus) ? currentStatus : ''
  );
  const [dischargeReason, setDischargeReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSelectedStatus(isManuallySettableStatus(currentStatus) ? currentStatus : '');
  }, [currentStatus]);

  const submitStatusChange = async (nextStatus: ManuallySettableClientStatus) => {
    const reason =
      nextStatus === 'DISCHARGED' ? blankToUndefined(dischargeReason) : undefined;
    try {
      await updateStatusMutation.mutateAsync({
        id: clientId,
        status: nextStatus,
        ...(reason ? { reason } : {}),
      });
      onStatusUpdated?.(nextStatus);
      if (nextStatus !== 'DISCHARGED') {
        setDischargeReason('');
      }
      setConfirmOpen(false);
    } catch {
      // useUpdateClientStatus.onError surfaces the error toast
    }
  };

  const handleUpdateStatusClick = () => {
    if (!selectedStatus || selectedStatus === currentStatus) return;
    if (DESTRUCTIVE_STATUSES.has(selectedStatus)) {
      setConfirmOpen(true);
      return;
    }
    void submitStatusChange(selectedStatus);
  };

  const selectedLabel =
    STATUS_OPTIONS.find((opt) => opt.value === selectedStatus)?.label ?? selectedStatus;

  return (
    <div
      data-testid="client-status-section"
      className="mb-6 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Client Status</h2>
          <p className="text-xs text-gray-500">
            Manually update this client&apos;s status independently of intake details.
          </p>
        </div>
        {currentStatus === 'PENDING_INTAKE' ? (
          <div data-testid="pending-intake-status-badge" className="inline-flex items-center">
            <StatusBadge status="PENDING_INTAKE" />
          </div>
        ) : currentStatus ? (
          <div className="inline-flex items-center">
            <StatusBadge status={currentStatus} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 max-w-xs space-y-1.5">
          <Label htmlFor="client-status-select">Status</Label>
          <Select
            value={selectedStatus}
            onValueChange={(value) => setSelectedStatus(value as ManuallySettableClientStatus)}
          >
            <SelectTrigger id="client-status-select" aria-label="Client Status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStatus === 'DISCHARGED' && (
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="discharge-reason">Discharge Reason (optional)</Label>
            <Input
              id="discharge-reason"
              type="text"
              value={dischargeReason}
              onChange={(e) => setDischargeReason(e.target.value)}
              placeholder="Enter reason for discharge"
            />
          </div>
        )}

        <div>
          <Button
            type="button"
            onClick={handleUpdateStatusClick}
            disabled={
              !selectedStatus ||
              selectedStatus === currentStatus ||
              updateStatusMutation.isPending
            }
          >
            {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change to {selectedLabel}</DialogTitle>
            <DialogDescription>
              Changing this client&apos;s status to <strong>{selectedLabel}</strong> will
              automatically revoke all client and family portal access. Are you sure you want to
              continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (selectedStatus) {
                  void submitStatusChange(selectedStatus);
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
