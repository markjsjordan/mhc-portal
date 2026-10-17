import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

/**
 * Checkbox Component
 * Stub implementation for checkboxes
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onChange, onCheckedChange, disabled = false, label, id, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const isChecked = e.target.checked;
      if (onChange) onChange(isChecked);
      if (onCheckedChange) onCheckedChange(isChecked);
    };

    return (
      <label htmlFor={id} className="checkbox-wrapper">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          {...props}
        />
        {label && <span className="checkbox-label">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
