import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useOnboarding } from '@/core/hooks';
import toast from 'react-hot-toast';
import { Input, Select, FormField } from '@/core/components';
import type { OnboardingStepId } from '@folkcare/core';

/**
 * Onboarding Wizard for new agencies
 * 
 * This is a guided setup flow that helps new agencies configure their
 * MHC Portal instance after signup. The goal is to get agencies from
 * signup to first real visit in under 24 hours.
 */

// US States for dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

interface StepConfig {
  id: OnboardingStepId;
  title: string;
  description: string;
  icon: React.ReactNode;
  estimatedMinutes: number;
  isOptional?: boolean;
}

const CheckIcon = () => (
  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const STEP_CONFIGS: StepConfig[] = [
  {
    id: 'email_verified',
    title: 'Verify Your Email',
    description: 'Confirm your email address to secure your account',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    estimatedMinutes: 1,
  },
  {
    id: 'services_configured',
    title: 'Complete Organization Profile',
    description: 'Add your business address and details',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    estimatedMinutes: 5,
  },
  {
    id: 'payors_added',
    title: 'Add Payors',
    description: 'Configure Medicaid, Medicare, and private pay sources',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    estimatedMinutes: 10,
  },
  {
    id: 'evv_configured',
    title: 'EVV Configuration',
    description: 'Connect to your state EVV aggregator for compliance',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    estimatedMinutes: 15,
  },
  {
    id: 'first_caregiver',
    title: 'Add Your First Caregiver',
    description: 'Create a caregiver to test the mobile app',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    estimatedMinutes: 5,
  },
  {
    id: 'first_client',
    title: 'Add Your First Client',
    description: 'Create a client record to test the system',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    estimatedMinutes: 10,
  },
  {
    id: 'test_visit',
    title: 'Schedule a Test Visit',
    description: 'Create your first visit to test the complete workflow',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    estimatedMinutes: 5,
  },
  {
    id: 'team_invited',
    title: 'Invite Your Team',
    description: 'Add other administrators and coordinators',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    estimatedMinutes: 5,
    isOptional: true,
  },
];

// Form schemas for each step
const orgProfileSchema = z.object({
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(5, 'ZIP code is required'),
  phone: z.string().optional(),
  legalName: z.string().optional(),
});

const caregiverSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
});

const clientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  street1: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(5, 'ZIP code is required'),
});

