import React from 'react';
import {
  Checkbox as ShadcnCheckbox,
  type CheckboxProps as ShadcnCheckboxProps,
} from '@/components/ui/checkbox.js';

export interface CheckboxProps
  extends Omit<ShadcnCheckboxProps, 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof ShadcnCheckbox>,
  CheckboxProps
>(({ onCheckedChange, ...props }, ref) => {
  return (
    <ShadcnCheckbox
      ref={ref}
      onCheckedChange={(checked) => {
        if (onCheckedChange) {
          onCheckedChange(checked === true);
        }
      }}
      {...props}
    />
  );
});

Checkbox.displayName = 'Checkbox';
