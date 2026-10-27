import React, { useId } from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';

export interface FilterDateRangeSectionProps {
  label: string;
  fromValue?: string;
  toValue?: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const formatDateValue = (val?: Date | string) => {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0]!;
  }
  return String(val).split('T')[0]!;
};

export const FilterDateRangeSection: React.FC<FilterDateRangeSectionProps> = ({
  label,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}) => {
  const fromId = useId();
  const toId = useId();

  return (
    <div>
      <Label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={fromId} className="text-[11px] text-muted-foreground block mb-1">
            From
          </Label>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <Input
              id={fromId}
              type="date"
              value={formatDateValue(fromValue)}
              onChange={(e) => onFromChange(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>
        <div>
          <Label htmlFor={toId} className="text-[11px] text-muted-foreground block mb-1">
            To
          </Label>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <Input
              id={toId}
              type="date"
              value={formatDateValue(toValue)}
              onChange={(e) => onToChange(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
