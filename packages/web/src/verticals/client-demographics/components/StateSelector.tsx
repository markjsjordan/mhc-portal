import React, { useState, useMemo, useCallback } from 'react';
import { US_STATES, getStateName, type USStateCode } from '@/core/constants/us-states';
import { Select, type SelectOption } from '@/core/components/forms/Select';
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
 * - Built on standard HTML <select> for accessibility
 *
 * @example
 * ```tsx
 * <StateSelector
 *   id="client-state"
 *   label="State"
 *   value={state}
 *   onChange={setState}
 *   required
 * />
 * ```
 */
export const StateSelector = React.forwardRef<HTMLSelectElement, StateSelectorProps>(
  (
    {
      value,
      onChange,
      onBlur,
      error,
      disabled = false,
      required = false,
      label = 'State',
      helperText,
      placeholder = 'Select a state',
      excludeTerritory = false,
      className,
      id,
      testId,
    },
    ref
  ) => {
    // Filter states based on exclusion rule
    const filteredStates = useMemo<USStateCode[]>(() => {
      if (excludeTerritory) {
        const territories = ['AS', 'GU', 'MP', 'PR', 'VI'];
        return US_STATES.filter(state => !territories.includes(state.code));
      }
      return US_STATES;
    }, [excludeTerritory]);

    // Convert to SelectOption format
    const options: SelectOption[] = useMemo(
      () =>
        filteredStates.map(state => ({
          value: state.code,
          label: `${state.name} (${state.code})`,
        })),
      [filteredStates]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange?.(e.target.value);
      },
      [onChange]
    );

    const displayLabel = value && getStateName(value);

    return (
      <div className={cn('space-y-1', className)}>
        <div className="relative">
          <Select
            ref={ref}
            id={id}
            value={value || ''}
            onChange={handleChange}
            onBlur={onBlur}
            disabled={disabled}
            error={error}
            label={label}
            helperText={helperText}
            placeholder={placeholder}
            options={options}
            required={required}
            data-testid={testId}
            aria-label={label}
            aria-describedby={error ? `${id}-error` : undefined}
            className="pr-8"
          />
        </div>

        {/* Display selected state info for accessibility */}
        {displayLabel && !error && (
          <p className="text-xs text-gray-500 mt-1" data-testid={testId ? `${testId}-selected` : undefined}>
            Selected: {displayLabel}
          </p>
        )}
      </div>
    );
  }
);

StateSelector.displayName = 'StateSelector';
