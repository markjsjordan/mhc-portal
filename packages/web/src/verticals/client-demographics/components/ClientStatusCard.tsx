import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/core/components';
import { usePermissions, useSectionAccess } from '@/core/hooks';
import type { Role } from '@/core/types/auth';
import { useUpdateClientStatus } from '../hooks';
import type { Client, ManualClientStatus } from '../types';

const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'ADMIN'];

const MANUAL_STATUS_OPTIONS: ReadonlyArray<{ value: ManualClientStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DISCHARGED', label: 'Discharged' },
  { value: 'DECEASED', label: 'Deceased' },
];

const MANUAL_STATUS_SET = new Set<string>(MANUAL_STATUS_OPTIONS.map((o) => o.value));

function isManualStatus(status: string): status is ManualClientStatus {
  return MANUAL_STATUS_SET.has(status);
}

export interface ClientStatusCardProps {
  client: Client;
}

export const ClientStatusCard: React.FC<ClientStatusCardProps> = ({ client }) => {
  const { hasAnyRole } = usePermissions();
  const { canWrite } = useSectionAccess('clients');
  const updateStatusMutation = useUpdateClientStatus();

  const [selectedStatus, setSelectedStatus] = useState<ManualClientStatus | ''>(() =>
    isManualStatus(client.status) ? client.status : ''
  );
  const [dischargeReason, setDischargeReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSelectedStatus(isManualStatus(client.status) ? client.status : '');
    setDischargeReason('');
  }, [client.id, client.status]);

  const isAdmin = hasAnyRole(ADMIN_ROLES) && canWrite;
  if (!isAdmin) {
    return null;
  }

  const requiresConfirmation =
    selectedStatus === 'DISCHARGED' || selectedStatus === 'DECEASED';
  const isUnchanged = !selectedStatus || selectedStatus === client.status;
  const selectedLabel =
    MANUAL_STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.label ?? selectedStatus;

  const submitStatusUpdate = async () => {
    if (!selectedStatus) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: client.id,
        status: selectedStatus,
        reason: selectedStatus === 'DISCHARGED' ? dischargeReason : undefined,
      });
      setConfirmOpen(false);
      setDischargeReason('');
    } catch {
      // Error toast handled by mutation hook
    }
  };

  const handleUpdateClick = () => {
    if (isUnchanged) return;
    if (requiresConfirmation) {
      setConfirmOpen(true);
      return;
    }
    void submitStatusUpdate();
  };

  return (
    <Card className="mb-6" data-testid="client-status-card">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Client Status</CardTitle>
            <CardDescription>
              Manually update the client&apos;s enrollment status.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2" data-testid="current-client-status">
            <span className="text-sm text-muted-foreground">Current:</span>
            <StatusBadge status={client.status} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {client.status === 'PENDING_INTAKE' && (
          <p className="text-sm text-muted-foreground" data-testid="pending-intake-note">
            Pending Intake is auto-assigned on client creation and cannot be re-selected. Choose a
            status below to transition this client manually.
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="client-status-select">Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value as ManualClientStatus);
                if (value !== 'DISCHARGED') {
                  setDischargeReason('');
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              <SelectTrigger id="client-status-select" aria-label="Client status">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={handleUpdateClick}
            disabled={isUnchanged || updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
          </Button>
        </div>

        {selectedStatus === 'DISCHARGED' && (
          <div className="space-y-2">
            <Label htmlFor="discharge-reason">Reason for Discharge (Optional)</Label>
            <Textarea
              id="discharge-reason"
              value={dischargeReason}
              onChange={(e) => setDischargeReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Optional reason for discharge..."
              disabled={updateStatusMutation.isPending}
            />
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Status Change to {selectedLabel}
            </DialogTitle>
            <DialogDescription>
              Setting this client to <strong>{selectedLabel}</strong> will immediately revoke all
              client and family member portal access. You can change the status again later if
              needed.
            </DialogDescription>
          </DialogHeader>

          {selectedStatus === 'DISCHARGED' && (
            <div className="space-y-2">
              <Label htmlFor="confirm-discharge-reason">Reason for Discharge (Optional)</Label>
              <Textarea
                id="confirm-discharge-reason"
                value={dischargeReason}
                onChange={(e) => setDischargeReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Optional reason for discharge..."
                disabled={updateStatusMutation.isPending}
              />
            </div>
          )}

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
                void submitStatusUpdate();
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending
                ? 'Updating...'
                : `Confirm ${selectedLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
