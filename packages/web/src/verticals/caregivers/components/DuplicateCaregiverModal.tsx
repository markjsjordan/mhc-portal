/**
 * Duplicate Caregiver Modal
 *
 * Modal for cloning a caregiver record with selective field copying.
 * Creates a new caregiver with PENDING_ONBOARDING status.
 */
import React, { useState } from 'react';
import type { CaregiverStatus } from '../types/index.js';
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
import { Modal } from '@/core/components/index.js';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { caregiverApi } from '../api/index.js';
import type { Caregiver } from '../types/index.js';

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

interface StatusOption {
  value: CaregiverStatus;
  label: string;
}

const statusOptions: StatusOption[] = [
  { value: 'PENDING_ONBOARDING', label: 'Pending Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_LEAVE', label: 'On Leave' },
];

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
  const [newStatus, setNewStatus] = useState<CaregiverStatus>('PENDING_ONBOARDING');

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Duplicate Caregiver"
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
          <div className="space-y-1.5">
            <Label htmlFor="dup-employee-number">
              New Employee # <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dup-employee-number"
              value={newEmployeeNumber}
              onChange={(e) => setNewEmployeeNumber(e.target.value)}
              placeholder="e.g., EMP-2024-999"
              required
              disabled={duplicateMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dup-first-name">
              New First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dup-first-name"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              required
              disabled={duplicateMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dup-last-name">
              New Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dup-last-name"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              required
              disabled={duplicateMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dup-email">
              New Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dup-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              disabled={duplicateMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dup-status">New Status</Label>
            <Select
              value={newStatus}
              onValueChange={(val) => setNewStatus(val as CaregiverStatus)}
              disabled={duplicateMutation.isPending}
            >
              <SelectTrigger id="dup-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                  id={`copy-field-${id}`}
                  checked={copyFields[id as keyof CopyFieldsOptions]}
                  onCheckedChange={(checked) =>
                    setCopyFields((prev) => ({
                      ...prev,
                      [id]: checked === true,
                    }))
                  }
                  disabled={duplicateMutation.isPending}
                />
                <Label
                  htmlFor={`copy-field-${id}`}
                  className="text-sm font-normal text-gray-900 cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            disabled={duplicateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDuplicate}
            variant="default"
            disabled={duplicateMutation.isPending}
          >
            {duplicateMutation.isPending ? 'Creating...' : 'Create Duplicate'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
