/**
 * Reusable form field component
 * Consolidates common form field patterns with react-hook-form
 */

import { UseFormRegister, FieldErrors, FieldValues, Path } from 'react-hook-form';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.js';
import { NativeSelect } from '@/components/ui/select.js';

export interface FormFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'datetime-local' | 'number' | 'password' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  register: UseFormRegister<T>;
  errors?: FieldErrors<T>;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number; // For textarea
  helperText?: string;
  className?: string;
}

/**
 * Generic form field component that handles common input types
 * Integrates with react-hook-form for validation and error display
 */
export function FormField<T extends FieldValues>({
  name,
  label,
  type = 'text',
  options,
  register,
  errors,
  required,
  disabled,
  placeholder,
  rows = 4,
  helperText,
  className = '',
}: FormFieldProps<T>) {
  const error = errors?.[name];
  const errorMessage = error?.message as string | undefined;

  return (
    <div className={`mb-4 space-y-1 ${className}`}>
      <Label
        htmlFor={name}
        className="block text-sm font-medium"
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {type === 'select' ? (
        <NativeSelect
          id={name}
          disabled={disabled}
          error={!!error}
          aria-invalid={error ? 'true' : 'false'}
          {...register(name)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </NativeSelect>
      ) : type === 'textarea' ? (
        <Textarea
          id={name}
          {...register(name)}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
          aria-invalid={error ? 'true' : 'false'}
        />
      ) : (
        <Input
          id={name}
          type={type}
          {...register(name)}
          disabled={disabled}
          placeholder={placeholder}
          className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
          aria-invalid={error ? 'true' : 'false'}
        />
      )}

      {helperText && !error && (
        <p className="text-sm text-muted-foreground mt-1">{helperText}</p>
      )}

      {errorMessage && (
        <p className="text-sm text-destructive mt-1" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/**
 * Checkbox field component
 */
export interface CheckboxFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  register: UseFormRegister<T>;
  errors?: FieldErrors<T>;
  disabled?: boolean;
  helperText?: string;
  className?: string;
}

export function CheckboxField<T extends FieldValues>({
  name,
  label,
  register,
  errors,
  disabled,
  helperText,
  className = '',
}: CheckboxFieldProps<T>) {
  const error = errors?.[name];
  const errorMessage = error?.message as string | undefined;
  const { onChange, onBlur, ref } = register(name);

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={name}
          ref={ref}
          disabled={disabled}
          onCheckedChange={(checked) => {
            void onChange({ target: { name, value: checked } });
          }}
          onBlur={onBlur}
        />
        <Label htmlFor={name} className="text-sm font-normal cursor-pointer">
          {label}
        </Label>
      </div>

      {helperText && !error && (
        <p className="text-sm text-muted-foreground mt-1 ml-6">{helperText}</p>
      )}

      {errorMessage && (
        <p className="text-sm text-destructive mt-1 ml-6" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/**
 * Radio group field component
 */
export interface RadioFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  options: Array<{ value: string; label: string; description?: string }>;
  register: UseFormRegister<T>;
  errors?: FieldErrors<T>;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function RadioField<T extends FieldValues>({
  name,
  label,
  options,
  register,
  errors,
  required,
  disabled,
  className = '',
}: RadioFieldProps<T>) {
  const error = errors?.[name];
  const errorMessage = error?.message as string | undefined;
  const { onChange } = register(name);

  return (
    <div className={`mb-4 ${className}`}>
      <Label className="block text-sm font-medium mb-2">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <RadioGroup
        disabled={disabled}
        onValueChange={(val) => {
          void onChange({ target: { name, value: val } });
        }}
        className="space-y-2"
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-start gap-2">
            <RadioGroupItem
              value={option.value}
              id={`${name}-${option.value}`}
            />
            <Label
              htmlFor={`${name}-${option.value}`}
              className="text-sm font-normal cursor-pointer"
            >
              <span className="text-foreground">{option.label}</span>
              {option.description && (
                <span className="block text-muted-foreground text-xs mt-0.5">
                  {option.description}
                </span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {errorMessage && (
        <p className="text-sm text-destructive mt-1" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
