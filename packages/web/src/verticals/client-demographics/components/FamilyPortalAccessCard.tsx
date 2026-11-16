import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
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
  useCreateFamilyMember,
  useInviteFamilyPortal,
  useRevokeFamilyPortal,
} from '../hooks';
import type {
  FamilyPortalAccessRow,
  FamilyRelationship,
  PortalAccessLevel,
  PortalAccessStatus,
} from '../types';

export interface PrefillFamilyMemberContact {
  firstName: string;
  lastName: string;
  relationship: FamilyRelationship;
  relationshipNote?: string;
  email: string;
  phoneNumber: string;
  isPrimaryContact: boolean;
}

export interface FamilyPortalAccessCardProps {
  clientId: string;
  clientStatus?: string;
  prefillContact?: PrefillFamilyMemberContact | null;
  onClearPrefill?: () => void;
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

const RELATIONSHIP_OPTIONS: { value: FamilyRelationship; label: string }[] = [
  { value: 'CHILD', label: 'Child' },
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'GRANDPARENT', label: 'Grandparent' },
  { value: 'GRANDCHILD', label: 'Grandchild' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'POWER_OF_ATTORNEY', label: 'Power of Attorney' },
  { value: 'HEALTHCARE_PROXY', label: 'Healthcare Proxy' },
  { value: 'OTHER', label: 'Other' },
];

const ACCESS_LEVEL_OPTIONS: { value: PortalAccessLevel; label: string }[] = [
  { value: 'VIEW_BASIC', label: 'Basic View (Minimum Necessary)' },
  { value: 'VIEW_DETAILED', label: 'Detailed View' },
  { value: 'VIEW_MEDICAL', label: 'Medical View' },
  { value: 'VIEW_FINANCIAL', label: 'Financial View' },
  { value: 'FULL_ACCESS', label: 'Full Access' },
];

export const FamilyPortalAccessCard: React.FC<FamilyPortalAccessCardProps> = ({
  clientId,
  clientStatus,
  prefillContact,
  onClearPrefill,
}) => {
  const { can } = usePermissions();
  const hasUpdatePermission = can('clients:update');
  const isClientInactive = clientStatus === 'DISCHARGED' || clientStatus === 'DECEASED';

  const { data: familyMembers, isLoading, error } = useFamilyPortalAccess(clientId);
  const createMutation = useCreateFamilyMember(clientId);
  const inviteMutation = useInviteFamilyPortal(clientId);
  const revokeMutation = useRevokeFamilyPortal(clientId);

  const [selectedMember, setSelectedMember] = useState<FamilyPortalAccessRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('CHILD');
  const [relationshipNote, setRelationshipNote] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [portalAccessLevel, setPortalAccessLevel] = useState<PortalAccessLevel>('VIEW_BASIC');
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [sendInviteImmediately, setSendInviteImmediately] = useState(!isClientInactive);
  const [hipaaAttested, setHipaaAttested] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetAddForm = () => {
    setFirstName('');
    setLastName('');
    setRelationship('CHILD');
    setRelationshipNote('');
    setEmail('');
    setPhoneNumber('');
    setPortalAccessLevel('VIEW_BASIC');
    setIsPrimaryContact(false);
    setSendInviteImmediately(!isClientInactive);
    setHipaaAttested(false);
    setFormError(null);
  };

  useEffect(() => {
    if (prefillContact) {
      setFirstName(prefillContact.firstName);
      setLastName(prefillContact.lastName);
      setRelationship(prefillContact.relationship);
      setRelationshipNote(prefillContact.relationshipNote ?? '');
      setEmail(prefillContact.email);
      setPhoneNumber(prefillContact.phoneNumber);
      setIsPrimaryContact(prefillContact.isPrimaryContact);
      setPortalAccessLevel('VIEW_BASIC');
      setSendInviteImmediately(!isClientInactive);
      setHipaaAttested(false);
      setFormError(null);
      setIsAddDialogOpen(true);
    }
  }, [prefillContact, isClientInactive]);

  const handleOpenAdd = () => {
    resetAddForm();
    setIsAddDialogOpen(true);
  };

  const handleCloseAdd = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      resetAddForm();
      onClearPrefill?.();
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phoneNumber.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }
    if (sendInviteImmediately && !isClientInactive && !hipaaAttested) {
      setFormError('HIPAA authorization attestation is required to send a portal invite.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        relationship,
        relationshipNote: relationshipNote.trim() || undefined,
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        isPrimaryContact,
        portalAccessLevel,
      });

      if (sendInviteImmediately && !isClientInactive) {
        await inviteMutation.mutateAsync(created.familyMemberId);
      }

      handleCloseAdd(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add family member');
    }
  };

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
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const res = await inviteMutation.mutateAsync({
                                  familyMemberId: member.familyMemberId,
                                  sendEmail: false,
                                });
                                if (res.inviteUrl) {
                                  await navigator.clipboard.writeText(res.inviteUrl);
                                  toast.success('Invite link copied to clipboard');
                                }
                              }}
                              disabled={inviteMutation.isPending}
                            >
                              Copy invite link
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
          {hasUpdatePermission && (
            <Button
              size="sm"
              variant="outline"
              data-testid="add-family-member-btn"
              onClick={handleOpenAdd}
            >
              Add family member
            </Button>
          )}
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

      <Dialog open={isAddDialogOpen} onOpenChange={handleCloseAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
            <DialogDescription>
              Add a family member or authorized representative to this client&apos;s file.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmitAdd(e)} className="space-y-4 py-2">
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fm-first-name">First Name</Label>
                <Input
                  id="fm-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fm-last-name">Last Name</Label>
                <Input
                  id="fm-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fm-relationship">Relationship</Label>
                <Select
                  value={relationship}
                  onValueChange={(val) => setRelationship(val as FamilyRelationship)}
                >
                  <SelectTrigger id="fm-relationship">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fm-access-level">Portal Access Level</Label>
                <Select
                  value={portalAccessLevel}
                  onValueChange={(val) => setPortalAccessLevel(val as PortalAccessLevel)}
                >
                  <SelectTrigger id="fm-access-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fm-email">Email</Label>
                <Input
                  id="fm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fm-phone">Phone Number</Label>
                <Input
                  id="fm-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fm-primary-contact"
                checked={isPrimaryContact}
                onCheckedChange={(checked) => setIsPrimaryContact(checked === true)}
              />
              <Label htmlFor="fm-primary-contact">Primary contact</Label>
            </div>
            {!isClientInactive && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fm-send-invite"
                    checked={sendInviteImmediately}
                    onCheckedChange={(checked) => setSendInviteImmediately(checked === true)}
                  />
                  <Label htmlFor="fm-send-invite">Send portal invite immediately</Label>
                </div>
                {sendInviteImmediately && (
                  <div className="flex items-start space-x-2 rounded-md border p-3 bg-muted/40">
                    <Checkbox
                      id="fm-hipaa-attestation"
                      checked={hipaaAttested}
                      onCheckedChange={(checked) => setHipaaAttested(checked === true)}
                    />
                    <Label htmlFor="fm-hipaa-attestation" className="text-xs leading-snug">
                      I confirm client or legal representative authorization is on file to share care information.
                    </Label>
                  </div>
                )}
              </>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCloseAdd(false)}
                disabled={createMutation.isPending || inviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || inviteMutation.isPending}
              >
                {createMutation.isPending || inviteMutation.isPending
                  ? 'Saving...'
                  : sendInviteImmediately && !isClientInactive
                    ? 'Add & Send Invite'
                    : 'Add Family Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
