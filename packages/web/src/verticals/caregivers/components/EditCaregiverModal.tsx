/**
 * Edit Caregiver Modal - shadcn/ui + React Hook Form Edition
 *
 * Refactored to use the new React Hook Form-based CaregiverForm.
 * Preserves optimistic locking, change tracking, and all data mapping logic.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, LoadingSpinner } from '@/core/components';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { caregiverApi } from '../api/index.js';
import type { Caregiver } from '../types/index.js';
import { CaregiverForm } from './CaregiverForm.js';
import type { CaregiverFormValues } from './CaregiverForm.js';

export interface EditCaregiverModalProps {
  isOpen: boolean;
  caregiver: Caregiver;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Convert caregiver data to form values
 */
function caregiverToFormValues(caregiver: Caregiver): CaregiverFormValues {
  return {
    firstName: caregiver.firstName || '',
    lastName: caregiver.lastName || '',
    middleName: caregiver.middleName ?? '',
    preferredName: caregiver.preferredName ?? '',
    email: caregiver.email || '',
    phoneNumber: caregiver.primaryPhone?.number ?? '',
    phoneType: caregiver.primaryPhone?.type ?? 'MOBILE',
    dateOfBirth: caregiver.dateOfBirth ? String(caregiver.dateOfBirth).split('T')[0] ?? '' : '',
    employmentType: caregiver.employmentType ?? 'FULL_TIME',
    hireDate: caregiver.hireDate ? String(caregiver.hireDate).split('T')[0] ?? '' : '',
    role: caregiver.role ?? 'CAREGIVER',
    status: caregiver.status ?? 'ACTIVE',
    branchIdsRaw: caregiver.branchIds?.join(', ') || '',
    primaryBranchId: caregiver.primaryBranchId || '',
    payRateAmount: caregiver.payRate?.amount?.toString() ?? '',
    payRateUnit: caregiver.payRate?.unit ?? 'HOURLY',
    payRateEffectiveDate: caregiver.payRate?.effectiveDate
      ? (String(caregiver.payRate.effectiveDate).split('T')[0] ?? '')
      : '',
    addressLine1: caregiver.primaryAddress?.line1 ?? '',
    addressLine2: caregiver.primaryAddress?.line2 ?? '',
    addressCity: caregiver.primaryAddress?.city ?? '',
    addressState: caregiver.primaryAddress?.state ?? '',
    addressPostalCode: caregiver.primaryAddress?.postalCode ?? '',
    emergencyContactName: caregiver.emergencyContacts?.[0]?.name ?? '',
    emergencyContactRelationship: caregiver.emergencyContacts?.[0]?.relationship ?? '',
    emergencyContactPhone: caregiver.emergencyContacts?.[0]?.phone ?? '',
  };
}

/**
 * Convert form values to API payload
 */
function formValuesToPayload(values: CaregiverFormValues, originalVersion: number) {
  const branchIds = values.branchIdsRaw
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  return {
    firstName: values.firstName,
    lastName: values.lastName,
    middleName: values.middleName,
    preferredName: values.preferredName,
    email: values.email,
    primaryPhone: {
      number: values.phoneNumber,
      type: values.phoneType,
    },
    dateOfBirth: new Date(values.dateOfBirth).toISOString(),
    employmentType: values.employmentType,
    hireDate: new Date(values.hireDate).toISOString(),
    role: values.role,
    status: values.status,
    branchIds,
    primaryBranchId: values.primaryBranchId,
    payRate: {
      amount: parseFloat(values.payRateAmount),
      unit: values.payRateUnit,
      effectiveDate: new Date(values.payRateEffectiveDate).toISOString(),
    },
    primaryAddress: {
      line1: values.addressLine1,
      line2: values.addressLine2,
      city: values.addressCity,
      state: values.addressState,
      postalCode: values.addressPostalCode,
    },
    emergencyContacts: [
      {
        name: values.emergencyContactName,
        relationship: values.emergencyContactRelationship,
        phone: values.emergencyContactPhone,
      },
    ],
    version: originalVersion, // For optimistic locking
  };
}

export const EditCaregiverModal: React.FC<EditCaregiverModalProps> = ({
  isOpen,
  caregiver,
  onClose,
  onSuccess,
}) => {
  const [defaultValues, setDefaultValues] = useState<CaregiverFormValues>(caregiverToFormValues(caregiver));
  const [hasChanges, setHasChanges] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const submitFormRef = useRef<(() => Promise<void>) | null>(null);
  const hasChangesRef = useRef(false);

  // Stable onChange callback that uses a ref to track changes
  const handleFormChange = React.useCallback(() => {
    if (!hasChangesRef.current) {
      hasChangesRef.current = true;
      setHasChanges(true);
    }
  }, []);

  // Reset form when modal opens or caregiver changes
  useEffect(() => {
    if (isOpen) {
      const newDefaultValues = caregiverToFormValues(caregiver);
      setDefaultValues(newDefaultValues);
      setHasChanges(false);
      hasChangesRef.current = false;
      setFormKey(prev => prev + 1); // Force form remount with new key
    }
  }, [isOpen, caregiver]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => caregiverApi.updateCaregiver(caregiver.id, payload),
    onSuccess: () => {
      toast.success('Caregiver updated successfully');
      setHasChanges(false);
      onSuccess();
      onClose();
    },
    onError: (error: Error & { response?: { data?: { error?: string; message?: string } } }) => {
      if (error.response?.data?.error === 'OPTIMISTIC_LOCK_FAILURE') {
        toast.error(
          'Record was modified by another user. Please refresh and try again.'
        );
      } else {
        toast.error(error.response?.data?.message ?? 'Failed to update caregiver');
      }
    },
  });

  const handleSubmit = async (values: CaregiverFormValues) => {
    const payload = formValuesToPayload(values, caregiver.version ?? 0);
    await updateMutation.mutateAsync(payload);
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('Discard unsaved changes?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={`Edit Caregiver: ${caregiver.firstName || 'Unknown'}`}>
      <div className="space-y-4">
        <CaregiverForm
          key={formKey}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onChange={handleFormChange}
          disabled={updateMutation.isPending}
          onFormReady={(submit) => { submitFormRef.current = submit; }}
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            onClick={handleCancel}
            variant="outline"
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => submitFormRef.current?.()}
            variant="primary"
            disabled={updateMutation.isPending}
            leftIcon={updateMutation.isPending && <LoadingSpinner size="sm" />}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
