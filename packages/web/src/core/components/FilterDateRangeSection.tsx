import React from 'react';
import { Calendar } from 'lucide-react';

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
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[11px] text-gray-500 block mb-1">From</span>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={formatDateValue(fromValue)}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <span className="text-[11px] text-gray-500 block mb-1">To</span>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={formatDateValue(toValue)}
              onChange={(e) => onToChange(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
