import React from 'react';
import { Check } from 'lucide-react';

export interface FilterCheckboxOption {
  value: string;
  label: string;
  isChecked: boolean;
}

export interface FilterCheckboxSectionProps {
  label: string;
  options: FilterCheckboxOption[];
  onToggle: (value: string) => void;
}

export const FilterCheckboxSection: React.FC<FilterCheckboxSectionProps> = ({
  label,
  options,
  onToggle,
}) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left border transition-all ${
              option.isChecked
                ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                option.isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
              }`}
            >
              {option.isChecked && <Check className="w-2.5 h-2.5" />}
            </div>
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
