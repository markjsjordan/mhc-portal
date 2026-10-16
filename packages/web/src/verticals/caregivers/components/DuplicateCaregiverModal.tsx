/**
 * Duplicate Caregiver Modal
 *
 * Modal for cloning a caregiver record with selective field copying.
 * Creates a new caregiver with PENDING_ONBOARDING status.
 */
import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Modal, Checkbox, Input, Select } from '@/core/components';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { caregiverApi } from '../api/index.js';
import type { Caregiver } from '../types/index.js';
import type { SelectOption } from '@/core/components/forms/Select';

export interface DuplicateCaregiverModalProps {
  isOpen: boolean;
  caregiver: Caregiver;
  onClose: () => void;
}

interface CopyFieldsOptions {
  skills: boolean;
  certifications: boolean;
  workPreferences: boolean;
  availabilityPattern: boolean;
  employmentHistory: boolean;
  performanceReviews: boolean;
  backgroundCheckResults: boolean;
}

export const DuplicateCaregiverModal: React.FC<DuplicateCaregiverModalProps> = ({
  isOpen,
  caregiver,
  onClose,
}) => {
  const navigate = useNavigate();
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');
  const [newFirstName, setNewFirstName] = useState(caregiver.firstName || '');
  const [newLastName, setNewLastName] = useState(`${caregiver.lastName || ''}-Copy`);
  const [newEmail, setNewEmail] = useState('');
  const [newStatus, setNewStatus] = useState('PENDING_ONBOARDING');

  const [copyFields, setCopyFields] = useState<CopyFieldsOptions>({
    skills: true,
    certifications: true,
    workPreferences: true,
    availabilityPattern: false,
    employmentHistory: false,
    performanceReviews: false,
    backgroundCheckResults: false,
  });

  const duplicateMutation = useMutation({
    mutationFn: (payload: any) => caregiverApi.duplicateCaregiver(caregiver.id, payload),
    onSuccess: (newCaregiver) => {
      toast.success(
        <div>
          <p>Caregiver duplicated successfully</p>
          <p className="text-xs opacity-75">{newCaregiver.employeeNumber}</p>
        </div>
      );
      handleClose();
      Promise.resolve(navigate(`/caregivers/${newCaregiver.id}`)).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Navigation failed');
      });
    },
    onError: (error: any) => {
      if (error.response?.data?.error === 'DUPLICATE_EMAIL') {
        toast.error('Email already in use');
      } else {
        toast.error(error.response?.data?.message ?? 'Failed to duplicate caregiver');
      }
    },
  });

  const handleClose = () => {
    setNewEmployeeNumber('');
    setNewFirstName(caregiver.firstName || '');
    setNewLastName(`${caregiver.lastName || ''}-Copy`);
    setNewEmail('');
    setNewStatus('PENDING_ONBOARDING');
    setCopyFields({
      skills: true,
      certifications: true,
      workPreferences: true,
      availabilityPattern: false,
      employmentHistory: false,
      performanceReviews: false,
      backgroundCheckResults: false,
    });
    onClose();
  };

  const handleDuplicate = () => {
    if (!newEmployeeNumber.trim()) {
      toast.error('Employee number is required');
      return;
    }
    if (!newEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    const payload = {
      newEmployeeNumber: newEmployeeNumber.trim(),
      newFirstName: newFirstName.trim(),
      newLastName: newLastName.trim(),
      newEmail: newEmail.trim(),
      newStatus,
      copyFields,
    };

    duplicateMutation.mutate(payload);
  };

  const statusOptions: SelectOption[] = [
    { value: 'PENDING_ONBOARDING', label: 'Pending Onboarding' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'ON_LEAVE', label: 'On Leave' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Duplicate Caregiver"
      icon={<Copy className="h-6 w-6 text-blue-600" />}
      size="lg"
    >
      <div className="space-y-4">
        {/* Source info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            Creating a copy of: <strong>{caregiver.firstName || ''} {caregiver.lastName || ''}</strong>
          </p>
          <p className="text-xs text-blue-700">
            Original: {caregiver.employeeNumber}
          </p>
        </div>

        {/* New caregiver fields */}
        <div className="space-y-3">
          <Input
            label="New Employee #"
            value={newEmployeeNumber}
            onChange={(e) => setNewEmployeeNumber(e.target.value)}
            placeholder="e.g., EMP-2024-999"
            required
            disabled={duplicateMutation.isPending}
          />

          <Input
            label="New First Name"
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.target.value)}
            required
            disabled={duplicateMutation.isPending}
          />

          <Input
            label="New Last Name"
            value={newLastName}
            onChange={(e) => setNewLastName(e.target.value)}
            required
            disabled={duplicateMutation.isPending}
          />

          <Input
            label="New Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            disabled={duplicateMutation.isPending}
          />

          <Select
            label="New Status"
            value={newStatus}
            onChange={(value) => setNewStatus(value)}
            options={statusOptions}
            disabled={duplicateMutation.isPending}
          />
        </div>

        {/* Field selection */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Fields to copy:</p>
          <div className="space-y-2">
            {[
              { id: 'skills', label: 'Skills & Competencies' },
              { id: 'certifications', label: 'Certifications & Credentials' },
              { id: 'workPreferences', label: 'Work Preferences' },
              { id: 'availabilityPattern', label: 'Availability Pattern' },
              { id: 'employmentHistory', label: 'Employment History' },
              { id: 'performanceReviews', label: 'Performance Reviews' },
              { id: 'backgroundCheckResults', label: 'Background Check Results' },
            ].map(({ id, label }) => (
              <div key={id} className="flex items-center gap-2">
                <Checkbox
                  id={`copy-${id}`}
                  checked={copyFields[id as keyof CopyFieldsOptions]}
                  onChange={(checked) =>
                    setCopyFields((prev) => ({
                      ...prev,
                      [id]: checked,
                    }))
                  }
                  disabled={duplicateMutation.isPending}
                />
                <label
                  htmlFor={`copy-${id}`}
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={duplicateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDuplicate}
            variant="primary"
            disabled={duplicateMutation.isPending}
            isLoading={duplicateMutation.isPending}
          >
            Create Duplicate
          </Button>
        </div>
      </div>
    </Modal>
  );
};
