/**
 * Accept Invitation Form
 * 
 * Form for accepting team member invitation and creating account
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import type { AcceptInviteRequest, InviteDetails } from '../../services/organization-api.js';

interface AcceptInviteFormProps {
  readonly inviteDetails: InviteDetails;
  readonly onSubmit: (data: AcceptInviteRequest) => Promise<void>;
  readonly isLoading?: boolean;
}

// Field name constants - these are form field names, not actual password values
/* eslint-disable sonarjs/no-hardcoded-passwords */
const PWD_FIELD = 'password';
const CONFIRM_PWD_FIELD = 'confirmPassword';
/* eslint-enable sonarjs/no-hardcoded-passwords */

export function AcceptInviteForm({
  inviteDetails,
  onSubmit,
  isLoading = false,
}: AcceptInviteFormProps): React.ReactElement {
  const [formData, setFormData] = useState({
    firstName: inviteDetails.firstName ?? '',
    lastName: inviteDetails.lastName ?? '',
    [PWD_FIELD]: '',
    [CONFIRM_PWD_FIELD]: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
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

    if (!formData.firstName.trim()) {
      newErrors['firstName'] = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors['lastName'] = 'Last name is required';
    }

    // Password validation
    /* eslint-disable sonarjs/no-hardcoded-passwords */
    const pwd = formData[PWD_FIELD];
    if (!pwd) {
      newErrors[PWD_FIELD] = 'Password is required';
    } else if (pwd.length < 8) {
      newErrors[PWD_FIELD] = 'Password must be at least 8 characters';
    } else {
      // Check password strength
      const hasUppercase = /[A-Z]/.test(pwd);
      const hasLowercase = /[a-z]/.test(pwd);
      const hasNumber = /\d/.test(pwd);
      const hasSpecial = /[!"#$%&()*,.:<>?@^{|}]/.test(pwd);

      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        newErrors[PWD_FIELD] =
          'Password must contain uppercase, lowercase, number, and special character';
      }
    }

    const confirmPwd = formData[CONFIRM_PWD_FIELD];
    if (!confirmPwd) {
      newErrors[CONFIRM_PWD_FIELD] = 'Please confirm your password';
    } else if (pwd !== confirmPwd) {
      newErrors[CONFIRM_PWD_FIELD] = 'Passwords do not match';
    }
    /* eslint-enable sonarjs/no-hardcoded-passwords */

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
        token: inviteDetails.token,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData[PWD_FIELD],
        phone: formData.phone || undefined,
      });
    } catch (error) {
      console.error('Accept invitation error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Invitation Details */}
      <div className="bg-primary/10 border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">
          You've been invited to join
        </h3>
        <p className="text-lg font-semibold text-foreground">
          {inviteDetails.organizationName}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Role: {inviteDetails.roles.join(', ')}
        </p>
        <p className="text-sm text-muted-foreground">Email: {inviteDetails.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="firstName" className="text-sm font-medium">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="John"
              disabled={isLoading}
              aria-invalid={!!errors['firstName']}
              className={errors['firstName'] ? 'border-destructive' : ''}
            />
            {errors['firstName'] && (
              <p className="text-sm text-destructive">{errors['firstName']}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="lastName" className="text-sm font-medium">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Doe"
              disabled={isLoading}
              aria-invalid={!!errors['lastName']}
              className={errors['lastName'] ? 'border-destructive' : ''}
            />
            {errors['lastName'] && (
              <p className="text-sm text-destructive">{errors['lastName']}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={PWD_FIELD} className="text-sm font-medium">
            Password <span className="text-destructive">*</span>
          </Label>
          <Input
            id={PWD_FIELD}
            type="password"
            value={formData[PWD_FIELD]}
            onChange={(e) => handleInputChange(PWD_FIELD, e.target.value)}
            placeholder="Minimum 8 characters"
            disabled={isLoading}
            aria-invalid={!!errors[PWD_FIELD]}
            className={errors[PWD_FIELD] ? 'border-destructive' : ''}
          />
          <p className="text-xs text-muted-foreground">
            Must contain uppercase, lowercase, number, and special character
          </p>
          {errors[PWD_FIELD] && (
            <p className="text-sm text-destructive">{errors[PWD_FIELD]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={CONFIRM_PWD_FIELD} className="text-sm font-medium">
            Confirm Password <span className="text-destructive">*</span>
          </Label>
          <Input
            id={CONFIRM_PWD_FIELD}
            type="password"
            value={formData[CONFIRM_PWD_FIELD]}
            onChange={(e) => handleInputChange(CONFIRM_PWD_FIELD, e.target.value)}
            placeholder="Re-enter password"
            disabled={isLoading}
            aria-invalid={!!errors[CONFIRM_PWD_FIELD]}
            className={errors[CONFIRM_PWD_FIELD] ? 'border-destructive' : ''}
          />
          {errors[CONFIRM_PWD_FIELD] && (
            <p className="text-sm text-destructive">{errors[CONFIRM_PWD_FIELD]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
            disabled={isLoading}
          />
          {errors['phone'] && (
            <p className="text-sm text-destructive">{errors['phone']}</p>
          )}
        </div>

        <div className="pt-4">
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Creating Account...' : 'Accept Invitation & Create Account'}
          </Button>
        </div>
      </form>
    </div>
  );
}
