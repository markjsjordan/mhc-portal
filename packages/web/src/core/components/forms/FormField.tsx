import React, { useId } from 'react';
import { Label } from '@/components/ui/label.js';
import { cn } from '@/lib/utils.js';

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
      <Label htmlFor={controlId} className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {control}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && <p className="text-sm text-muted-foreground">{helperText}</p>}
    </div>
  );
};
