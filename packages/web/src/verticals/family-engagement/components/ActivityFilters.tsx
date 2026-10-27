/**
 * Activity Filters Component
 *
 * Filter activity feed by date range and type
 */

import React from 'react';
import type { ActivityType } from '@folkcare/family-engagement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';

interface ActivityFiltersProps {
  selectedTypes: ActivityType[];
  onTypeChange: (types: ActivityType[]) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

const activityTypes: { value: ActivityType; label: string }[] = [
  { value: 'VISIT_COMPLETED', label: 'Visits' },
  { value: 'TASK_COMPLETED', label: 'Tasks' },
  { value: 'CARE_PLAN_UPDATED', label: 'Care Plans' },
  { value: 'GOAL_ACHIEVED', label: 'Goals' },
  { value: 'NOTE_ADDED', label: 'Notes' },
  { value: 'MESSAGE_RECEIVED', label: 'Messages' },
];

export const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  selectedTypes,
  onTypeChange,
  dateRange,
  onDateRangeChange,
}) => {
  const handleTypeToggle = (type: ActivityType) => {
    if (selectedTypes.includes(type)) {
      onTypeChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypeChange([...selectedTypes, type]);
    }
  };

  const handlePresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onDateRangeChange({
      start: start.toISOString().split('T')[0]!,
      end: end.toISOString().split('T')[0]!,
    });
  };

  return (
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-sm font-semibold text-gray-900">Filter Activities</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {/* Date Range Presets */}
        <div className="mb-4">
          <Label className="block text-xs font-medium text-gray-700 mb-2">Time Period</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handlePresetRange(7)}
              className="bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handlePresetRange(30)}
              className="bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Last 30 days
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handlePresetRange(90)}
              className="bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Last 90 days
            </Button>
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <Label className="block text-xs font-medium text-gray-700 mb-1">From</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="h-9 px-3 py-1 text-sm"
            />
          </div>
          <div>
            <Label className="block text-xs font-medium text-gray-700 mb-1">To</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="h-9 px-3 py-1 text-sm"
            />
          </div>
        </div>

        {/* Activity Types */}
        <div>
          <Label className="block text-xs font-medium text-gray-700 mb-2">Activity Types</Label>
          <div className="space-y-2">
            {activityTypes.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`activity-type-${type.value}`}
                  checked={selectedTypes.includes(type.value)}
                  onCheckedChange={() => handleTypeToggle(type.value)}
                />
                <Label
                  htmlFor={`activity-type-${type.value}`}
                  className="text-sm font-normal text-gray-700 cursor-pointer"
                >
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Clear All */}
        {selectedTypes.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onTypeChange([])}
            className="mt-4 w-full"
          >
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
