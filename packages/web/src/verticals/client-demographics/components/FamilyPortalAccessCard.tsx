import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
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
  useFamilyPortalAccess,
  useInviteFamilyPortal,
  useRevokeFamilyPortal,
} from '../hooks';
import type { FamilyPortalAccessRow, PortalAccessStatus } from '../types';

export interface FamilyPortalAccessCardProps {
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

const formatAccessLevel = (level: string): string => {
  switch (level) {
    case 'FULL_ACCESS':
      return 'Full Access';
    case 'VIEW_BASIC':
      return 'Basic View';
    case 'VIEW_DETAILED':
      return 'Detailed View';
    case 'VIEW_MEDICAL':
      return 'Medical View';
    case 'VIEW_FINANCIAL':
      return 'Financial View';
    default:
      return level.replace(/_/g, ' ');
  }
};

export const FamilyPortalAccessCard: React.FC<FamilyPortalAccessCardProps> = ({ clientId }) => {
  const { can } = usePermissions();
  const hasUpdatePermission = can('clients:update');

  const { data: familyMembers, isLoading, error } = useFamilyPortalAccess(clientId);
  const inviteMutation = useInviteFamilyPortal(clientId);
  const revokeMutation = useRevokeFamilyPortal(clientId);

  const [selectedMember, setSelectedMember] = useState<FamilyPortalAccessRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);

  const handleOpenRevoke = (member: FamilyPortalAccessRow) => {
    setSelectedMember(member);
    setRevokeReason('');
    setIsRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!selectedMember) return;
    const trimmed = revokeReason.trim();
    if (!trimmed || trimmed.length > 500) return;

    try {
      await revokeMutation.mutateAsync({
        familyMemberId: selectedMember.familyMemberId,
        reason: trimmed,
      });
      setIsRevokeDialogOpen(false);
      setSelectedMember(null);
      setRevokeReason('');
    } catch {
      // Handled by mutation onError toast
    }
  };

  const isReasonValid = revokeReason.trim().length > 0 && revokeReason.trim().length <= 500;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-6">
          <LoadingSpinner size="sm" />
        </div>
      );
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load family portal access.</p>;
    }
    if (!familyMembers || familyMembers.length === 0) {
      return <p className="text-sm text-gray-500">No family members on file.</p>;
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              {hasUpdatePermission && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {familyMembers.map((member) => {
              const status = member.status;
              const badge = statusBadgeConfig[status];
              const isInvitingThis =
                inviteMutation.isPending &&
                inviteMutation.variables === member.familyMemberId;

              return (
                <TableRow key={member.familyMemberId}>
                  <TableCell className="font-medium text-gray-900">
                    <div>
                      <div>{member.firstName} {member.lastName}</div>
                      {member.email && (
                        <div className="text-xs text-gray-500">{member.email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{member.relationship}</TableCell>
                  <TableCell className="text-gray-600">
                    {formatAccessLevel(member.portalAccessLevel)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant} data-testid={`family-status-${member.familyMemberId}`}>
                      {badge.label}
                    </Badge>
                    {status === 'INVITED' && member.inviteExpiresAt && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Exp: {formatDate(member.inviteExpiresAt)}
                      </div>
                    )}
                    {status === 'REVOKED' && member.revokedReason && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {member.revokedReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}
                  </TableCell>
                  {hasUpdatePermission && (
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {(status === 'NONE' || status === 'REVOKED') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => inviteMutation.mutate(member.familyMemberId)}
                            disabled={inviteMutation.isPending}
                          >
                            {isInvitingThis ? 'Sending...' : 'Invite to portal'}
                          </Button>
                        )}
                        {status === 'INVITED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => inviteMutation.mutate(member.familyMemberId)}
                              disabled={inviteMutation.isPending}
                            >
                              {isInvitingThis ? 'Resending...' : 'Resend invite'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleOpenRevoke(member)}
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
                            onClick={() => handleOpenRevoke(member)}
                            disabled={revokeMutation.isPending}
                          >
                            Revoke access
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-medium">Family Portal Access</CardTitle>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>

      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Family Portal Access</DialogTitle>
            <DialogDescription>
              Please provide a reason for revoking portal access for{' '}
              {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'this family member'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="family-revoke-reason" className="text-sm font-medium text-gray-700">
              Reason (required, max 500 characters)
            </label>
            <Textarea
              id="family-revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Family member requested removal, status change, etc."
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
