import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@folkcare/shared-components';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { UserProfile } from '@/hooks/useUserProfile';
import { AlertCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

/**
 * Profile form validation schema
 */
const profileFormSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less')
    .refine(
      (val) => /^[a-zA-Z\s'-]+$/.test(val),
      'First name must contain only letters, spaces, hyphens, and apostrophes'
    ),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or less')
    .refine(
      (val) => /^[a-zA-Z\s'-]+$/.test(val),
      'Last name must contain only letters, spaces, hyphens, and apostrophes'
    ),
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z.string()
    .max(20, 'Phone number is too long')
    .refine(
      (val) => val === '' || /^[\d\s\-()]{0,20}$/.test(val),
      'Invalid phone format'
    )
    .optional()
    .nullable(),
  version: z.number().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export interface ProfileFormProps {
  profile: UserProfile | undefined;
  isLoading: boolean;
  isUpdating: boolean;
  updateError: Error | null;
  onSubmit: (data: ProfileFormData & { version?: number }) => void;
  onCancel?: () => void;
  onVersionConflict?: (current: any) => void;
}

/**
 * Version conflict resolution dialog
 */
interface ConflictDialogProps {
  isOpen: boolean;
  currentValues: any;
  userChanges: any;
  onResolve: (action: 'replace' | 'merge') => void;
  onCancel: () => void;
}

function ConflictDialog({ isOpen, currentValues, userChanges, onResolve, onCancel }: ConflictDialogProps) {
  if (!isOpen) return null;

  // Either side can be absent (e.g. a conflict surfaced via updateError before any
  // local submit captured pendingFormData). Render empty values instead of crashing.
  const latest = currentValues ?? {};
  const mine = userChanges ?? {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <Card.Header
          title="⚠️ Profile Update Conflict"
          subtitle="This profile was modified by another user while you were editing."
        />
        <Card.Content className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <div className="flex gap-3">
              <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-yellow-900">Profile Updated Elsewhere</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  Someone else updated this profile. You can replace their changes with yours or merge them.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h5 className="font-semibold text-gray-900 text-sm mb-2">Current Values (Latest):</h5>
              <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                <p><span className="font-medium">Name:</span> {latest.firstName} {latest.lastName}</p>
                <p><span className="font-medium">Email:</span> {latest.email}</p>
                {latest.phone && <p><span className="font-medium">Phone:</span> {latest.phone}</p>}
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-gray-900 text-sm mb-2">Your Changes:</h5>
              <div className="bg-blue-50 rounded p-3 text-sm space-y-1">
                <p><span className="font-medium">Name:</span> {mine.firstName} {mine.lastName}</p>
                <p><span className="font-medium">Email:</span> {mine.email}</p>
                {mine.phone && <p><span className="font-medium">Phone:</span> {mine.phone}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={() => onResolve('replace')}
              variant="secondary"
              className="flex-1"
            >
              Use Current Values
            </Button>
            <Button
              type="button"
              onClick={() => onResolve('merge')}
              className="flex-1"
            >
              Keep My Changes
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

/**
 * ProfileForm component with auto-population, validation, and conflict resolution
 */
export function ProfileForm({
  profile,
  isLoading,
  isUpdating,
  updateError,
  onSubmit,
  onCancel,
  onVersionConflict,
}: ProfileFormProps) {
  const [showConflict, setShowConflict] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);
  const [pendingFormData, setPendingFormData] = useState<ProfileFormData | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
    },
    mode: 'onBlur',
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone ?? '',
      });
      setSyncedAt(new Date());
    }
  }, [profile, reset]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Handle confirm before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleFormSubmit = (data: ProfileFormData) => {
    if (profile?.version !== undefined) {
      data.version = profile.version;
    }
    setPendingFormData(data);
    onSubmit(data);
  };

  const handleConflictResolution = (action: 'replace' | 'merge') => {
    setShowConflict(false);

    if (action === 'replace' && conflictData) {
      // Reload with current values from server
      reset({
        firstName: conflictData.firstName,
        lastName: conflictData.lastName,
        email: conflictData.email,
        phone: conflictData.phone ?? '',
      });
      setSyncedAt(new Date());
    } else if (action === 'merge' && pendingFormData) {
      // Retry submission with latest version
      const updatedData = {
        ...pendingFormData,
        version: conflictData?.version,
      };
      onSubmit(updatedData);
    }

    setPendingFormData(null);
    setConflictData(null);
  };

  // Check for version conflict in updateError
  useEffect(() => {
    if (updateError) {
      const errorData = (updateError as any)?.response?.data;
      if (errorData?.code === 'VERSION_CONFLICT') {
        setConflictData(errorData.current);
        setShowConflict(true);
        onVersionConflict?.(errorData.current);
      }
    }
  }, [updateError, onVersionConflict]);

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }
    reset();
    setHasUnsavedChanges(false);
    onCancel?.();
  };

  if (isLoading) {
    return (
      <Card>
        <Card.Content>
          <div className="flex items-center justify-center py-8">
            <div
              role="progressbar"
              aria-label="Loading profile"
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
            ></div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Card.Header
          title="Profile Information"
          subtitle="Update your personal information"
        />
        <Card.Content>
          <form onSubmit={(e) => { void handleSubmit(handleFormSubmit)(e); }} className="space-y-6">
            {/* Error message */}
            {updateError && (updateError as any)?.response?.data?.code !== 'VERSION_CONFLICT' && (
              <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-semibold text-red-900">Error</h4>
                  <p className="text-sm text-red-800 mt-1">{(updateError as any)?.message}</p>
                </div>
              </div>
            )}

            {/* Success message for synced status */}
            {syncedAt && !isDirty && !isUpdating && (
              <div className="flex gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-green-800">
                  Profile synced successfully
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  {...register('firstName')}
                  disabled={isUpdating}
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && (
                  <p className="text-destructive text-sm">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  {...register('lastName')}
                  disabled={isUpdating}
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && (
                  <p className="text-destructive text-sm">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                disabled={isUpdating}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              )}
            </div>
            {watch('email') !== profile?.email && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                ℹ️ We'll send a verification link to your new email address
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                {...register('phone')}
                disabled={isUpdating}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone && (
                <p className="text-destructive text-sm">{errors.phone.message}</p>
              )}
            </div>

            {/* Last synced timestamp */}
            {syncedAt && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={14} />
                <span>
                  Last synced: {syncedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t">
              <Button
                type="submit"
                disabled={!isDirty || isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      {/* Version conflict dialog */}
      <ConflictDialog
        isOpen={showConflict}
        currentValues={conflictData}
        userChanges={pendingFormData}
        onResolve={handleConflictResolution}
        onCancel={() => {
          setShowConflict(false);
          setPendingFormData(null);
          setConflictData(null);
        }}
      />
    </>
  );
}
