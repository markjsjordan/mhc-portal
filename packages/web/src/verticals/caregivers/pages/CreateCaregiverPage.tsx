/**
 * Create Caregiver Page - shadcn/ui + React Hook Form Edition
 *
 * Refactored to use CaregiverForm with React Hook Form integration.
 * Preserves all validation logic (now in Zod schema), API payload generation,
 * error handling, and navigation flows. The form now handles its own submission
 * via onSubmit callback.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button.js';
import { useAuth } from '@/core/hooks';
import { CaregiverForm, EMPTY_CAREGIVER_FORM } from '../components/CaregiverForm.js';
import type { CaregiverFormValues } from '../components/CaregiverForm.js';
import { useCaregiverApi } from '../hooks/index.js';
import type { Caregiver } from '../types/index.js';

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const withResponse = error as Error & { response?: { data?: { error?: string; message?: string } } };
    const apiMessage = withResponse.response?.data?.error ?? withResponse.response?.data?.message;
    if (apiMessage) return apiMessage;
    if (error.message) return error.message;
  }
  return fallback;
}

function parseBranchIds(raw: string): string[] {
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function toCreatePayload(values: CaregiverFormValues, organizationId: string): Record<string, unknown> {
  const parsedBranchIds = parseBranchIds(values.branchIdsRaw);
  const primaryBranchId = values.primaryBranchId.trim();
  // Guarantee the submitted payload can never violate the DB's
  // CHECK(primary_branch_id = ANY(branch_ids)) constraint: if the user
  // didn't duplicate the primary branch into the branch list, do it for them.
  const branchIds = primaryBranchId && !parsedBranchIds.includes(primaryBranchId)
    ? [...parsedBranchIds, primaryBranchId]
    : parsedBranchIds;

  return {
    organizationId,
    branchIds,
    primaryBranchId,
    firstName: values.firstName.trim(),
    middleName: values.middleName?.trim() || undefined,
    lastName: values.lastName.trim(),
    preferredName: values.preferredName?.trim() || undefined,
    // dateOfBirth / hireDate / payRate.effectiveDate are ALWAYS populated here —
    // this is the fix for the backend's unconditional `new Date(...)` crash risk.
    dateOfBirth: values.dateOfBirth,
    email: values.email.trim(),
    primaryPhone: {
      number: normalizePhoneDigits(values.phoneNumber),
      type: values.phoneType,
      canReceiveSMS: values.phoneType === 'MOBILE',
      isPrimary: true,
    },
    primaryAddress: {
      type: 'HOME',
      line1: values.addressLine1.trim(),
      line2: values.addressLine2?.trim() || undefined,
      city: values.addressCity.trim(),
      state: values.addressState.trim().toUpperCase(),
      postalCode: values.addressPostalCode.trim(),
      country: 'US',
    },
    emergencyContacts: [
      {
        id: crypto.randomUUID(),
        name: values.emergencyContactName.trim(),
        relationship: values.emergencyContactRelationship.trim(),
        phone: {
          number: normalizePhoneDigits(values.emergencyContactPhone),
          type: 'MOBILE',
          canReceiveSMS: true,
        },
        isPrimary: true,
      },
    ],
    employmentType: values.employmentType,
    hireDate: values.hireDate,
    role: values.role,
    payRate: {
      id: crypto.randomUUID(),
      rateType: 'BASE',
      amount: Number(values.payRateAmount),
      unit: values.payRateUnit,
      effectiveDate: values.payRateEffectiveDate,
    },
    status: values.status || undefined,
  };
}

export const CreateCaregiverPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const caregiverApi = useCaregiverApi();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const submitButtonRef = React.useRef<HTMLButtonElement>(null);

  const handleSubmit = async (values: CaregiverFormValues) => {
    if (!user?.organizationId) {
      toast.error('Unable to determine your organization. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = toCreatePayload(values, user.organizationId);
      const created = await caregiverApi.createCaregiver(payload as unknown as Partial<Caregiver>);
      toast.success('Caregiver created successfully');
      Promise.resolve(navigate(`/caregivers/${created.id}`)).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Navigation failed');
      });
    } catch (error) {
      // Surface the real API error (e.g. Zod validation messages from the
      // backend) instead of alert() or silently succeeding.
      toast.error(extractApiErrorMessage(error, 'Failed to create caregiver'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Add Caregiver</h1>
        <p className="text-gray-600 mt-1">Create a new caregiver record</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <CaregiverForm
          defaultValues={EMPTY_CAREGIVER_FORM}
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          submitButtonRef={submitButtonRef}
        />

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button 
            type="button" 
            disabled={isSubmitting}
            onClick={() => submitButtonRef.current?.click()}
          >
            {isSubmitting ? 'Creating...' : 'Create Caregiver'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              Promise.resolve(navigate('/caregivers')).catch((err: unknown) => {
                toast.error(err instanceof Error ? err.message : 'Navigation failed');
              });
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
