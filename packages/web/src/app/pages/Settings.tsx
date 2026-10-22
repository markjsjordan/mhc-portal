import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@folkcare/shared-components';
import { Button } from '@folkcare/shared-components';
import { FormField } from '@/components/forms/FormField';
import { useApiClient } from '@/core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Bell, Users, UserPlus, Mail, Clock, CheckCircle, XCircle, Trash2, Copy, Pencil } from 'lucide-react';

type SettingsTab = 'profile' | 'account' | 'preferences' | 'team';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  roles: string[];
}

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').min(8, 'Password must be 8 or more characters'),
  newPassword: z.string().min(1, 'New password is required').min(8, 'Password must be 8 or more characters').regex(/[A-Z]/, 'Password must contain at least one uppercase letter').regex(/[a-z]/, 'Password must contain at least one lowercase letter').regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New password and confirmation must match",
  path: ['confirmPassword'],
});

const preferencesSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type PreferencesFormData = z.infer<typeof preferencesSchema>;

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const apiClient = useApiClient();

  // Fetch current user profile
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await apiClient.get<UserProfile | { data?: UserProfile }>('/api/users/profile');
      return 'id' in res ? res : (res.data ?? ({} as UserProfile));
    },
  });

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'account' as const, label: 'Account', icon: Lock },
    { id: 'preferences' as const, label: 'Preferences', icon: Bell },
    { id: 'team' as const, label: 'Team', icon: Users },
  ];

  const showMessage = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMessage(message);
      setErrorMessage(null);
    } else {
      setErrorMessage(message);
      setSuccessMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <ProfileSettings
            userProfile={userProfile}
            isLoading={isLoadingProfile}
            onSuccess={(message) => showMessage('success', message)}
            onError={(message) => showMessage('error', message)}
          />
        )}
        {activeTab === 'account' && (
          <AccountSettings
            onSuccess={(message) => showMessage('success', message)}
            onError={(message) => showMessage('error', message)}
          />
        )}
        {activeTab === 'preferences' && (
          <PreferencesSettings
            onSuccess={(message) => showMessage('success', message)}
            onError={(message) => showMessage('error', message)}
          />
        )}
        {activeTab === 'team' && userProfile && (
          <TeamSettings
            organizationId={userProfile.organizationId}
            onSuccess={(message) => showMessage('success', message)}
            onError={(message) => showMessage('error', message)}
          />
        )}
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  readonly userProfile?: UserProfile;
  readonly isLoading?: boolean;
  readonly onSuccess: (message: string) => void;
  readonly onError: (message: string) => void;
}

function ProfileSettings({ userProfile, isLoading, onSuccess, onError }: SettingsSectionProps) {
  const apiClient = useApiClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema as any),
    defaultValues: {
      firstName: userProfile?.firstName ?? '',
      lastName: userProfile?.lastName ?? '',
      email: userProfile?.email ?? '',
    },
  });

  React.useEffect(() => {
    if (userProfile) {
      reset({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        email: userProfile.email,
      });
    }
  }, [userProfile, reset]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return await apiClient.put('/api/users/profile', data);
    },
    onSuccess: () => {
      onSuccess('Profile updated successfully');
    },
    onError: (error: Error) => {
      onError(error.message);
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <Card.Content>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header
        title="Profile Information"
        subtitle="Update your personal information"
      />
      <Card.Content>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <FormField
              name="firstName"
              label="First Name"
              type="text"
              register={register}
              errors={errors}
              required
            />
            <FormField
              name="lastName"
              label="Last Name"
              type="text"
              register={register}
              errors={errors}
              required
            />
          </div>

          <FormField
            name="email"
            label="Email Address"
            type="email"
            register={register}
            errors={errors}
            helperText="Your email address is used for login and notifications"
            required
          />

          <div className="flex items-center gap-4 pt-4">
            <Button
              type="submit"
              variant="primary"
              isLoading={updateProfileMutation.isPending}
            >
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={updateProfileMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}

function AccountSettings({ onSuccess, onError }: Readonly<Omit<SettingsSectionProps, 'userProfile' | 'isLoading'>>) {
  const apiClient = useApiClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema as any),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      return await apiClient.put('/api/users/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      onSuccess('Password changed successfully');
      reset();
    },
    onError: (error: Error) => {
      onError(error.message);
    },
  });

  const onSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <Card>
      <Card.Header
        title="Change Password"
        subtitle="Update your password to keep your account secure"
      />
      <Card.Content>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-6">
          <FormField
            name="currentPassword"
            label="Current Password"
            type="password"
            register={register}
            errors={errors}
            required
          />

          <FormField
            name="newPassword"
            label="New Password"
            type="password"
            register={register}
            errors={errors}
            helperText="At least 8 characters with uppercase, lowercase, and numbers"
            required
          />

          <FormField
            name="confirmPassword"
            label="Confirm New Password"
            type="password"
            register={register}
            errors={errors}
            required
          />

          <div className="flex items-center gap-4 pt-4">
            <Button
              type="submit"
              variant="primary"
              isLoading={changePasswordMutation.isPending}
            >
              Change Password
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={changePasswordMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}

