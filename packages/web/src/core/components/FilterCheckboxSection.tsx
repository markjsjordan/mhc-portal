import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import { cn } from '@/lib/utils.js';

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
      <Label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={option.isChecked ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => onToggle(option.value)}
            className="flex items-center justify-start gap-2 h-auto px-2.5 py-1.5 text-xs font-medium text-left"
          >
            <div
              className={cn(
                'w-3.5 h-3.5 rounded flex items-center justify-center border',
                option.isChecked
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-muted-foreground/30'
              )}
            >
              {option.isChecked && <Check className="w-2.5 h-2.5" />}
            </div>
            <span className="truncate">{option.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};
