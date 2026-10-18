import React from 'react';
import { VISIT_TYPES } from '../config/visitTypeConfig';
import type { VisitType } from '../types';

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
    <fieldset disabled={disabled}>
      <legend className="block text-sm font-semibold text-gray-900 mb-4">
        Visit Type <span className="text-red-600">*</span>
      </legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(VISIT_TYPES).map(([typeKey, config]) => {
          const type = typeKey as VisitType;
          const Icon = config.icon;
          const isSelected = value === type;

          return (
            <label
              key={type}
              className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="visit_type"
                value={type}
                checked={isSelected}
                onChange={() => onChange(type)}
                className="sr-only"
              />

              <div className="flex items-start gap-3 w-full">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.colorClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{config.label}</p>
                  {showDescription && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {config.description}
                    </p>
                  )}
                  {config.requiredCertifications.length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      Requires: {config.requiredCertifications.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Radio button indicator */}
              <div
                className={`absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default VisitTypeSelector;
