import React from 'react';
import { NativeSelect } from '@/components/ui/select.js';
import { Label } from '@/components/ui/label.js';
import { cn } from '@/lib/utils.js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { error, label, helperText, options, placeholder, className, id, required, ...props },
    ref
  ) => {
    const selectId = id || `select-${label?.toLowerCase().replace(/\s/g, '-')}`;

    return (
      <div className="w-full space-y-1">
        {label && (
          <Label htmlFor={selectId} className="block text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <NativeSelect
          ref={ref}
          id={selectId}
          error={!!error}
          required={required}
          className={cn(className)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </NativeSelect>
        {error && (
          <p className="text-sm text-destructive" id={`${selectId}-error`}>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
