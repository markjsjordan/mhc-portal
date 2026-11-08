import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Textarea } from '@/components/ui/textarea.js';
import { LoadingSpinner } from '@/core/components/index.js';
import { usePermissions } from '@/core/hooks/index.js';
import { formatDate } from '@/core/utils/index.js';
import {
  useCaregiverPortalAccess,
  useInviteCaregiverPortal,
  useRevokeCaregiverPortal,
} from '../hooks/index.js';
import type { PortalAccessStatus } from '../types/index.js';

export interface PortalAccessCardProps {
  caregiverId: string;
}

const statusBadgeConfig: Record<
  PortalAccessStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  NONE: { label: 'No portal access', variant: 'outline' },
  INVITED: { label: 'Invitation pending', variant: 'secondary' },
  ACTIVE: { label: 'Portal active', variant: 'default' },
  SUSPENDED: { label: 'Suspended', variant: 'destructive' },
  REVOKED: { label: 'Access revoked', variant: 'destructive' },
};

export const PortalAccessCard: React.FC<PortalAccessCardProps> = ({ caregiverId }) => {
  const { can } = usePermissions();
  const hasUpdatePermission = can('caregivers:update');

  const { data: portalAccess, isLoading, error } = useCaregiverPortalAccess(caregiverId);
  const inviteMutation = useInviteCaregiverPortal(caregiverId);
  const revokeMutation = useRevokeCaregiverPortal(caregiverId);

  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const status: PortalAccessStatus = portalAccess?.status ?? 'NONE';
  const badgeConfig = statusBadgeConfig[status];

  const handleOpenRevoke = () => {
    setRevokeReason('');
    setIsRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = async () => {
    const trimmed = revokeReason.trim();
    if (!trimmed || trimmed.length > 500) return;
    try {
      await revokeMutation.mutateAsync(trimmed);
      setIsRevokeDialogOpen(false);
      setRevokeReason('');
    } catch {
      // Handled by mutation onError toast
    }
  };

  const isReasonValid = revokeReason.trim().length > 0 && revokeReason.trim().length <= 500;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      );
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load portal access details.</p>;
    }
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-700 space-y-1">
          {status === 'NONE' && (
            <p className="text-gray-500">
              This caregiver does not currently have portal access.
            </p>
          )}

          {status === 'INVITED' && (
            <>
              <p className="text-gray-600">
                An invitation has been sent to this caregiver.
              </p>
              {portalAccess?.inviteExpiresAt && (
                <p className="text-xs text-gray-500">
                  Expires: {formatDate(portalAccess.inviteExpiresAt)}
                </p>
              )}
            </>
          )}

          {status === 'ACTIVE' && (
            <>
              <p className="text-gray-600">
                The caregiver has active access to the portal.
              </p>
              <p className="text-xs text-gray-500">
                Last login:{' '}
                {portalAccess?.lastLoginAt
                  ? formatDate(portalAccess.lastLoginAt)
                  : 'Never'}
              </p>
            </>
          )}

          {status === 'SUSPENDED' && (
            <p className="text-amber-800 bg-amber-50 p-2 rounded text-xs border border-amber-200">
              Access is suspended while the caregiver is suspended. Access will automatically return when the caregiver is reinstated.
            </p>
          )}

          {status === 'REVOKED' && (
            <div className="text-xs text-gray-600 space-y-1">
              {portalAccess?.revokedAt && (
                <p>Revoked on: {formatDate(portalAccess.revokedAt)}</p>
              )}
              {portalAccess?.revokedReason && (
                <p>Reason: {portalAccess.revokedReason}</p>
              )}
            </div>
          )}
        </div>

        {hasUpdatePermission && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            {(status === 'NONE' || status === 'REVOKED') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Sending invite...' : 'Invite to portal'}
              </Button>
            )}

            {status === 'INVITED' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? 'Resending...' : 'Resend invite'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleOpenRevoke}
                  disabled={revokeMutation.isPending}
                >
                  Revoke access
                </Button>
              </>
            )}

            {status === 'ACTIVE' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleOpenRevoke}
                disabled={revokeMutation.isPending}
              >
                Revoke access
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Portal Access</CardTitle>
          <Badge variant={badgeConfig.variant} data-testid="portal-access-status-badge">
            {badgeConfig.label}
          </Badge>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>

      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Portal Access</DialogTitle>
            <DialogDescription>
              Please provide a reason for revoking this caregiver&apos;s portal access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="caregiver-revoke-reason" className="text-sm font-medium text-gray-700">
              Reason (required, max 500 characters)
            </label>
            <Textarea
              id="caregiver-revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Caregiver requested revocation, employment departure, etc."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-gray-500 text-right">
              {revokeReason.length > 0 ? revokeReason.length : 0} / 500
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRevokeDialogOpen(false)}
              disabled={revokeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmRevoke()}
              disabled={!isReasonValid || revokeMutation.isPending}
            >
              {revokeMutation.isPending ? 'Revoking...' : 'Confirm Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
