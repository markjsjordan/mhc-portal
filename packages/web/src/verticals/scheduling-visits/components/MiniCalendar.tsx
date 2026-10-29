import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import moment from 'moment';
import { Button } from '@/components/ui/button.js';

export interface MiniCalendarProps {
  currentDate: Date;
  daysWithVisits: Set<string>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  currentDate,
  daysWithVisits,
  onDateSelect,
  onMonthChange,
}) => {
  const currentMoment = moment(currentDate);

  const calendarDays = useMemo(() => {
    const startOfMonth = currentMoment.clone().startOf('month');
    const endOfMonth = currentMoment.clone().endOf('month');
    const startDate = startOfMonth.clone().startOf('week');
    const endDate = endOfMonth.clone().endOf('week');

    const days: Array<{
      date: moment.Moment;
      isCurrentMonth: boolean;
      hasVisits: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];
    const current = startDate.clone();

    while (current.isSameOrBefore(endDate)) {
      const dateKey = current.format('YYYY-MM-DD');
      days.push({
        date: current.clone(),
        isCurrentMonth: current.month() === currentMoment.month(),
        hasVisits: daysWithVisits.has(dateKey),
        isToday: current.isSame(moment(), 'day'),
        isSelected: current.isSame(currentMoment, 'day'),
      });
      current.add(1, 'day');
    }

    return days;
  }, [currentMoment, daysWithVisits]);

  const handlePrevMonth = () => {
    const prev = currentMoment.clone().subtract(1, 'month');
    onMonthChange(prev.toDate());
  };

  const handleNextMonth = () => {
    const next = currentMoment.clone().add(1, 'month');
    onMonthChange(next.toDate());
  };

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="bg-card text-card-foreground border rounded-lg p-4 shadow-sm">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handlePrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground">
          {currentMoment.format('MMMM YYYY')}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-xs font-medium text-muted-foreground text-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          let variant: 'ghost' | 'default' | 'secondary' = 'ghost';
          if (day.isCurrentMonth) {
            if (day.isSelected) {
              variant = 'default';
            } else if (day.isToday) {
              variant = 'secondary';
            }
          }

          return (
            <div key={index} className="relative flex items-center justify-center">
              <Button
                type="button"
                variant={variant}
                size="icon"
                className={`rounded-full text-xs font-normal ${
                  !day.isCurrentMonth ? 'text-muted-foreground/40' : ''
                } ${day.isSelected || day.isToday ? 'font-semibold' : ''}`}
                onClick={() => onDateSelect(day.date.toDate())}
                disabled={!day.isCurrentMonth}
              >
                {day.date.format('D')}
              </Button>
              {day.hasVisits && day.isCurrentMonth && (
                <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-1 bg-primary rounded-full" />
          <span>Has scheduled visits</span>
        </div>
      </div>
    </div>
  );
};
