/**
 * Organization Registration Form
 * 
 * Multi-tenant organization onboarding with state selection
 * Designed to scale from 2 states (TX, FL) to 50 states
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { CreateOrganizationRequest, Address } from '../../services/organization-api.js';
import { US_STATES } from '../../constants/us-states.js';

interface OrganizationRegistrationFormProps {
  readonly onSubmit: (data: CreateOrganizationRequest) => Promise<void>;
  readonly onCancel?: () => void;
  readonly isLoading?: boolean;
}

export function OrganizationRegistrationForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: OrganizationRegistrationFormProps): React.ReactElement {
  const [formData, setFormData] = useState<Partial<CreateOrganizationRequest>>({
    name: '',
    email: '',
    stateCode: 'TX', // Default to Texas
    primaryAddress: {
      street1: '',
      city: '',
      state: 'TX',
      zipCode: '',
      country: 'USA',
    },
    adminUser: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
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

  const handleAddressChange = (field: keyof Address, value: string) => {
    setFormData((prev) => ({
      ...prev,
      primaryAddress: {
        ...(prev.primaryAddress ?? {
          street1: '',
          city: '',
          state: 'TX',
          zipCode: '',
          country: 'USA',
        }),
        [field]: value,
      },
    }));
  };

  const handleAdminUserChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      adminUser: {
        ...(prev.adminUser ?? {
          firstName: '',
          lastName: '',
          email: '',
          password: '',
        }),
        [field]: value,
      },
    }));
    // Clear error when user starts typing
    if (errors[`adminUser.${field}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`adminUser.${field}`];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Organization validation
    if (!formData.name?.trim()) {
      newErrors['name'] = 'Organization name is required';
    }

    if (!formData.email?.trim()) {
      newErrors['email'] = 'Organization email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors['email'] = 'Invalid email format';
    }

    if (!formData.stateCode) {
      newErrors['stateCode'] = 'State selection is required';
    }

    // Address validation
    if (!formData.primaryAddress?.street1.trim()) {
      newErrors['primaryAddress.street1'] = 'Street address is required';
    }

    if (!formData.primaryAddress?.city.trim()) {
      newErrors['primaryAddress.city'] = 'City is required';
    }

    if (!formData.primaryAddress?.zipCode.trim()) {
      newErrors['primaryAddress.zipCode'] = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.primaryAddress.zipCode)) {
      newErrors['primaryAddress.zipCode'] = 'Invalid ZIP code format';
    }

    // Admin user validation
    if (!formData.adminUser?.firstName.trim()) {
      newErrors['adminUser.firstName'] = 'First name is required';
    }

    if (!formData.adminUser?.lastName.trim()) {
      newErrors['adminUser.lastName'] = 'Last name is required';
    }

    if (!formData.adminUser?.email.trim()) {
      newErrors['adminUser.email'] = 'Admin email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminUser.email)) {
      newErrors['adminUser.email'] = 'Invalid email format';
    }

    // Password validation - using optional chaining for adminUser object
    /* eslint-disable sonarjs/no-hardcoded-passwords */
    if (!formData.adminUser?.password) {
      newErrors['adminUser.password'] = 'Password is required';
    } else if (formData.adminUser.password.length < 8) {
      newErrors['adminUser.password'] = 'Password must be at least 8 characters';
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
      await onSubmit(formData as CreateOrganizationRequest);
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
      {/* Organization Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Organization Information</h3>

        <div className="space-y-1">
          <Label htmlFor="org-name" className="text-sm font-medium">
            Organization Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="org-name"
            type="text"
            value={formData.name ?? ''}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Your Organization Name"
            disabled={isLoading}
            aria-invalid={!!errors['name']}
            className={errors['name'] ? 'border-destructive' : ''}
          />
          {errors['name'] && (
            <p className="text-sm text-destructive">{errors['name']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="legal-name" className="text-sm font-medium">Legal Name</Label>
          <Input
            id="legal-name"
            type="text"
            value={formData.legalName ?? ''}
            onChange={(e) => handleInputChange('legalName', e.target.value)}
            placeholder="Legal Business Name (if different)"
            disabled={isLoading}
          />
          {errors['legalName'] && (
            <p className="text-sm text-destructive">{errors['legalName']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="org-state" className="text-sm font-medium">
            State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.stateCode ?? 'TX'}
            onValueChange={(newState) => {
              handleInputChange('stateCode', newState);
              handleAddressChange('state', newState);
            }}
            disabled={isLoading}
          >
            <SelectTrigger
              id="org-state"
              aria-invalid={!!errors['stateCode']}
              className={errors['stateCode'] ? 'border-destructive' : ''}
            >
              <SelectValue placeholder="Select a state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors['stateCode'] && (
            <p className="text-sm text-destructive">{errors['stateCode']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="org-email" className="text-sm font-medium">
            Organization Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="org-email"
            type="email"
            value={formData.email ?? ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="contact@organization.com"
            disabled={isLoading}
            aria-invalid={!!errors['email']}
            className={errors['email'] ? 'border-destructive' : ''}
          />
          {errors['email'] && (
            <p className="text-sm text-destructive">{errors['email']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="org-phone" className="text-sm font-medium">Phone</Label>
          <Input
            id="org-phone"
            type="tel"
            value={formData.phone ?? ''}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
            disabled={isLoading}
          />
          {errors['phone'] && (
            <p className="text-sm text-destructive">{errors['phone']}</p>
          )}
        </div>
      </div>

      {/* Primary Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Primary Address</h3>

        <div className="space-y-1">
          <Label htmlFor="street1" className="text-sm font-medium">
            Street Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="street1"
            type="text"
            value={formData.primaryAddress?.street1 ?? ''}
            onChange={(e) => handleAddressChange('street1', e.target.value)}
            placeholder="123 Main Street"
            disabled={isLoading}
            aria-invalid={!!errors['primaryAddress.street1']}
            className={errors['primaryAddress.street1'] ? 'border-destructive' : ''}
          />
          {errors['primaryAddress.street1'] && (
            <p className="text-sm text-destructive">{errors['primaryAddress.street1']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="street2" className="text-sm font-medium">Street Address Line 2</Label>
          <Input
            id="street2"
            type="text"
            value={formData.primaryAddress?.street2 ?? ''}
            onChange={(e) => handleAddressChange('street2', e.target.value)}
            placeholder="Suite 100 (optional)"
            disabled={isLoading}
          />
          {errors['primaryAddress.street2'] && (
            <p className="text-sm text-destructive">{errors['primaryAddress.street2']}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="city" className="text-sm font-medium">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="city"
              type="text"
              value={formData.primaryAddress?.city ?? ''}
              onChange={(e) => handleAddressChange('city', e.target.value)}
              placeholder="City"
              disabled={isLoading}
              aria-invalid={!!errors['primaryAddress.city']}
              className={errors['primaryAddress.city'] ? 'border-destructive' : ''}
            />
            {errors['primaryAddress.city'] && (
              <p className="text-sm text-destructive">{errors['primaryAddress.city']}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="addr-state" className="text-sm font-medium">
              State <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addr-state"
              type="text"
              value={formData.primaryAddress?.state ?? formData.stateCode ?? ''}
              disabled
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="zipCode" className="text-sm font-medium">
              ZIP Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="zipCode"
              type="text"
              value={formData.primaryAddress?.zipCode ?? ''}
              onChange={(e) => handleAddressChange('zipCode', e.target.value)}
              placeholder="12345"
              disabled={isLoading}
              aria-invalid={!!errors['primaryAddress.zipCode']}
              className={errors['primaryAddress.zipCode'] ? 'border-destructive' : ''}
            />
            {errors['primaryAddress.zipCode'] && (
              <p className="text-sm text-destructive">{errors['primaryAddress.zipCode']}</p>
            )}
          </div>
        </div>
      </div>

      {/* Admin User */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Administrator Account</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="admin-firstName" className="text-sm font-medium">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="admin-firstName"
              type="text"
              value={formData.adminUser?.firstName ?? ''}
              onChange={(e) => handleAdminUserChange('firstName', e.target.value)}
              placeholder="John"
              disabled={isLoading}
              aria-invalid={!!errors['adminUser.firstName']}
              className={errors['adminUser.firstName'] ? 'border-destructive' : ''}
            />
            {errors['adminUser.firstName'] && (
              <p className="text-sm text-destructive">{errors['adminUser.firstName']}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="admin-lastName" className="text-sm font-medium">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="admin-lastName"
              type="text"
              value={formData.adminUser?.lastName ?? ''}
              onChange={(e) => handleAdminUserChange('lastName', e.target.value)}
              placeholder="Doe"
              disabled={isLoading}
              aria-invalid={!!errors['adminUser.lastName']}
              className={errors['adminUser.lastName'] ? 'border-destructive' : ''}
            />
            {errors['adminUser.lastName'] && (
              <p className="text-sm text-destructive">{errors['adminUser.lastName']}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="admin-email" className="text-sm font-medium">
            Admin Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="admin-email"
            type="email"
            value={formData.adminUser?.email ?? ''}
            onChange={(e) => handleAdminUserChange('email', e.target.value)}
            placeholder="admin@organization.com"
            disabled={isLoading}
            aria-invalid={!!errors['adminUser.email']}
            className={errors['adminUser.email'] ? 'border-destructive' : ''}
          />
          {errors['adminUser.email'] && (
            <p className="text-sm text-destructive">{errors['adminUser.email']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="admin-password" className="text-sm font-medium">
            Password <span className="text-destructive">*</span>
          </Label>
          <Input
            id="admin-password"
            type="password"
            value={formData.adminUser?.password ?? ''}
            onChange={(e) => handleAdminUserChange('password', e.target.value)}
            placeholder="Minimum 8 characters"
            disabled={isLoading}
            aria-invalid={!!errors['adminUser.password']}
            className={errors['adminUser.password'] ? 'border-destructive' : ''}
          />
          <p className="text-xs text-muted-foreground">
            Must contain uppercase, lowercase, number, and special character
          </p>
          {errors['adminUser.password'] && (
            <p className="text-sm text-destructive">{errors['adminUser.password']}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="admin-phone" className="text-sm font-medium">Phone</Label>
          <Input
            id="admin-phone"
            type="tel"
            value={formData.adminUser?.phone ?? ''}
            onChange={(e) => handleAdminUserChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
            disabled={isLoading}
          />
          {errors['adminUser.phone'] && (
            <p className="text-sm text-destructive">{errors['adminUser.phone']}</p>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-border">
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
          {isLoading ? 'Creating Organization...' : 'Create Organization'}
        </Button>
      </div>
    </form>
  );
}
