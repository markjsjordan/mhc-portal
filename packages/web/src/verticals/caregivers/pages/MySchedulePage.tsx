import React, { useState } from 'react';
import { Lock, Save, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { AppShell } from '@/app/components/AppShell.js';
import { Button } from '@/components/ui/button.js';
import {
  WeekPicker,
  DayAvailabilityEditor,
  ConflictBanner,
} from '../components/index.js';
import {
  useMyAvailability,
  type BookedVisitConflict,
} from '../services/caregiver-availability-api.js';
import type { WeeklyAvailability, DayAvailability } from '../types/index.js';
import { getMondayOfCurrentWeek, formatCutoffTime } from '../utils/schedule-helpers.js';

const DAYS: Array<{ key: keyof WeeklyAvailability; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const EMPTY_SCHEDULE: WeeklyAvailability = {
  monday: { available: true },
  tuesday: { available: true },
  wednesday: { available: true },
  thursday: { available: true },
  friday: { available: true },
  saturday: { available: false },
  sunday: { available: false },
};

function getNoticeClassName(type: 'success' | 'info' | 'error'): string {
  if (type === 'success') {
    return 'bg-green-50 border-green-200 text-green-800';
  }
  if (type === 'info') {
    return 'bg-amber-50 border-amber-200 text-amber-800';
  }
  return 'bg-red-50 border-red-200 text-red-800';
}

export const MySchedulePage: React.FC = () => {
  const [weekStart, setWeekStart] = useState<string>(getMondayOfCurrentWeek);
  const {
    data: availability,
    isLoading,
    error: loadError,
    refetch,
    saveAvailability,
    isSaving,
  } = useMyAvailability(weekStart);

  // Derive initial values from server response, or maintain local user modifications
  const [userEdits, setUserEdits] = useState<{ weekStart: string; schedule: WeeklyAvailability } | null>(null);
  const [conflicts, setConflicts] = useState<BookedVisitConflict[]>([]);
  const [lockedCutoffWeek, setLockedCutoffWeek] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const localSchedule = (userEdits?.weekStart === weekStart)
    ? userEdits.schedule
    : (availability?.schedule ?? EMPTY_SCHEDULE);

  const isLockedByCutoff = availability ? !availability.editable || lockedCutoffWeek === weekStart : false;
  const isEditable = Boolean(availability?.editable) && !isLockedByCutoff;

  const handleDayChange = (dayKey: keyof WeeklyAvailability, updated: DayAvailability) => {
    setUserEdits((prev) => {
      const currentSched = (prev?.weekStart === weekStart) ? prev.schedule : (availability?.schedule ?? EMPTY_SCHEDULE);
      return {
        weekStart,
        schedule: {
          ...currentSched,
          [dayKey]: updated,
        },
      };
    });
  };

  const hasSlotErrors = DAYS.some(({ key }) => {
    const day = localSchedule[key];
    if (!day.available || !day.timeSlots) return false;
    return day.timeSlots.some((s) => Boolean(s.startTime && s.endTime && s.startTime >= s.endTime));
  });

  const handleSave = async () => {
    if (!availability || !isEditable) return;
    setStatusNotice(null);

    try {
      await saveAvailability({
        weekStart,
        schedule: localSchedule,
        expectedVersion: availability.version,
      });
      setConflicts([]);
      setUserEdits(null);
      setStatusNotice({ type: 'success', message: 'Availability schedule saved successfully.' });
    } catch (err: unknown) {
      const errorObj = err as {
        code?: string;
        message?: string;
        response?: { data?: { code?: string; message?: string; conflicts?: BookedVisitConflict[] } };
        status?: number;
      };

      const apiData = errorObj.response?.data;
      const code = apiData?.code ?? errorObj.code;

      if (code === 'AVAILABILITY_CONFLICT_BOOKED_VISITS') {
        const returnedConflicts = apiData?.conflicts ?? [];
        setConflicts(returnedConflicts);
        setStatusNotice({
          type: 'error',
          message: 'Your availability changes conflict with booked visits.',
        });
      } else if (code === 'AVAILABILITY_EDIT_CUTOFF_PASSED') {
        setLockedCutoffWeek(weekStart);
        setStatusNotice({
          type: 'error',
          message: 'The deadline for editing this week’s availability has passed.',
        });
      } else if (code === 'VERSION_MISMATCH' || errorObj.status === 409) {
        setUserEdits(null);
        setStatusNotice({
          type: 'info',
          message: 'Your edits were not saved because the schedule was updated elsewhere. The schedule has been refreshed.',
        });
        void refetch();
      } else {
        setStatusNotice({
          type: 'error',
          message: apiData?.message ?? errorObj.message ?? 'Failed to save availability.',
        });
      }
    }
  };

  const handleWeekChange = (newWeek: string) => {
    setWeekStart(newWeek);
    setUserEdits(null);
    setConflicts([]);
    setStatusNotice(null);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6 py-6 px-4 sm:px-6">
        {/* Header & required disclosures */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
              <p className="text-sm font-semibold text-primary-700 mt-1">
                Availability — not a confirmed shift
              </p>
            </div>
            <WeekPicker
              currentWeekStart={weekStart}
              onWeekChange={handleWeekChange}
              disabled={isLoading || isSaving}
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p>
              Worked time is recorded only through check-in/check-out and is not set here. This schedule reflects your general availability to be assigned to shifts.
            </p>
          </div>
        </div>

        {/* Status / feedback notice */}
        {statusNotice && (
          <div
            className={`p-3 rounded-md text-sm border flex items-center justify-between ${getNoticeClassName(statusNotice.type)}`}
            role="status"
          >
            <span>{statusNotice.message}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusNotice(null)}
              className="h-auto p-1 text-xs"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Cutoff locked state */}
        {isLockedByCutoff && (
          <div
            className="p-4 rounded-md border border-gray-300 bg-gray-50 text-gray-800 flex items-start gap-3"
            data-testid="schedule-locked-banner"
          >
            <Lock className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">Schedule Locked</p>
              <p className="text-xs text-gray-600">
                The availability cutoff for this week was{' '}
                <span className="font-medium">
                  {formatCutoffTime(availability?.cutoffAt ?? '')}
                </span>
                . Changes can no longer be made. Contact your coordinator for emergency changes.
              </p>
            </div>
          </div>
        )}

        {/* Conflicts banner */}
        <ConflictBanner conflicts={conflicts} />

        {/* Error loading */}
        {loadError && (
          <div className="p-4 rounded-md border border-red-300 bg-red-50 text-red-900 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span>Failed to load availability schedule.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void refetch(); }}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Day editors grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Days of the Week</h2>
            <div className="text-xs text-gray-500">
              Version: {availability?.version ?? 1} • Source:{' '}
              {availability?.source === 'OVERRIDE' ? 'Custom override' : 'Default template'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DAYS.map(({ key, label }) => (
              <DayAvailabilityEditor
                key={key}
                dayName={key}
                dayLabel={label}
                availability={localSchedule[key]}
                disabled={!isEditable || isLoading || isSaving}
                onChange={(updated) => handleDayChange(key, updated)}
              />
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={() => {
              setUserEdits(null);
              setConflicts([]);
              void refetch();
            }}
            disabled={isLoading || isSaving}
            className="text-sm"
          >
            Reset
          </Button>
          <Button
            onClick={() => { void handleSave(); }}
            disabled={!isEditable || hasSlotErrors || isLoading || isSaving}
            className="gap-2 text-sm"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save Availability'}</span>
          </Button>
        </div>
      </div>
    </AppShell>
  );
};
export default MySchedulePage;
