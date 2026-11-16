import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
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
  useCreateFamilyMember,
  useUpdateFamilyMember,
} from '../hooks';
import type {
  FamilyPortalAccessRow,
  PortalAccessStatus,
  FamilyRelationship,
  PortalAccessLevel,
} from '../types';

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

const ACCESS_LEVEL_SEMANTICS: Record<PortalAccessLevel, { label: string; description: string; elevated?: boolean }> = {
  VIEW_BASIC: {
    label: 'Basic View (Default)',
    description: 'Basic profile & visit schedule times only (Least privilege)',
  },
  VIEW_DETAILED: {
    label: 'Detailed View',
    description: 'Basic view + care plan goals, task completion, and general visit notes',
  },
  VIEW_FINANCIAL: {
    label: 'Financial View',
    description: 'Basic view + billing statements, invoices, and payment status',
  },
  VIEW_MEDICAL: {
    label: 'Medical View (Elevated PHI)',
    description: 'Exposes clinical PHI: medications, diagnoses, vitals, and clinical assessments',
    elevated: true,
  },
  FULL_ACCESS: {
    label: 'Full Access (Elevated PHI)',
    description: 'Complete access to all clinical, medical, care plan, and financial records',
    elevated: true,
  },
};

const RELATIONSHIP_OPTIONS: Array<{ value: FamilyRelationship; label: string }> = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'CHILD', label: 'Child' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'GRANDPARENT', label: 'Grandparent' },
  { value: 'GRANDCHILD', label: 'Grandchild' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'POWER_OF_ATTORNEY', label: 'Power of Attorney' },
  { value: 'HEALTHCARE_PROXY', label: 'Healthcare Proxy' },
  { value: 'OTHER', label: 'Other' },
];

const addFamilyMemberFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    relationship: z.enum([
      'SPOUSE',
      'PARENT',
      'CHILD',
      'SIBLING',
      'GRANDPARENT',
      'GRANDCHILD',
      'GUARDIAN',
      'POWER_OF_ATTORNEY',
      'HEALTHCARE_PROXY',
      'OTHER',
    ]),
    email: z.email('Valid email is required').trim().toLowerCase().max(255),
    phoneNumber: z.string().trim().max(50).optional(),
    isPrimaryContact: z.boolean(),
    portalAccessLevel: z.enum([
      'VIEW_BASIC',
      'VIEW_DETAILED',
      'VIEW_MEDICAL',
      'VIEW_FINANCIAL',
      'FULL_ACCESS',
    ]),
    confirmElevatedAccess: z.boolean(),
    consentGiven: z.boolean().refine((v) => v === true, {
      message: 'Client or legal representative authorization is required',
    }),
    authorizedBy: z.enum(['CLIENT', 'LEGAL_REPRESENTATIVE']),
    authorizerName: z.string().trim().min(1, 'Authorizer name is required').max(255),
    inviteNow: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.portalAccessLevel === 'VIEW_MEDICAL' || data.portalAccessLevel === 'FULL_ACCESS') &&
      !data.confirmElevatedAccess
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmElevatedAccess'],
        message: 'Explicit confirmation is required for Medical or Full PHI access',
      });
    }
  });

