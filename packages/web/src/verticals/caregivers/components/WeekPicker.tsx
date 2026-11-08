import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { formatWeekLabel, shiftWeek } from '../utils/week-utils.js';

export interface WeekPickerProps {
  currentWeekStart: string; // YYYY-MM-DD
  onWeekChange: (newWeekStart: string) => void;
  disabled?: boolean;
}

export const WeekPicker: React.FC<WeekPickerProps> = ({
  currentWeekStart,
  onWeekChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onWeekChange(shiftWeek(currentWeekStart, -1))}
        disabled={disabled}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-white text-sm font-medium text-gray-700 min-w-[200px] justify-center">
        <CalendarIcon className="h-4 w-4 text-gray-500" />
        <span>{formatWeekLabel(currentWeekStart)}</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onWeekChange(shiftWeek(currentWeekStart, 1))}
        disabled={disabled}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
