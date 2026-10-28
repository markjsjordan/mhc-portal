import React, { useMemo } from 'react';
import { US_STATES, getStateName, type USStateCode } from '@/core/constants/us-states';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { cn } from '@/core/utils/classnames';

export interface StateSelectorProps {
  value?: string;
  onChange?: (stateCode: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  helperText?: string;
  placeholder?: string;
  excludeTerritory?: boolean;
  className?: string;
  id?: string;
  testId?: string;
}

/**
 * StateSelector Component
 *
 * Provides accessible, keyboard-friendly state selection with:
 * - All 50 states + DC + 5 territories (56 total options)
 * - Optional territory exclusion for US-only selections
 * - Full keyboard navigation (arrows, home, end, type-ahead)
 * - WCAG 2.1 AA compliant
 * - Built on shadcn/ui Select for accessibility
 */
export const StateSelector = React.forwardRef<HTMLButtonElement, StateSelectorProps>(
  (
    {
      value,
      onChange,
      error,
      disabled = false,
      required = false,
      label = 'State',
      helperText,
      placeholder = 'Select a state',
      excludeTerritory = false,
      className,
      id = 'state-selector',
      testId,
    },
    ref
  ) => {
    // Filter states based on exclusion rule
    const filteredStates = useMemo<USStateCode[]>(() => {
      if (excludeTerritory) {
        const territories = ['AS', 'GU', 'MP', 'PR', 'VI'];
        return US_STATES.filter((state) => !territories.includes(state.code));
      }
      return US_STATES;
    }, [excludeTerritory]);

    const displayLabel = value && getStateName(value);

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <Label htmlFor={id} className={error ? 'text-destructive' : undefined}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <Select
            value={value || undefined}
            onValueChange={(val) => onChange?.(val)}
            disabled={disabled}
          >
            <SelectTrigger
              ref={ref}
              id={id}
              data-testid={testId}
              aria-label={label}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(error && 'border-destructive focus:ring-destructive')}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filteredStates.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {`${state.name} (${state.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {error && (
          <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {/* Display selected state info for accessibility */}
        {displayLabel && !error && (
          <p className="text-xs text-muted-foreground mt-1" data-testid={testId ? `${testId}-selected` : undefined}>
            Selected: {displayLabel}
          </p>
        )}
      </div>
    );
  }
);

StateSelector.displayName = 'StateSelector';
