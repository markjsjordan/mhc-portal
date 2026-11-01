import React from 'react';
import { VISIT_TYPES } from '../config/visitTypeConfig.js';
import type { VisitType } from '../types/index.js';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.js';
import { Label } from '@/components/ui/label.js';

interface VisitTypeSelectorProps {
  value: VisitType | null;
  onChange: (type: VisitType) => void;
  disabled?: boolean;
  showDescription?: boolean;
  required?: boolean;
}

/**
 * VisitTypeSelector - Radio button group for selecting visit type
 *
 * Displays all visit types with icons, descriptions, and required certifications
 * in a grid layout suitable for modal dialogs.
 */
export const VisitTypeSelector: React.FC<VisitTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showDescription = true,
}) => {
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="block text-sm font-semibold text-foreground mb-4">
        Visit Type <span className="text-destructive">*</span>
      </legend>

      <RadioGroup
        name="visit_type"
        value={value ?? ''}
        onValueChange={(val) => {
          if (val) onChange(val as VisitType);
        }}
        disabled={disabled}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {Object.entries(VISIT_TYPES).map(([typeKey, config]) => {
          const type = typeKey as VisitType;
          const Icon = config.icon;
          const isSelected = value === type;

          return (
            <Label
              key={type}
              htmlFor={`visit-type-${type}`}
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-start gap-3 w-full pr-6">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.colorClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{config.label}</p>
                  {showDescription && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {config.description}
                    </p>
                  )}
                  {config.requiredCertifications.length > 0 && (
                    <p className="text-xs text-primary mt-2">
                      Requires: {config.requiredCertifications.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <RadioGroupItem
                value={type}
                id={`visit-type-${type}`}
                name="visit_type"
                className="absolute top-4 right-4"
              />
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
};

export default VisitTypeSelector;
