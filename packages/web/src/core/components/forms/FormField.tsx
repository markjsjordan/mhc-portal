import React, { useId } from 'react';
import { cn } from '../../utils/classnames';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  helperText,
  children,
  className,
}) => {
  const generatedId = useId();

  // Associate the label with its control so assistive tech (and getByLabelText)
  // resolve the field. Respect an id the child already set.
  const child = React.isValidElement<{ id?: string }>(children) ? children : null;
  const controlId = child?.props.id ?? generatedId;
  const control = child ? React.cloneElement(child, { id: controlId }) : children;

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {control}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
    </div>
  );
};