function PreferencesSettings({ onSuccess, onError }: Readonly<Omit<SettingsSectionProps, 'userProfile' | 'isLoading'>>) {
  const apiClient = useApiClient();

  // Fetch user preferences
  const { data: preferences, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      return await apiClient.get<Omit<PreferencesFormData, 'theme'>>('/api/users/preferences');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema as any),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: false,
    },
  });

  React.useEffect(() => {
    if (preferences) {
      reset({
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
      });
    }
  }, [preferences, reset]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: PreferencesFormData) => {
      return await apiClient.put('/api/users/preferences', data);
    },
    onSuccess: () => {
      onSuccess('Preferences updated successfully');
    },
    onError: (error: Error) => {
      onError(error.message);
    },
  });

  const onSubmit = (data: PreferencesFormData) => {
    updatePreferencesMutation.mutate(data);
  };

  if (isLoadingPreferences) {
    return (
      <Card>
        <Card.Content>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header
        title="Preferences"
        subtitle="Customize your experience"
      />
      <Card.Content>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Notifications</h3>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="emailNotifications"
                {...register('emailNotifications')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="emailNotifications" className="text-sm text-gray-700">
                Email notifications
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="pushNotifications"
                {...register('pushNotifications')}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="pushNotifications" className="text-sm text-gray-700">
                Push notifications
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <Button
              type="submit"
              variant="primary"
              isLoading={updatePreferencesMutation.isPending}
            >
              Save Preferences
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={updatePreferencesMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Team Settings Component
// =============================================================================

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  roles: string[];
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  token?: string;
  invitationToken?: string;
}

interface TeamSettingsProps {
  readonly organizationId: string;
  readonly onSuccess: (message: string) => void;
  readonly onError: (message: string) => void;
}

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['ORG_ADMIN', 'BRANCH_ADMIN', 'COORDINATOR', 'CAREGIVER', 'BILLING', 'SCHEDULER', 'NURSE_RN']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

const editMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['ORG_ADMIN', 'BRANCH_ADMIN', 'COORDINATOR', 'CAREGIVER', 'BILLING', 'SCHEDULER', 'NURSE_RN']),
});

type EditMemberFormData = z.infer<typeof editMemberSchema>;

interface EditMemberModalProps {
  readonly member: TeamMember;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, data: EditMemberFormData) => Promise<void>;
  readonly isLoading: boolean;
  readonly error: string | null;
}

