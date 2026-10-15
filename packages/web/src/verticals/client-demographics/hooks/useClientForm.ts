import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { US_STATES } from '@/core/constants/us-states';

/**
 * Address validation schema - all fields optional for new client intake
 */
export const ClientAddressSchema = z.object({
  line1: z
    .string()
    .max(255, 'Address must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  line2: z
    .string()
    .max(255, 'Address line 2 must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .max(100, 'City name must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  state: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      code => code === '' || US_STATES.some(s => s.code === code),
      {
        message: 'Please select a valid US state or territory',
      }
    ),
  postalCode: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      code => code === '' || /^\d{5}(-\d{4})?$/.test(code),
      { message: 'ZIP code must be in format 12345 or 12345-6789' }
    ),
});

/**
 * Client intake form schema - all fields optional for flexible intake
 */
export const ClientIntakeSchema = z.object({
  firstName: z
    .string()
    .max(100, 'First name must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  lastName: z
    .string()
    .max(100, 'Last name must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      date => {
        if (!date) return true; // Allow empty values
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
