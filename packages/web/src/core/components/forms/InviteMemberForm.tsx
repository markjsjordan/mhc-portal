/**
 * Invite Team Member Form
 * 
 * Form for inviting new team members via URL generation.
 * Admin creates a user and generates an invitation URL they can email directly.
 */

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '../Button.js';
import { Input } from './Input.js';
import { Select } from './Select.js';
import { FormField } from './FormField.js';
import type { CreateInviteRequest } from '../../services/organization-api.js';

interface InviteMemberFormProps {
  readonly onSubmit: (data: CreateInviteRequest) => Promise<void>;
  readonly onCancel?: () => void;
  readonly isLoading?: boolean;
}

interface GeneratedInvite {
  inviteUrl: string;
  inviteToken: string;
  expiresAt: string;
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
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleInputChange = (field: string, value: string | string[]) => {
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
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        roles: formData.roles!,
        expiresInDays: formData.expiresInDays,
      });

      // Simulate generated invite (in real implementation, server returns this)
      const baseUrl = window.location.origin;
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (formData.expiresInDays || 7));

      setGeneratedInvite({
        inviteUrl: `${baseUrl}/accept-invite?token=${inviteToken}`,
        inviteToken,
        expiresAt: expiresAt.toISOString(),
      });

      // Reset form
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        roles: [],
        expiresInDays: 7,
      });
    } catch (error) {
      console.error('Invitation error:', error);
    }
  };

  const copyToClipboard = async () => {
    if (generatedInvite) {
      await navigator.clipboard.writeText(generatedInvite.inviteUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (generatedInvite) {
    return (
      <div className="space-y-6 bg-green-50 border border-green-200 rounded-lg p-6">
        <div>
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            Invitation URL Generated ✓
          </h3>
          <p className="text-sm text-green-700 mb-4">
            Copy the link below and email it to {formData.email}. The invitation expires on{' '}
            {new Date(generatedInvite.expiresAt).toLocaleDateString()}.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Invitation URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={generatedInvite.inviteUrl}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm bg-white"
            />
            <Button
              onClick={copyToClipboard}
              variant="secondary"
              leftIcon={copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              title="Copy to clipboard"
            >
              {copySuccess ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-green-200">
          <Button
            onClick={() => setGeneratedInvite(null)}
            variant="primary"
            className="w-full"
          >
            Create Another Invitation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-800">
          <strong>New Flow:</strong> Generate an invitation URL and email it directly to the team member.
        </p>
      </div>

      <FormField label="Email Address" error={errors['email']} required>
        <Input
          type="email"
          value={formData.email ?? ''}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="colleague@example.com"
          disabled={isLoading}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="First Name" error={errors['firstName']}>
          <Input
            type="text"
            value={formData.firstName ?? ''}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="John"
            disabled={isLoading}
          />
        </FormField>

        <FormField label="Last Name" error={errors['lastName']}>
          <Input
            type="text"
            value={formData.lastName ?? ''}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Doe"
            disabled={isLoading}
          />
        </FormField>
      </div>

      <FormField label="Role" error={errors['roles']} required>
        <Select
          value={formData.roles?.[0] ?? ''}
          onChange={(e) => handleInputChange('roles', [e.target.value])}
          disabled={isLoading}
          options={ROLE_OPTIONS}
          placeholder="Select a role"
        />
      </FormField>

      <FormField label="Invitation Expires In" error={errors['expiresInDays']}>
        <Select
          value={String(formData.expiresInDays ?? 7)}
          onChange={(e) => {
            const numValue = Number(e.target.value);
            setFormData((prev) => ({ ...prev, expiresInDays: numValue }));
          }}
          disabled={isLoading}
          options={[
            { value: '1', label: '1 day' },
            { value: '3', label: '3 days' },
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
          ]}
        />
      </FormField>

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
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Generating Invitation...' : 'Generate Invitation URL'}
        </Button>
      </div>
    </form>
  );
}
