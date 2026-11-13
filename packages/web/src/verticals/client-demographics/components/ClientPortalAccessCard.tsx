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
import { LoadingSpinner } from '@/core/components';
import { usePermissions } from '@/core/hooks';
import { formatDate } from '@/core/utils';
import {
  useClientPortalAccess,
  useInviteClientPortal,
  useRevokeClientPortal,
} from '../hooks';
import type { PortalAccessStatus } from '../types';

export interface ClientPortalAccessCardProps {
  clientId: string;
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

type DialogMode = 'revoke' | 'suspend';

/**
 * Client self-portal access (CLIENT role). Staff-only: renders nothing without clients:update.
 */
export const ClientPortalAccessCard: React.FC<ClientPortalAccessCardProps> = ({ clientId }) => {
  const { can } = usePermissions();
  const hasUpdatePermission = can('clients:update');

  const { data, isLoading, error } = useClientPortalAccess(clientId, hasUpdatePermission);
  const inviteMutation = useInviteClientPortal(clientId);
  const revokeMutation = useRevokeClientPortal(clientId);

  const [mode, setMode] = useState<DialogMode | null>(null);
  const [reason, setReason] = useState('');

  if (!hasUpdatePermission) {
    return null;
  }

  const trimmed = reason.trim();
  const isReasonValid = trimmed.length > 0 && trimmed.length <= 500;
  const closed = data?.clientStatus === 'DISCHARGED' || data?.clientStatus === 'DECEASED';

  const openDialog = (m: DialogMode) => {
    setMode(m);
    setReason('');
  };

  const handleConfirm = async () => {
    if (mode === null || !isReasonValid) return;
    try {
      await revokeMutation.mutateAsync({ reason: trimmed, suspend: mode === 'suspend' });
      setMode(null);
      setReason('');
    } catch {
      // Handled by mutation onError toast
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-6">
          <LoadingSpinner size="sm" />
        </div>
      );
    }
    if (error || !data) {
      return <p className="text-sm text-destructive">Failed to load portal access.</p>;
    }
    const status = data.status;
    const badge = statusBadgeConfig[status];
    const hasEmail = data.email.trim() !== '';
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant={badge.variant} data-testid="client-portal-status">{badge.label}</Badge>
          <div className="text-xs text-gray-500 mt-1">{hasEmail ? data.email : 'No email on file'}</div>
          {status === 'INVITED' && data.inviteExpiresAt && (
            <div className="text-[10px] text-gray-400 mt-0.5">Exp: {formatDate(data.inviteExpiresAt)}</div>
          )}
          {(status === 'REVOKED' || status === 'SUSPENDED') && data.revokedReason && (
            <div className="text-[10px] text-gray-500 mt-0.5">{data.revokedReason}</div>
          )}
          {!hasEmail && (status === 'NONE' || status === 'REVOKED') && (
            <div className="text-[10px] text-gray-500 mt-0.5">Add a client email to enable an invitation.</div>
          )}
          {closed && (
            <div className="text-[10px] text-gray-500 mt-0.5">
              Portal access is not available for {data.clientStatus.toLowerCase()} clients.
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(status === 'NONE' || status === 'REVOKED' || status === 'INVITED') && !closed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !hasEmail}
            >
              {inviteMutation.isPending ? 'Sending...' : status === 'INVITED' ? 'Resend invite' : 'Invite to portal'}
            </Button>
          )}
          {status === 'ACTIVE' && (
            <Button variant="outline" size="sm" onClick={() => openDialog('suspend')} disabled={revokeMutation.isPending}>
              Suspend access
            </Button>
          )}
          {(status === 'ACTIVE' || status === 'INVITED' || status === 'SUSPENDED') && (
            <Button variant="destructive" size="sm" onClick={() => openDialog('revoke')} disabled={revokeMutation.isPending}>
              Revoke access
            </Button>
          )}
        </div>
      </div>
    );
  };

  const verb = mode === 'suspend' ? 'Suspend' : 'Revoke';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-medium">Client Portal Access</CardTitle>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{verb} Client Portal Access</DialogTitle>
            <DialogDescription>Please provide a reason for this change.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="client-portal-reason" className="text-sm font-medium text-gray-700">
              Reason (required, max 500 characters)
            </label>
            <Textarea
              id="client-portal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={!isReasonValid || revokeMutation.isPending}
            >
              {revokeMutation.isPending ? `${verb.slice(0, -1)}ing...` : `${verb} access`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
