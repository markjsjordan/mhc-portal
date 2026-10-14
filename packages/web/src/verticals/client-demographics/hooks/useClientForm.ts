import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { US_STATES } from '@/core/constants/us-states';

/**
 * Address validation schema with state code validation
 */
export const ClientAddressSchema = z.object({
  line1: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .max(255, 'Address must be at most 255 characters'),
  line2: z
    .string()
    .max(255, 'Address line 2 must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .min(2, 'City name must be at least 2 characters')
    .max(100, 'City name must be at most 100 characters'),
  state: z
    .string()
    .length(2, 'State code must be 2 characters')
    .refine(
      code => US_STATES.some(s => s.code === code),
      {
        message: 'Please select a valid US state or territory',
      }
    ),
  postalCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be in format 12345 or 12345-6789'),
});

/**
 * Client intake form schema
 */
export const ClientIntakeSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be at most 100 characters'),
  dateOfBirth: z
    .string()
    .refine(
      date => {
        const dob = new Date(date);
        if (isNaN(dob.getTime())) return false;
        const age = new Date().getFullYear() - dob.getFullYear();
        return age >= 18 && age <= 120;
      },
      'Client must be between 18 and 120 years old'
    ),
  address: ClientAddressSchema,
});

export type ClientIntakeFormData = z.infer<typeof ClientIntakeSchema>;

/**
 * Hook for client intake form with validation
 */
export function useClientForm(initialData?: Partial<ClientIntakeFormData>) {
  return useForm<ClientIntakeFormData>({
    resolver: zodResolver(ClientIntakeSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
      },
      ...initialData,
    },
  });
}

/**
 * Type guard for state code validation
 */
export function isValidStateCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    US_STATES.some(s => s.code === value)
  );
}
