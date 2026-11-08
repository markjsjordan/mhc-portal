import React from 'react';
import { Plus, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Input } from '@/components/ui/input.js';
import type { DayAvailability, TimeSlot } from '../types/index.js';

export interface DayAvailabilityEditorProps {
  dayName: string;
  dayLabel: string;
  availability: DayAvailability;
  disabled?: boolean;
  onChange: (updated: DayAvailability) => void;
}

export const DayAvailabilityEditor: React.FC<DayAvailabilityEditorProps> = ({
  dayName,
  dayLabel,
  availability,
  disabled = false,
  onChange,
}) => {
  const { available, timeSlots = [] } = availability;

  const handleToggleAvailable = (checked: boolean) => {
    onChange({
      ...availability,
      available: checked,
      // Default to 09:00 - 17:00 slot if turning on with empty slots
      timeSlots: checked && timeSlots.length === 0 ? [{ startTime: '09:00', endTime: '17:00' }] : timeSlots,
    });
  };

  const handleAddTimeSlot = () => {
    const lastSlot = timeSlots[timeSlots.length - 1];
    const newStart = lastSlot ? lastSlot.endTime : '09:00';
    const newEnd = lastSlot && lastSlot.endTime < '21:00' ? '21:00' : '17:00';
    onChange({
      ...availability,
      timeSlots: [...timeSlots, { startTime: newStart, endTime: newEnd }],
    });
  };

  const handleRemoveSlot = (index: number) => {
    const updated = timeSlots.filter((_, i) => i !== index);
    onChange({
      ...availability,
      timeSlots: updated,
    });
  };

  const handleSlotChange = (index: number, field: keyof TimeSlot, value: string) => {
    const updated = timeSlots.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot));
    onChange({
      ...availability,
      timeSlots: updated,
    });
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm space-y-3" data-testid={`day-editor-${dayName}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`toggle-${dayName}`}
            checked={available}
            disabled={disabled}
            onCheckedChange={(checked) => handleToggleAvailable(checked === true)}
            aria-label={`${dayLabel} available`}
          />
          <label htmlFor={`toggle-${dayName}`} className="text-sm font-semibold text-gray-900 cursor-pointer">
            {dayLabel}
          </label>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {available ? 'Available' : 'Unavailable'}
        </span>
      </div>

      {available && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          {timeSlots.length === 0 && (
            <p className="text-xs text-gray-500 italic">No specific time slots defined (all day available).</p>
          )}

          {timeSlots.map((slot, index) => {
            const hasSlotError = Boolean(slot.startTime && slot.endTime && slot.startTime >= slot.endTime);
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <Input
                    type="time"
                    value={slot.startTime}
                    disabled={disabled}
                    onChange={(e) => handleSlotChange(index, 'startTime', e.target.value)}
                    aria-label={`${dayLabel} slot ${index + 1} start time`}
                    className={`h-8 w-28 text-xs ${hasSlotError ? 'border-red-500 bg-red-50' : ''}`}
                  />
                  <span className="text-xs text-gray-500">to</span>
                  <Input
                    type="time"
                    value={slot.endTime}
                    disabled={disabled}
                    onChange={(e) => handleSlotChange(index, 'endTime', e.target.value)}
                    aria-label={`${dayLabel} slot ${index + 1} end time`}
                    className={`h-8 w-28 text-xs ${hasSlotError ? 'border-red-500 bg-red-50' : ''}`}
                  />
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSlot(index)}
                      className="text-gray-400 hover:text-red-600 p-1 h-auto"
                      aria-label={`Remove ${dayLabel} slot ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {hasSlotError && (
                  <div className="flex items-center gap-1 text-[11px] text-red-600 pl-6">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Start time must be earlier than end time</span>
                  </div>
                )}
              </div>
            );
          })}

          {!disabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTimeSlot}
              className="text-xs h-7 gap-1 mt-1"
            >
              <Plus className="h-3 w-3" />
              <span>Add slot</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