type AddFamilyMemberFormValues = z.infer<typeof addFamilyMemberFormSchema>;

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
  const createMutation = useCreateFamilyMember(clientId);
  const updateMutation = useUpdateFamilyMember(clientId);

  const [selectedMember, setSelectedMember] = useState<FamilyPortalAccessRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditAccessDialogOpen, setIsEditAccessDialogOpen] = useState(false);
  const [editAccessLevel, setEditAccessLevel] = useState<PortalAccessLevel>('VIEW_BASIC');
  const [editConfirmElevated, setEditConfirmElevated] = useState(false);

  const addForm = useForm<AddFamilyMemberFormValues>({
    resolver: zodResolver(addFamilyMemberFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      relationship: 'SPOUSE',
      email: '',
      phoneNumber: '',
      isPrimaryContact: false,
      portalAccessLevel: 'VIEW_BASIC',
      confirmElevatedAccess: false,
      consentGiven: false,
      authorizedBy: 'CLIENT',
      authorizerName: '',
      inviteNow: true,
    },
  });

  const watchedAccessLevel = useWatch({ control: addForm.control, name: 'portalAccessLevel' });
  const isElevatedSelected = watchedAccessLevel === 'VIEW_MEDICAL' || watchedAccessLevel === 'FULL_ACCESS';

  const handleOpenAdd = () => {
    addForm.reset();
    setIsAddDialogOpen(true);
  };

  const handleSubmitAdd = addForm.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        relationship: values.relationship,
        email: values.email,
        phoneNumber: values.phoneNumber ?? '',
        isPrimaryContact: values.isPrimaryContact,
        portalAccessLevel: values.portalAccessLevel,
        confirmElevatedAccess: values.confirmElevatedAccess,
        inviteNow: values.inviteNow,
        consent: {
          consentGiven: true,
          authorizedBy: values.authorizedBy,
          authorizerName: values.authorizerName,
        },
      });
      setIsAddDialogOpen(false);
    } catch {
      // Toast handled by hook
    }
  });

  const handleOpenEditAccess = (member: FamilyPortalAccessRow) => {
    setSelectedMember(member);
    setEditAccessLevel(member.portalAccessLevel);
    setEditConfirmElevated(false);
    setIsEditAccessDialogOpen(true);
  };

  const isEditElevated = editAccessLevel === 'VIEW_MEDICAL' || editAccessLevel === 'FULL_ACCESS';

  const handleConfirmEditAccess = async () => {
    if (!selectedMember) return;
    if (isEditElevated && !editConfirmElevated) return;
    try {
      await updateMutation.mutateAsync({
        familyMemberId: selectedMember.familyMemberId,
        input: {
          portalAccessLevel: editAccessLevel,
          confirmElevatedAccess: editConfirmElevated,
        },
      });
      setIsEditAccessDialogOpen(false);
      setSelectedMember(null);
    } catch {
      // Toast handled by hook
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
      return (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-gray-500">No family members on file.</p>
          {hasUpdatePermission && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenAdd}
              data-testid="empty-add-family-member-btn"
            >
              Add family member
            </Button>
          )}
        </div>
      );
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditAccess(member)}
                          data-testid={`edit-access-btn-${member.familyMemberId}`}
                        >
                          Edit access
                        </Button>
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
                              onClick={() => {
                                void (async () => {
                                  const res = await inviteMutation.mutateAsync({
                                    familyMemberId: member.familyMemberId,
                                    sendEmail: false,
                                  });
                                  if (res.inviteUrl) {
                                    await navigator.clipboard.writeText(res.inviteUrl);
                                    toast.success('Invite link copied to clipboard');
                                  }
                                })();
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
              onClick={handleOpenAdd}
              data-testid="add-family-member-btn"
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

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
            <DialogDescription>
              Add a family member or legal representative, capture portal authorization, and optionally send an invitation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmitAdd(e)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fm-first-name">First Name</Label>
                <Input id="fm-first-name" {...addForm.register('firstName')} />
                {addForm.formState.errors.firstName && (
                  <p className="text-xs text-destructive">{addForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="fm-last-name">Last Name</Label>
                <Input id="fm-last-name" {...addForm.register('lastName')} />
                {addForm.formState.errors.lastName && (
                  <p className="text-xs text-destructive">{addForm.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fm-relationship">Relationship</Label>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <select
                  id="fm-relationship"
                  {...addForm.register('relationship')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fm-phone">Phone (optional)</Label>
                <Input id="fm-phone" {...addForm.register('phoneNumber')} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fm-email">Email</Label>
              <Input id="fm-email" type="email" {...addForm.register('email')} />
              {addForm.formState.errors.email && (
                <p className="text-xs text-destructive">{addForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="fm-primary-contact"
                type="checkbox"
                {...addForm.register('isPrimaryContact')}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="fm-primary-contact">Primary family contact</Label>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fm-access-level">Portal Access Level</Label>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                id="fm-access-level"
                {...addForm.register('portalAccessLevel')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {Object.entries(ACCESS_LEVEL_SEMANTICS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600" data-testid="access-level-description">
                {ACCESS_LEVEL_SEMANTICS[watchedAccessLevel].description}
              </p>
            </div>

            {isElevatedSelected && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-medium text-amber-900">
                  Elevated PHI Access Warning: This level exposes sensitive clinical/medical records.
                </p>
                <div className="flex items-start gap-2">
                  <Input
                    id="fm-confirm-elevated"
                    type="checkbox"
                    {...addForm.register('confirmElevatedAccess')}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="fm-confirm-elevated" className="text-xs text-amber-900">
                    I confirm that granting Medical/Full PHI access is necessary and explicitly authorized (HIPAA Minimum Necessary).
                  </Label>
                </div>
                {addForm.formState.errors.confirmElevatedAccess && (
                  <p className="text-xs text-destructive">{addForm.formState.errors.confirmElevatedAccess.message}</p>
                )}
              </div>
            )}

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                HIPAA / Portal Authorization
              </p>
              <div className="flex items-start gap-2">
                <Input
                  id="fm-consent-given"
                  type="checkbox"
                  {...addForm.register('consentGiven')}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="fm-consent-given" className="text-xs">
                  Client or legal representative has authorized this family member&apos;s portal access to PHI
                </Label>
              </div>
              {addForm.formState.errors.consentGiven && (
                <p className="text-xs text-destructive">{addForm.formState.errors.consentGiven.message}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fm-authorized-by">Authorized By</Label>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <select
                    id="fm-authorized-by"
                    {...addForm.register('authorizedBy')}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="LEGAL_REPRESENTATIVE">Legal Representative / Guardian / POA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fm-authorizer-name">Authorizer Name</Label>
                  <Input
                    id="fm-authorizer-name"
                    placeholder="Full name"
                    {...addForm.register('authorizerName')}
                  />
                  {addForm.formState.errors.authorizerName && (
                    <p className="text-xs text-destructive">{addForm.formState.errors.authorizerName.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="fm-invite-now"
                type="checkbox"
                {...addForm.register('inviteNow')}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="fm-invite-now">Send portal invitation now</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="submit-add-family-member-btn">
                {createMutation.isPending ? 'Saving...' : 'Save Family Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditAccessDialogOpen} onOpenChange={setIsEditAccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Portal Access Level</DialogTitle>
            <DialogDescription>
              Update portal access level for{' '}
              {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'this family member'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-access-level">Portal Access Level</Label>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                id="edit-access-level"
                value={editAccessLevel}
                onChange={(e) => {
                  setEditAccessLevel(e.target.value as PortalAccessLevel);
                  setEditConfirmElevated(false);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {Object.entries(ACCESS_LEVEL_SEMANTICS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600">
                {ACCESS_LEVEL_SEMANTICS[editAccessLevel].description}
              </p>
            </div>
            {isEditElevated && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                <Input
                  id="edit-confirm-elevated"
                  type="checkbox"
                  checked={editConfirmElevated}
                  onChange={(e) => setEditConfirmElevated(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-confirm-elevated" className="text-xs text-amber-900">
                  I confirm that granting Medical/Full PHI access is necessary and explicitly authorized (HIPAA Minimum Necessary).
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditAccessDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleConfirmEditAccess()}
              disabled={(isEditElevated && !editConfirmElevated) || updateMutation.isPending}
              data-testid="confirm-edit-access-btn"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Access Level'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