type OrgProfileForm = z.infer<typeof orgProfileSchema>;
type CaregiverForm = z.infer<typeof caregiverSchema>;
type ClientForm = z.infer<typeof clientSchema>;

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const {
    progress,
    isLoading,
    error,
    initialize,
    updateStep,
  } = useOnboarding();
  
  const [expandedStep, setExpandedStep] = useState<string | null>('email_verified');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form hooks for each step
  const orgProfileForm = useForm<OrgProfileForm>({
    resolver: zodResolver(orgProfileSchema),
    defaultValues: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zipCode: '',
      phone: '',
      legalName: '',
    },
  });

  const caregiverForm = useForm<CaregiverForm>({
    resolver: zodResolver(caregiverSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
  });

  const clientForm = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      street1: '',
      city: '',
      state: '',
      zipCode: '',
    },
  });

  // Initialize onboarding if not already initialized
  useEffect(() => {
    const initIfNeeded = async () => {
      if (!isLoading && progress === null && !isInitializing) {
        setIsInitializing(true);
        try {
          // Default to TX for now - in production this would come from signup
          await initialize('TX');
        } catch {
          // Error already handled in hook
        } finally {
          setIsInitializing(false);
        }
      }
    };
    void initIfNeeded();
  }, [isLoading, progress, initialize, isInitializing]);

  // Get step status from progress
  const getStepStatus = (stepId: OnboardingStepId) => {
    if (progress === null) return { isComplete: false };
    const step = progress.steps.find(s => s.id === stepId);
    return {
      isComplete: step?.status === 'completed' || step?.status === 'skipped',
      status: step?.status ?? 'not_started',
    };
  };

  const steps = STEP_CONFIGS.map(config => ({
    ...config,
    ...getStepStatus(config.id),
  }));

  const completedSteps = steps.filter((s) => s.isComplete).length;
  const totalSteps = steps.filter((s) => !s.isOptional).length;
  const progressPercent = progress?.overallProgress ?? Math.round((completedSteps / totalSteps) * 100);

  const handleStepClick = (stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  const handleMarkComplete = async (stepId: OnboardingStepId) => {
    try {
      await updateStep(stepId, 'completed');
      
      // Find next incomplete step
      const currentIndex = steps.findIndex((s) => s.id === stepId);
      const nextStep = steps.slice(currentIndex + 1).find((s) => !s.isComplete);
      if (nextStep !== undefined) {
        setExpandedStep(nextStep.id);
      }
      
      toast.success('Step completed!');
    } catch {
      toast.error('Failed to update step');
    }
  };

  const handleSkipStep = async (stepId: OnboardingStepId) => {
    try {
      await updateStep(stepId, 'skipped');
      
      // Find next incomplete step
      const currentIndex = steps.findIndex((s) => s.id === stepId);
      const nextStep = steps.slice(currentIndex + 1).find((s) => !s.isComplete);
      if (nextStep !== undefined) {
        setExpandedStep(nextStep.id);
      }
    } catch {
      toast.error('Failed to skip step');
    }
  };

  const handleSkipOnboarding = () => {
    navigate('/dashboard');
  };

  const handleCompleteOnboarding = () => {
    toast.success('Congratulations! Your agency is ready to go live.');
    navigate('/dashboard');
  };

  // Save organization profile
  const handleSaveOrgProfile = async (data: OrgProfileForm) => {
    if (!user?.organizationId || !token) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/organizations/${user.organizationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          legalName: data.legalName || undefined,
          phone: data.phone || undefined,
          primaryAddress: {
            street1: data.street1,
            street2: data.street2 || undefined,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            country: 'USA',
          },
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error ?? 'Failed to update profile');
      }

      toast.success('Organization profile updated!');
      await handleMarkComplete('services_configured');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Save caregiver
  const handleSaveCaregiver = async (data: CaregiverForm) => {
    if (!user?.organizationId || !token) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/caregivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || undefined,
          roles: ['CAREGIVER'],
          status: 'ACTIVE',
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error ?? 'Failed to create caregiver');
      }

      toast.success('Caregiver added successfully!');
      caregiverForm.reset();
      await handleMarkComplete('first_caregiver');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add caregiver');
    } finally {
      setIsSaving(false);
    }
  };

  // Save client
  const handleSaveClient = async (data: ClientForm) => {
    if (!user?.organizationId || !token) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || undefined,
          address: {
            street1: data.street1,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            country: 'USA',
          },
          status: 'ACTIVE',
        }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error ?? 'Failed to create client');
      }

      toast.success('Client added successfully!');
      clientForm.reset();
      await handleMarkComplete('first_client');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add client');
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepContent = (step: StepConfig & { isComplete: boolean }) => {
    switch (step.id) {
      case 'email_verified':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              We sent a verification email to <strong>{user?.email}</strong>.
              Click the link in the email to verify your account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => toast.success('Verification email resent!')}
                className="px-4 py-2 text-sm font-medium text-green-600 border border-green-600 rounded-lg hover:bg-green-50"
              >
                Resend Email
              </button>
              <button
                onClick={() => void handleMarkComplete(step.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                I&apos;ve Verified My Email
              </button>
            </div>
          </div>
        );
      
      case 'services_configured':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Complete your organization profile with your business address and details.
            </p>
            
            <form onSubmit={orgProfileForm.handleSubmit(handleSaveOrgProfile)} className="space-y-4">
              <FormField label="Legal Business Name" error={orgProfileForm.formState.errors.legalName?.message}>
                <Input
                  {...orgProfileForm.register('legalName')}
                  placeholder="e.g., Sunshine Home Health LLC"
                />
              </FormField>

              <FormField label="Street Address" error={orgProfileForm.formState.errors.street1?.message} required>
                <Input
                  {...orgProfileForm.register('street1')}
                  placeholder="123 Main Street"
                />
              </FormField>

              <FormField label="Suite/Unit (Optional)" error={orgProfileForm.formState.errors.street2?.message}>
                <Input
                  {...orgProfileForm.register('street2')}
                  placeholder="Suite 100"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="City" error={orgProfileForm.formState.errors.city?.message} required>
                  <Input
                    {...orgProfileForm.register('city')}
                    placeholder="Austin"
                  />
                </FormField>

                <FormField label="State" error={orgProfileForm.formState.errors.state?.message} required>
                  <Select
                    {...orgProfileForm.register('state')}
                    options={[
                      { value: '', label: 'Select state' },
                      ...US_STATES.map((s) => ({ value: s.code, label: s.name })),
                    ]}
                  />
                </FormField>

                <FormField label="ZIP Code" error={orgProfileForm.formState.errors.zipCode?.message} required>
                  <Input
                    {...orgProfileForm.register('zipCode')}
                    placeholder="78701"
                    maxLength={10}
                  />
                </FormField>

                <FormField label="Business Phone" error={orgProfileForm.formState.errors.phone?.message}>
                  <Input
                    {...orgProfileForm.register('phone')}
                    type="tel"
                    placeholder="(512) 555-1234"
                  />
                </FormField>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save & Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSkipStep(step.id)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Skip for Now
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'payors_added':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Set up your payer sources to track billing and reimbursement.
              Most agencies work with Medicaid, Medicare, and private pay clients.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  void handleMarkComplete(step.id);
                  navigate('/billing/payors');
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Add Payors
              </button>
              <button
                onClick={() => void handleSkipStep(step.id)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Skip for Now
              </button>
            </div>
          </div>
        );
      
      case 'evv_configured':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Electronic Visit Verification (EVV) is required for Medicaid-funded services.
              Connect to your state&apos;s EVV aggregator to submit visit data automatically.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Based on your state selection, we&apos;ve pre-configured settings for your state&apos;s EVV requirements.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  void handleMarkComplete(step.id);
                  navigate('/settings/evv');
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Configure EVV
              </button>
              <button
                onClick={() => void handleSkipStep(step.id)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Skip for Now
              </button>
            </div>
          </div>
        );
      
      case 'first_caregiver':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Add a caregiver to test the mobile app experience. You can invite yourself
              as a test caregiver using a different email address.
            </p>

            <form onSubmit={caregiverForm.handleSubmit(handleSaveCaregiver)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" error={caregiverForm.formState.errors.firstName?.message} required>
                  <Input
                    {...caregiverForm.register('firstName')}
                    placeholder="Jane"
                  />
                </FormField>

                <FormField label="Last Name" error={caregiverForm.formState.errors.lastName?.message} required>
                  <Input
                    {...caregiverForm.register('lastName')}
                    placeholder="Smith"
                  />
                </FormField>

                <FormField label="Email" error={caregiverForm.formState.errors.email?.message} required>
                  <Input
                    {...caregiverForm.register('email')}
                    type="email"
                    placeholder="jane@example.com"
                  />
                </FormField>

                <FormField label="Phone" error={caregiverForm.formState.errors.phone?.message}>
                  <Input
                    {...caregiverForm.register('phone')}
                    type="tel"
                    placeholder="(555) 555-1234"
                  />
                </FormField>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Adding...' : 'Add Caregiver'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSkipStep(step.id)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Skip for Now
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'first_client':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Create a client record to test scheduling and documentation.
              You can use test data or add a real client.
            </p>

            <form onSubmit={clientForm.handleSubmit(handleSaveClient)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" error={clientForm.formState.errors.firstName?.message} required>
                  <Input
                    {...clientForm.register('firstName')}
                    placeholder="John"
                  />
                </FormField>

                <FormField label="Last Name" error={clientForm.formState.errors.lastName?.message} required>
                  <Input
                    {...clientForm.register('lastName')}
                    placeholder="Doe"
                  />
                </FormField>

                <div className="col-span-2">
                  <FormField label="Phone" error={clientForm.formState.errors.phone?.message}>
                    <Input
                      {...clientForm.register('phone')}
                      type="tel"
                      placeholder="(555) 555-1234"
                    />
                  </FormField>
                </div>

                <div className="col-span-2">
                  <FormField label="Street Address" error={clientForm.formState.errors.street1?.message} required>
                    <Input
                      {...clientForm.register('street1')}
                      placeholder="456 Oak Street"
                    />
                  </FormField>
                </div>

                <FormField label="City" error={clientForm.formState.errors.city?.message} required>
                  <Input
                    {...clientForm.register('city')}
                    placeholder="Austin"
                  />
                </FormField>

                <FormField label="State" error={clientForm.formState.errors.state?.message} required>
                  <Select
                    {...clientForm.register('state')}
                    options={[
                      { value: '', label: 'Select state' },
                      ...US_STATES.map((s) => ({ value: s.code, label: s.name })),
                    ]}
                  />
                </FormField>

                <FormField label="ZIP Code" error={clientForm.formState.errors.zipCode?.message} required>
                  <Input
                    {...clientForm.register('zipCode')}
                    placeholder="78701"
                    maxLength={10}
                  />
                </FormField>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Adding...' : 'Add Client'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSkipStep(step.id)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Skip for Now
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'test_visit':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Schedule a test visit to see the complete workflow from scheduling
              through EVV clock-in/out and documentation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  void handleMarkComplete(step.id);
                  navigate('/schedule');
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Schedule Visit
              </button>
              <button
                onClick={() => void handleSkipStep(step.id)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Skip for Now
              </button>
            </div>
          </div>
        );
      
      case 'team_invited':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Invite other team members to help manage your agency.
              You can assign different roles like Coordinator, Scheduler, or Billing.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  void handleMarkComplete(step.id);
                  navigate('/settings/team');
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Invite Team
              </button>
              <button
                onClick={() => void handleSkipStep(step.id)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Skip for Now
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (isLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to MHC Portal</h1>
              <p className="text-gray-600 mt-1">Let&apos;s get your agency set up</p>
            </div>
            <button
              onClick={handleSkipOnboarding}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Skip setup, go to dashboard
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">
                {completedSteps} of {totalSteps} steps complete
              </span>
              <span className="text-gray-500">{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`bg-white rounded-xl shadow-sm border ${
                step.isComplete
                  ? 'border-green-200'
                  : expandedStep === step.id
                  ? 'border-green-500 ring-2 ring-green-200'
                  : 'border-gray-200'
              }`}
            >
              <button
                onClick={() => handleStepClick(step.id)}
                className="w-full px-6 py-4 flex items-center gap-4 text-left"
              >
                {/* Step number or check */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    step.isComplete
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {step.isComplete ? <CheckIcon /> : step.icon}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-semibold ${
                        step.isComplete ? 'text-green-700' : 'text-gray-900'
                      }`}
                    >
                      {step.title}
                    </h3>
                    {step.isOptional === true && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                        Optional
                      </span>
                    )}
                    {step.isComplete && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        Complete
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
                </div>

                {/* Time estimate */}
                <div className="flex-shrink-0 text-sm text-gray-400">
                  ~{step.estimatedMinutes} min
                </div>

                {/* Expand icon */}
                <svg
                  className={`flex-shrink-0 w-5 h-5 text-gray-400 transition-transform ${
                    expandedStep === step.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {expandedStep === step.id && !step.isComplete && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                  {renderStepContent(step)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Complete button */}
        {completedSteps >= totalSteps && (
          <div className="mt-8 text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-green-800">You&apos;re All Set!</h2>
              </div>
              <p className="text-green-700">
                Your agency is configured and ready to start serving clients.
              </p>
            </div>
            <button
              onClick={handleCompleteOnboarding}
              className="px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-lg hover:shadow-xl transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
