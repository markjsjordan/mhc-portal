import React from 'react';
import { CheckCircle } from 'lucide-react';

export interface TaskProgressProps {
  completed: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}

const getProgressColor = (isComplete: boolean, percentage: number): string => {
  if (isComplete) return 'bg-green-500';
  if (percentage >= 75) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const TaskProgress: React.FC<TaskProgressProps> = ({
  completed,
  total,
  className = '',
  showLabel = true
}) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total && total > 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-700 font-medium">Task Progress</span>
          <span className="text-gray-600">
            {completed} of {total} tasks
          </span>
        </div>
      )}

      <div className="relative">
        <div className="overflow-hidden h-3 text-xs flex rounded-full bg-gray-200">
          <div
            style={{ width: `${percentage}%` }}
            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${getProgressColor(isComplete, percentage)}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{percentage}% Complete</span>
        {isComplete && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            All tasks complete
          </span>
        )}
      </div>
    </div>
  );
};