function EditMemberModal({
  member,
  isOpen,
  onClose,
  onSave,
  isLoading,
  error,
}: EditMemberModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditMemberFormData>({
    resolver: zodResolver(editMemberSchema as any),
    defaultValues: {
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: (member.roles[0] as EditMemberFormData['role']) ?? 'CAREGIVER',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: EditMemberFormData) => {
    await onSave(member.id, data);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="edit-member-modal-title">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <h3 id="edit-member-modal-title" className="text-lg font-medium text-gray-900">
              Edit Team Member
            </h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500"
              onClick={onClose}
              aria-label="Close modal"
            >
              <span className="sr-only">Close</span>
              &times;
            </button>
          </div>

          <div className="mt-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  name="firstName"
                  label="First Name"
                  type="text"
                  register={register}
                  errors={errors}
                  required
                />
                <FormField
                  name="lastName"
                  label="Last Name"
                  type="text"
                  register={register}
                  errors={errors}
                  required
                />
              </div>
              <FormField
                name="email"
                label="Email Address"
                type="email"
                register={register}
                errors={errors}
                required
              />
              <FormField
                name="role"
                label="Role"
                type="select"
                register={register}
                errors={errors}
                options={[
                  { value: 'CAREGIVER', label: 'Caregiver' },
                  { value: 'NURSE_RN', label: 'Registered Nurse (RN)' },
                  { value: 'COORDINATOR', label: 'Care Coordinator' },
                  { value: 'SCHEDULER', label: 'Scheduler' },
                  { value: 'BILLING', label: 'Billing Specialist' },
                  { value: 'BRANCH_ADMIN', label: 'Branch Administrator' },
                  { value: 'ORG_ADMIN', label: 'Organization Administrator' },
                ]}
                required
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isLoading}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSettings({ organizationId, onSuccess, onError }: TeamSettingsProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [editMemberError, setEditMemberError] = useState<string | null>(null);

  // Fetch team members
  const { data: teamMembers, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['teamMembers', organizationId],
    queryFn: async () => {
      const res = await apiClient.get<TeamMember[] | { data?: TeamMember[] }>(`/api/organizations/${organizationId}/users`);
      return Array.isArray(res) ? res : (res.data ?? []);
    },
  });

  // Fetch pending invitations
  const { data: invitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['invitations', organizationId],
    queryFn: async () => {
      const res = await apiClient.get<Invitation[] | { data?: Invitation[] }>(`/api/organizations/${organizationId}/invitations`);
      return Array.isArray(res) ? res : (res.data ?? []);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema as any),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'CAREGIVER',
    },
  });

  // Create invitation mutation — returns token, builds shareable URL for manual sharing
  const createInvitationMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      return await apiClient.post<{ token?: string; invitationToken?: string; data?: { token?: string; invitationToken?: string } }>(
        `/api/organizations/${organizationId}/invitations`,
        {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          roles: [data.role],
        }
      );
    },
    onSuccess: (response) => {
      setInviteError(null);
      const token = response.token ?? response.invitationToken ?? response.data?.token ?? response.data?.invitationToken;
      if (token !== undefined && token !== '') {
        const url = `${window.location.origin}/accept-invite/${token}`;
        setGeneratedInviteUrl(url);
        onSuccess('Invite link generated');
      } else {
        onSuccess('Invitation created');
      }
      reset();
      void queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      setInviteError(error.message);
      onError(error.message);
    },
  });

  // Revoke invitation mutation
  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiClient.delete(`/api/organizations/${organizationId}/invitations/${invitationId}`);
    },
    onSuccess: () => {
      onSuccess('Invitation revoked');
      void queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      onError(error.message);
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiClient.post(`/api/organizations/${organizationId}/invitations/${invitationId}/resend`, {});
    },
    onSuccess: () => {
      onSuccess('Invitation expiration extended by 7 days');
      void queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] });
    },
    onError: (error: Error) => {
      onError(error.message);
    },
  });

  // Update team member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditMemberFormData }) => {
      return await apiClient.put(`/api/organizations/${organizationId}/users/${id}`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        roles: [data.role],
      });
    },
    onSuccess: () => {
      setEditMemberError(null);
      setEditingMember(null);
      onSuccess('Team member updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['teamMembers', organizationId] });
    },
    onError: (error: Error) => {
      setEditMemberError(error.message);
      onError(error.message);
    },
  });

  const onSubmitInvite = (data: InviteFormData) => {
    setGeneratedInviteUrl(null);
    setIsCopied(false);
    setInviteError(null);
    createInvitationMutation.mutate(data);
  };

  const handleCloseModal = () => {
    setShowInviteModal(false);
    setGeneratedInviteUrl(null);
    setIsCopied(false);
    setInviteError(null);
    reset();
  };

  const handleCopyInviteUrl = () => {
    if (generatedInviteUrl !== null && generatedInviteUrl !== '') {
      void navigator.clipboard.writeText(generatedInviteUrl).then(() => {
        setIsCopied(true);
        onSuccess('Invite link copied to clipboard');
        setTimeout(() => setIsCopied(false), 3000);
        return true;
      });
    }
  };

  const getRoleLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      ORG_ADMIN: 'Organization Administrator',
      BRANCH_ADMIN: 'Branch Administrator',
      ADMIN: 'Administrator',
      COORDINATOR: 'Care Coordinator',
      CAREGIVER: 'Caregiver',
      BILLING: 'Billing Specialist',
      BILLING_SPECIALIST: 'Billing Specialist',
      SCHEDULER: 'Scheduler',
    };
    return roleLabels[role] ?? role;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'EXPIRED':
      case 'REVOKED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const isLoading = isLoadingTeam || isLoadingInvitations;
  const pendingInvitations = invitations?.filter((inv) => inv.status === 'PENDING') ?? [];

  return (
    <div className="space-y-6">
      {/* Team Members Card */}
      <Card>
        <Card.Header
          title="Team Members"
          subtitle="Manage your organization's team"
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          }
        />
        <Card.Content>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : teamMembers && teamMembers.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-medium">
                        {member.firstName[0]}{member.lastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {member.roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                          >
                            {getRoleLabel(role)}
                          </span>
                        ))}
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="p-2 md:p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 shrink-0 self-start md:self-auto min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
                      onClick={() => {
                        setEditMemberError(null);
                        setEditingMember(member);
                      }}
                      title="Edit member"
                      aria-label={`Edit ${member.firstName} ${member.lastName}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No team members yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Invite team members to start collaborating.
              </p>
              <div className="mt-6">
                <Button variant="primary" onClick={() => setShowInviteModal(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite your first team member
                </Button>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Pending Invitations Card */}
      {pendingInvitations.length > 0 && (
        <Card>
          <Card.Header
            title="Pending Invitations"
            subtitle={`${pendingInvitations.length} invitation${pendingInvitations.length === 1 ? '' : 's'} waiting for response`}
          />
          <Card.Content>
            <div className="divide-y divide-gray-200">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{invitation.email}</p>
                      <p className="text-sm text-gray-500 truncate">
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(invitation.status)}
                      <span className="text-sm text-gray-500">{invitation.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {invitation.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {getRoleLabel(role)}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const tokenVal = invitation.token ?? invitation.invitationToken ?? '';
                          const url = `${window.location.origin}/accept-invite/${tokenVal}`;
                          void navigator.clipboard.writeText(url);
                          onSuccess('Invitation link copied to clipboard');
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInvitationMutation.mutate(invitation.id)}
                        disabled={resendInvitationMutation.isPending}
                      >
                        Extend Expiry
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                        disabled={revokeInvitationMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>

              {inviteError !== null && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-800">{inviteError}</p>
                </div>
              )}

              {/* Generated URL display — shown after successful generation */}
              {generatedInviteUrl !== null ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-green-50 border border-green-200 p-4">
                    <p className="text-sm font-medium text-green-800 mb-2">✓ Invite link generated</p>
                    <p className="text-xs text-green-700 mb-3">
                      Copy this link and send it directly to the new team member. The link is valid for 7 days.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInviteUrl}
                        className="flex-1 text-xs font-mono bg-white border border-green-300 rounded px-2 py-1.5 text-gray-700 truncate"
                        onFocus={(e) => e.target.select()}
                        aria-label="Generated invite URL"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleCopyInviteUrl}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        {isCopied ? 'Copied!' : 'Copy Link'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleCloseModal}>
                      Done
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setGeneratedInviteUrl(null);
                        setIsCopied(false);
                      }}
                    >
                      Invite Another
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { void handleSubmit(onSubmitInvite)(e); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      name="firstName"
                      label="First Name"
                      type="text"
                      register={register}
                      errors={errors}
                      required
                    />
                    <FormField
                      name="lastName"
                      label="Last Name"
                      type="text"
                      register={register}
                      errors={errors}
                      required
                    />
                  </div>
                  <FormField
                    name="email"
                    label="Email Address"
                    type="email"
                    register={register}
                    errors={errors}
                    required
                    helperText="Generate a unique invitation link to share with this team member"
                  />
                  <FormField
                    name="role"
                    label="Role"
                    type="select"
                    register={register}
                    errors={errors}
                    options={[
                      { value: 'CAREGIVER', label: 'Caregiver' },
                      { value: 'NURSE_RN', label: 'Registered Nurse (RN)' },
                      { value: 'COORDINATOR', label: 'Care Coordinator' },
                      { value: 'SCHEDULER', label: 'Scheduler' },
                      { value: 'BILLING', label: 'Billing Specialist' },
                      { value: 'BRANCH_ADMIN', label: 'Branch Administrator' },
                      { value: 'ORG_ADMIN', label: 'Organization Administrator' },
                    ]}
                    required
                  />
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseModal}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={createInvitationMutation.isPending}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Generate Invite URL
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Edit Team Member Modal */}
      {editingMember && (
        <EditMemberModal
          key={editingMember.id}
          member={editingMember}
          isOpen={true}
          onClose={() => {
            setEditingMember(null);
            setEditMemberError(null);
          }}
          onSave={async (id, data) => {
            await updateMemberMutation.mutateAsync({ id, data });
          }}
          isLoading={updateMemberMutation.isPending}
          error={editMemberError}
        />
      )}
    </div>
  );
}
