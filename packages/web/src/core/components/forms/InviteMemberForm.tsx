/**
 * Invite Team Member Form
 * 
 * Form for inviting new team members via email
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { NativeSelect } from '@/components/ui/select.js';
import type { CreateInviteRequest } from '../../services/organization-api.js';

interface InviteMemberFormProps {
  readonly onSubmit: (data: CreateInviteRequest) => Promise<void>;
  readonly onCancel?: () => void;
  readonly isLoading?: boolean;
}

const ROLE_OPTIONS = [
  { value: 'ORG_ADMIN', label: 'Organization Administrator' },
  { value: 'BRANCH_ADMIN', label: 'Branch Administrator' },
  { value: 'COORDINATOR', label: 'Coordinator' },
  { value: 'SCHEDULER', label: 'Scheduler' },
  { value: 'CAREGIVER', label: 'Caregiver' },
  { value: 'BILLING', label: 'Billing Staff' },
];

export function InviteMemberForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: InviteMemberFormProps): React.ReactElement {
  const [formData, setFormData] = useState<Partial<CreateInviteRequest>>({
    email: '',
    firstName: '',
    lastName: '',
    roles: [],
    expiresInDays: 7,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string | string[] | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email?.trim()) {
      newErrors['email'] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors['email'] = 'Invalid email format';
    }

    if (!formData.roles || formData.roles.length === 0) {
      newErrors['roles'] = 'At least one role must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        email: formData.email!,
        firstName: formData.firstName ?? undefined,
        lastName: formData.lastName ?? undefined,
        roles: formData.roles!,
        expiresInDays: formData.expiresInDays,
      });
    } catch (error) {
      console.error('Invitation error:', error);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email" className="text-sm font-medium">
          Email Address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email ?? ''}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="colleague@example.com"
          disabled={isLoading}
          aria-invalid={!!errors['email']}
          className={errors['email'] ? 'border-destructive' : ''}
        />
        {errors['email'] && (
          <p className="text-sm text-destructive">{errors['email']}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
          <Input
            id="firstName"
            type="text"
            value={formData.firstName ?? ''}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="John"
            disabled={isLoading}
          />
          {errors['firstName'] && (
            <p className="text-sm text-destructive">{errors['firstName']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
          <Input
            id="lastName"
            type="text"
            value={formData.lastName ?? ''}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Doe"
            disabled={isLoading}
          />
          {errors['lastName'] && (
            <p className="text-sm text-destructive">{errors['lastName']}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="role" className="text-sm font-medium">
          Role <span className="text-destructive">*</span>
        </Label>
        <NativeSelect
          id="role"
          value={formData.roles?.[0] ?? ''}
          onChange={(e) => handleInputChange('roles', [e.target.value])}
          disabled={isLoading}
          error={!!errors['roles']}
          aria-invalid={!!errors['roles']}
        >
          <option value="" disabled>Select a role</option>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </NativeSelect>
        {errors['roles'] && (
          <p className="text-sm text-destructive">{errors['roles']}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="expiresInDays" className="text-sm font-medium">
          Invitation Expires In
        </Label>
        <NativeSelect
          id="expiresInDays"
          value={String(formData.expiresInDays ?? 7)}
          onChange={(e) => {
            const numValue = Number(e.target.value);
            setFormData((prev) => ({ ...prev, expiresInDays: numValue }));
          }}
          disabled={isLoading}
          error={!!errors['expiresInDays']}
        >
          {[
            { value: '1', label: '1 day' },
            { value: '3', label: '3 days' },
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
          ].map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </NativeSelect>
        {errors['expiresInDays'] && (
          <p className="text-sm text-destructive">{errors['expiresInDays']}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending Invitation...' : 'Send Invitation'}
        </Button>
      </div>
    </form>
  );
}
