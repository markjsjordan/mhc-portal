/**
 * Form Validation Hook for Web
 *
 * Provides a standardized way to use form validation with React Hook Form and Zod
 */

import {
  useForm,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

/**
 * Hook for form validation using Zod schemas
 *
 * @param schema - Zod schema to validate against
 * @param options - Additional React Hook Form options
 * @returns React Hook Form methods
 *
 * @example
 * ```tsx
 * import { useFormValidation } from '@/hooks/useFormValidation';
 * import { clientSchema } from '@folkcare/core/validation';
 *
 * const ClientForm = () => {
 *   const { register, handleSubmit, formState: { errors } } = useFormValidation(clientSchema);
 *
 *   const onSubmit = (data) => {
 *     console.log('Valid data:', data);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       <Input
 *         {...register('first_name')}
 *         label="First Name"
 *         error={errors.first_name?.message}
 *       />
 *     </form>
 *   );
 * };
 * ```
 */
export const useFormValidation = <
  TOutput extends FieldValues = FieldValues,
  TSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>
>(
  schema: TSchema,
  options?: Omit<UseFormProps<TOutput>, 'resolver'>
): UseFormReturn<TOutput> => {
  return useForm<TOutput>({
    resolver: zodResolver(schema as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<TOutput>,
    mode: 'onBlur', // Validate on blur
    reValidateMode: 'onChange', // Re-validate on change after first submit
    ...options,
  });
};
