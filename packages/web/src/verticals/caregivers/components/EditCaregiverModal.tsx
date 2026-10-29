/**
 * Edit Caregiver Modal
 *
 * Modal form for editing caregiver fields with optimistic locking support.
 * Pre-populates with existing caregiver data and handles PATCH requests.
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.js';
import { Modal, LoadingSpinner } from '@/core/components/index.js';
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
    phoneNumber: caregiver.primaryPhone.number,
    phoneType: caregiver.primaryPhone.type,
    dateOfBirth: caregiver.dateOfBirth ? String(caregiver.dateOfBirth).split('T')[0] ?? '' : '',
    employmentType: caregiver.employmentType,
    hireDate: caregiver.hireDate ? String(caregiver.hireDate).split('T')[0] ?? '' : '',
    role: caregiver.role,
    status: caregiver.status,
    branchIdsRaw: caregiver.branchIds.join(', '),
    primaryBranchId: caregiver.primaryBranchId || '',
    payRateAmount: caregiver.payRate?.amount != null ? caregiver.payRate.amount.toString() : '',
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
  const [formValues, setFormValues] = useState<CaregiverFormValues>(caregiverToFormValues(caregiver));
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when modal opens. Intentional sync from props; the form is
  // reset on every open so stale edits never leak between caregivers.
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormValues(caregiverToFormValues(caregiver));
      setHasChanges(false);
    }
  }, [isOpen, caregiver]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CaregiverFormValues>) => caregiverApi.updateCaregiver(caregiver.id, payload),
    onSuccess: () => {
      toast.success('Caregiver updated successfully');
      setHasChanges(false);
      onSuccess();
      onClose();
    },
    onError: (error: { response?: { data?: { error?: string; message?: string } } }) => {
      if (error.response?.data?.error === 'OPTIMISTIC_LOCK_FAILURE') {
        toast.error(
          'Record was modified by another user. Please refresh and try again.'
        );
      } else {
        toast.error(error.response?.data?.message ?? 'Failed to update caregiver');
      }
    },
  });

  const handleSave = () => {
    const payload = formValuesToPayload(formValues, caregiver.version ?? 0);
    updateMutation.mutate(payload);
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
          values={formValues}
          onChange={(values) => {
            setFormValues(values);
            setHasChanges(true);
          }}
          disabled={updateMutation.isPending}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            onClick={handleCancel}
            variant="outline"
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            variant="default"
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending && <LoadingSpinner size="sm" />}
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
