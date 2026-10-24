import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/core/hooks';
import toast from 'react-hot-toast';
import { US_STATES } from '@/core/constants/us-states';
import { Input, Select, FormField } from '@/core/components';

// Zod schema for form validation
const signupSchema = z.object({
  // Step 1: Organization
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  stateCode: z.string().min(1, 'Please select your state'),
  organizationPhone: z.string()
    .regex(/^\d{10}$/, 'Please enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  // Step 2: Admin User
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string()
    .regex(/^\d{10}$/, 'Please enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  // Step 3: Password
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!"#$%&()*,.:<>?@^{|}])/, 
      'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

const INITIAL_FORM_DATA: SignupFormData = {
  organizationName: '',
  stateCode: '',
  organizationPhone: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const totalSteps = 3;

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: INITIAL_FORM_DATA,
    mode: 'onChange',
  });

  const password = watch('password', '');

  const validateStep = async (currentStep: number): Promise<boolean> => {
    const fieldsToValidate: Array<keyof SignupFormData> = [];
    
    if (currentStep === 1) {
      fieldsToValidate.push('organizationName', 'stateCode', 'organizationPhone');
    } else if (currentStep === 2) {
      fieldsToValidate.push('firstName', 'lastName', 'email', 'phone');
    } else if (currentStep === 3) {
      fieldsToValidate.push('password', 'confirmPassword');
    }

    return await trigger(fieldsToValidate);
  };

  const handleNext = async () => {
    const isValid = await validateStep(step);
    if (isValid) {
      setStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const onFormSubmit = async (data: SignupFormData) => {
    setIsLoading(true);

    try {
      // Format phone numbers (remove non-digits)
      const cleanOrgPhone = data.organizationPhone.replace(/\D/g, '');
      const cleanAdminPhone = data.phone.replace(/\D/g, '');

      // Call the correct signup API endpoint
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationName: data.organizationName.trim(),
          organizationEmail: data.email, // Use admin email as org email
          organizationPhone: cleanOrgPhone || undefined,
          stateCode: data.stateCode,
          adminFirstName: data.firstName.trim(),
          adminLastName: data.lastName.trim(),
          adminEmail: data.email,
          adminPassword: data.password,
          adminPhone: cleanAdminPhone || undefined,
          planName: 'STARTER', // Default to starter plan (14-day trial)
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message ?? responseData.error ?? 'Signup failed');
      }

      const { data: signupData } = responseData;

      // Auto-login after successful signup
      if (signupData.user && signupData.tokens?.accessToken) {
        login(signupData.user, signupData.tokens.accessToken);
      }

      toast.success(
        `Welcome to MHC Portal! Check your email (${data.email}) to verify your account.`,
        { duration: 6000 }
      );

      // Navigate to onboarding wizard or dashboard
      navigate('/onboarding');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return digits;
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-8">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
              s < step
                ? 'bg-green-600 text-white'
                : s === step
                ? 'bg-green-600 text-white ring-4 ring-green-200'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              s
            )}
          </div>
          {s < 3 && (
            <div
              className={`w-12 h-1 ${s < step ? 'bg-green-600' : 'bg-gray-200'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Organization Details</h2>
      <p className="text-sm text-gray-600 mb-6">Tell us about your home health agency</p>

      <FormField label="Organization Name" error={errors.organizationName?.message} required>
        <Input
          {...register('organizationName')}
          placeholder="e.g., Sunshine Home Health"
          className={errors.organizationName ? 'border-red-300' : ''}
        />
      </FormField>

      <FormField label="State" error={errors.stateCode?.message} required>
        <Select
          {...register('stateCode')}
          options={[
            { value: '', label: 'Select your state' },
            ...US_STATES.map((state) => ({ value: state.code, label: state.name })),
          ]}
          className={errors.stateCode ? 'border-red-300' : ''}
        />
        <p className="mt-1 text-xs text-gray-500">
          Your state determines regulatory requirements and EVV settings
        </p>
      </FormField>

      <FormField label="Organization Phone" error={errors.organizationPhone?.message}>
        <Input
          {...register('organizationPhone', {
            onChange: (e) => {
              e.target.value = formatPhoneNumber(e.target.value);
            },
          })}
          type="tel"
          placeholder="(555) 555-5555"
          className={errors.organizationPhone ? 'border-red-300' : ''}
        />
      </FormField>
    </>
  );

  const renderStep2 = () => (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Administrator Account</h2>
      <p className="text-sm text-gray-600 mb-6">Create your admin login credentials</p>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="First Name" error={errors.firstName?.message} required>
          <Input
            {...register('firstName')}
            placeholder="John"
            className={errors.firstName ? 'border-red-300' : ''}
          />
        </FormField>

        <FormField label="Last Name" error={errors.lastName?.message} required>
          <Input
            {...register('lastName')}
            placeholder="Smith"
            className={errors.lastName ? 'border-red-300' : ''}
          />
        </FormField>
      </div>

      <FormField label="Email Address" error={errors.email?.message} required>
        <Input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={errors.email ? 'border-red-300' : ''}
        />
      </FormField>

      <FormField label="Phone Number" error={errors.phone?.message}>
        <Input
          {...register('phone', {
            onChange: (e) => {
              e.target.value = formatPhoneNumber(e.target.value);
            },
          })}
          type="tel"
          placeholder="(555) 555-5555"
          className={errors.phone ? 'border-red-300' : ''}
        />
      </FormField>
    </>
  );

  const renderStep3 = () => (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Set Your Password</h2>
      <p className="text-sm text-gray-600 mb-6">Create a secure password for your account</p>

      <FormField label="Password" error={errors.password?.message} required>
        <Input
          {...register('password')}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={errors.password ? 'border-red-300' : ''}
        />
        <div className="mt-2 space-y-1">
          <p className={`text-xs ${password.length >= 8 ? 'text-green-600' : 'text-gray-500'}`}>
            {password.length >= 8 ? '✓' : '○'} At least 8 characters
          </p>
          <p className={`text-xs ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
            {/[A-Z]/.test(password) ? '✓' : '○'} Contains uppercase letter
          </p>
          <p className={`text-xs ${/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
            {/[a-z]/.test(password) ? '✓' : '○'} Contains lowercase letter
          </p>
          <p className={`text-xs ${/\d/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
            {/\d/.test(password) ? '✓' : '○'} Contains a number
          </p>
          <p className={`text-xs ${/[!"#$%&()*,.:<>?@^{|}]/.test(password) ? 'text-green-600' : 'text-gray-500'}`}>
            {/[!"#$%&()*,.:<>?@^{|}]/.test(password) ? '✓' : '○'} Contains special character (!@#$%...)
          </p>
        </div>
      </FormField>

      <FormField label="Confirm Password" error={errors.confirmPassword?.message} required>
        <Input
          {...register('confirmPassword')}
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          className={errors.confirmPassword ? 'border-red-300' : ''}
        />
      </FormField>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-green-800">14-Day Free Trial</h3>
            <p className="text-sm text-green-700 mt-1">
              Start with our Starter plan. No credit card required.
              Full access to all features during your trial.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 text-sm font-semibold text-green-700 bg-green-100 rounded-full border-2 border-green-300">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                clipRule="evenodd"
              />
            </svg>
            CREATE ACCOUNT
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Start Your Agency</h1>
          <p className="text-gray-600">Set up MHC Portal in under 5 minutes</p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Form Card */}
        <div className="bg-white shadow-2xl rounded-2xl p-8">
          <form 
            onSubmit={step === totalSteps ? handleSubmit(onFormSubmit) : (e) => { 
              e.preventDefault(); 
              void handleNext(); 
            }}
            className="space-y-4"
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-base font-semibold rounded-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all shadow-lg hover:shadow-xl ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating Account...
                  </>
                ) : step === totalSteps ? (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                    Create Account
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-semibold text-green-600 hover:text-green-700 underline"
              >
                Sign in
              </button>
            </p>
            <p className="text-center text-xs text-gray-500 mt-4">
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>

        {/* Try Demo Link */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ← Back to Demo
          </button>
        </div>
      </div>
    </div>
  );
};
