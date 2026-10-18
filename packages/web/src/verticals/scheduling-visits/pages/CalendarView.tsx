import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo, EventProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Plus,
  List,
  Home,
  Phone,
  Building2,
  ZoomIn,
  ZoomOut,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Info,
  X,
  User,
  AlertCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useCalendarVisits, useVisitApi, useCaregiverAvailability } from '../hooks/useVisits';
import { useCaregivers } from '@/verticals/caregivers/hooks/useCaregivers';
import { useAuth } from '@/core/hooks';
import { EmptyState } from '@/core/components/feedback/EmptyState';
import { CreateVisitModal } from '@/core/components/forms/CreateVisitModal';
import { MiniCalendar, VisitStatusLegend } from '../components';
import type { Visit } from '../types';
import type { Caregiver } from '@/verticals/caregivers/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// Density modes for week view
type DensityMode = 'comfortable' | 'compact' | 'ultra-compact';

// Time range presets
type TimeRange = 'full' | 'business' | 'extended';

const TIME_RANGES: Record<TimeRange, { min: number; max: number; label: string }> = {
  full: { min: 6, max: 22, label: '6 AM - 10 PM' },
  business: { min: 8, max: 18, label: '8 AM - 6 PM' },
  extended: { min: 5, max: 23, label: '5 AM - 11 PM' },
};

const DENSITY_CONFIG: Record<DensityMode, { step: number; timeslots: number; minEventHeight: number; label: string }> = {
  comfortable: { step: 30, timeslots: 2, minEventHeight: 50, label: 'Comfortable' },
  compact: { step: 15, timeslots: 4, minEventHeight: 35, label: 'Compact' },
  'ultra-compact': { step: 15, timeslots: 4, minEventHeight: 25, label: 'Ultra-Compact' },
};

// Color palette for caregivers (reusable across visits)
const CAREGIVER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Visit;
  color: string;
}

interface DayStripItem {
  key: string;
  date: moment.Moment;
  dayName: string;
  dayNum: string;
  isToday: boolean;
  isSelected: boolean;
  hasVisits: boolean;
}

// Custom Event Component with tooltip and icon
interface CustomEventProps extends EventProps<CalendarEvent> {
  densityMode: DensityMode;
}

const VisitTypeIconRenderer: React.FC<{ serviceTypeName: string; className?: string }> = ({ serviceTypeName, className }) => {
  const name = (serviceTypeName || '').toLowerCase();
  if (name.includes('home') || name.includes('personal')) return <Home className={className} />;
  if (name.includes('phone') || name.includes('call')) return <Phone className={className} />;
  if (name.includes('clinic') || name.includes('office')) return <Building2 className={className} />;
  return <Clock className={className} />;
};

// Helper function to normalize time format from backend (handles AM/PM and 24-hour formats)
const normalizeTimeFormat = (timeStr: string | undefined): string => {
  if (!timeStr) return '00:00';

  if (/^\d{1,2}:\d{2}$/.test(timeStr.trim())) {
    return timeStr.trim();
  }

  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]!, 10);
    const minutes = ampmMatch[2]!;
    const meridiem = ampmMatch[3]!.toUpperCase();

    if (meridiem === 'PM' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  return timeStr.trim();
};

const CustomEvent: React.FC<CustomEventProps> = ({ event, densityMode }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isUltraCompact = densityMode === 'ultra-compact';

  const clientName = event.resource.clientFirstName && event.resource.clientLastName
    ? `${event.resource.clientFirstName} ${event.resource.clientLastName}`
    : 'Unknown Client';

  const startTime = moment(event.start).format('h:mm A');
  const endTime = moment(event.end).format('h:mm A');
  const duration = moment(event.end).diff(moment(event.start), 'minutes');
  const durationText = duration >= 60
    ? `${Math.floor(duration / 60)}h ${duration % 60}m`
    : `${duration}m`;

  const isUnassigned = event.resource.status === 'UNASSIGNED' || !event.resource.assignedCaregiverId;

  return (
    <div
      className="relative h-full w-full select-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Event content */}
      <div className={`flex items-start gap-1 h-full overflow-hidden ${isUltraCompact ? 'px-1' : 'px-2 py-1'}`}>
        <VisitTypeIconRenderer
          serviceTypeName={event.resource.serviceTypeName}
          className={`flex-shrink-0 ${isUltraCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`}
        />
        {!isUltraCompact && (
          <div className="flex flex-col min-w-0 flex-1 leading-tight">
            <span className="truncate text-xs font-semibold">{event.title}</span>
            <span className="text-[10px] opacity-90 truncate">{startTime}–{endTime}</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-full top-0 ml-2 z-50 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 min-w-[200px] pointer-events-none">
          <div className="font-semibold mb-0.5">{clientName}</div>
          <div className="text-gray-300 text-[11px] mb-2">{event.resource.serviceTypeName}</div>
          <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
            <Clock className="h-3 w-3" />
            <span>{startTime} - {endTime} ({durationText})</span>
          </div>
          {event.resource.assignedCaregiverId && (
            <div className="mt-2 pt-2 border-t border-gray-700 text-gray-300 text-[11px]">
              Caregiver Assigned
            </div>
          )}
          {isUnassigned && (
            <div className="mt-2 pt-2 border-t border-gray-700 text-amber-400 font-medium text-[11px]">
              ⚠️ Needs Assignment
            </div>
          )}
          <div className="mt-1 text-[10px] text-gray-400 italic">
            Tap to view / reassign
          </div>
        </div>
      )}
    </div>
  );
};

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop<CalendarEvent>(Calendar);

export const CalendarView: React.FC = () => {
  const { user } = useAuth();
  const visitApi = useVisitApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Screen size detection for responsive mobile default
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // State: mobile defaults to 'day', tablet+ defaults to 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'day';
    }
    return 'week';
  });

  const [showAvailability, setShowAvailability] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Collapsible left rail
  const [showLegendPopover, setShowLegendPopover] = useState(false); // Single source of truth legend popover
  const [selectedBranches] = useState<string[]>([]);
  const [selectedCaregiverFilter, setSelectedCaregiverFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedCaregivers, setExpandedCaregivers] = useState<Set<string>>(new Set());

  // Modal states
  const [isCreateVisitModalOpen, setIsCreateVisitModalOpen] = useState(false);
  const [createVisitSlotInfo, setCreateVisitSlotInfo] = useState<SlotInfo | null>(null);

  // Quick Action / Reassignment Modal for tap-to-reassign
  const [selectedVisitForAction, setSelectedVisitForAction] = useState<Visit | null>(null);
  const [reassignCaregiverId, setReassignCaregiverId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

  const legendRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close legend popover on outside click
  useEffect(() => {
    if (!showLegendPopover) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) {
        setShowLegendPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLegendPopover]);

  const toggleExpandedCaregiver = useCallback((caregiverId: string) => {
    setExpandedCaregivers(prev => {
      const next = new Set(prev);
      if (next.has(caregiverId)) {
        next.delete(caregiverId);
      } else {
        next.add(caregiverId);
      }
      return next;
    });
  }, []);

  // Week view UX controls
  const [densityMode, setDensityMode] = useState<DensityMode>(() => {
    const saved = localStorage.getItem('calendar-density');
    return (saved as DensityMode) ?? 'comfortable';
  });

  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const saved = localStorage.getItem('calendar-time-range');
    return (saved as TimeRange) ?? 'full';
  });

  useEffect(() => {
    localStorage.setItem('calendar-density', densityMode);
  }, [densityMode]);

  useEffect(() => {
    localStorage.setItem('calendar-time-range', timeRange);
  }, [timeRange]);

  // Auto-scroll to current time on week/day view
  useEffect(() => {
    if ((view !== 'week' && view !== 'day') || !calendarRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const timeSlotHeight = densityMode === 'comfortable' ? 60 : 40;
      const { min } = TIME_RANGES[timeRange];
      const scrollTo = Math.max(0, (currentHour - min - 1) * timeSlotHeight);

      const scrollContainer = calendarRef.current?.querySelector('.rbc-time-content');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollTo;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [view, timeRange, densityMode]);

  // Calculate date range for calendar based on current view
  const { startDate, endDate } = useMemo(() => {
    const start = moment(currentDate).startOf(view === 'month' ? 'month' : 'week').toDate();
    const end = moment(currentDate).endOf(view === 'month' ? 'month' : 'week').toDate();
    return { startDate: start, endDate: end };
  }, [currentDate, view]);

  // Fetch visits for calendar
  const branchIds = selectedBranches.length > 0 ? selectedBranches : undefined;
  const {
    data: visits = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useCalendarVisits(startDate, endDate, branchIds);

  // Fetch all caregivers for filter and reassignment
  const { data: caregiversData } = useCaregivers({}, 1, 100);
  const caregiversList: Caregiver[] = useMemo(() => {
    return (caregiversData?.items ?? []) as Caregiver[];
  }, [caregiversData]);

  // Fetch caregiver availability (gracefully handle failures)
  const {
    data: caregiverAvailability = [],
    isLoading: isLoadingAvailability,
    error: availabilityError,
  } = useCaregiverAvailability(currentDate, branchIds);

  // Calculate days with visits for mini calendar and mobile date strip
  const daysWithVisits = useMemo(() => {
    const days = new Set<string>();
    for (const visit of visits) {
      const dateKey = moment(visit.scheduledDate).format('YYYY-MM-DD');
      days.add(dateKey);
    }
    return days;
  }, [visits]);

  // Calculate weekly visit count
  const weeklyVisitCount = useMemo(() => {
    const weekStart = moment(currentDate).startOf('week');
    const weekEnd = moment(currentDate).endOf('week');

    return visits.filter(visit => {
      const visitDate = moment(visit.scheduledDate);
      return visitDate.isSameOrAfter(weekStart) && visitDate.isSameOrBefore(weekEnd);
    }).length;
  }, [visits, currentDate]);

  // Compute key metrics across all visits for the KPI row
  const metrics = useMemo(() => {
    let unassigned = 0;
    let inProgress = 0;
    let completed = 0;
    let needsReview = 0;
    let cancelled = 0;

    for (const v of visits) {
      const statusStr = (v.status as string) || '';
      if (v.status === 'UNASSIGNED' || !v.assignedCaregiverId) {
        unassigned++;
      } else if (v.status === 'IN_PROGRESS') {
        inProgress++;
      } else if (v.status === 'COMPLETED') {
        completed++;
      } else if (statusStr === 'NEEDS_REVIEW' || v.requiresSupervision) {
        needsReview++;
      } else if (v.status === 'CANCELLED') {
        cancelled++;
      }
    }

    return {
      total: visits.length,
      weekly: weeklyVisitCount,
      unassigned,
      inProgress,
      completed,
      needsReview,
      cancelled,
    };
  }, [visits, weeklyVisitCount]);

  // Create a color map for caregivers
  const caregiverColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueCaregiverIds = new Set<string>();

    for (const visit of visits) {
      if (visit.assignedCaregiverId != null) {
        uniqueCaregiverIds.add(visit.assignedCaregiverId);
      }
    }

    for (const [index, caregiverId] of Array.from(uniqueCaregiverIds).entries()) {
      map.set(caregiverId, CAREGIVER_COLORS[index % CAREGIVER_COLORS.length]!);
    }

    return map;
  }, [visits]);

  // Filter visits based on active status chip or caregiver filter
  const displayedVisits = useMemo(() => {
    let result = visits;
    if (statusFilter) {
      if (statusFilter === 'UNASSIGNED') {
        result = result.filter(v => v.status === 'UNASSIGNED' || !v.assignedCaregiverId);
      } else if (statusFilter === 'NEEDS_REVIEW') {
        result = result.filter(v => (v.status as string) === 'NEEDS_REVIEW' || v.requiresSupervision);
      } else {
        result = result.filter(v => v.status === statusFilter);
      }
    }
    if (selectedCaregiverFilter) {
      result = result.filter(v => v.assignedCaregiverId === selectedCaregiverFilter);
    }
    return result;
  }, [visits, statusFilter, selectedCaregiverFilter]);

  // Convert visits to calendar events with consistent status color tokens
  const events: CalendarEvent[] = useMemo(() => {
    return displayedVisits.map(visit => {
      const scheduledDate = typeof visit.scheduledDate === 'string'
        ? new Date(visit.scheduledDate)
        : visit.scheduledDate;

      const normalizedStart = normalizeTimeFormat(visit.scheduledStartTime);
      const normalizedEnd = normalizeTimeFormat(visit.scheduledEndTime);
      const [startHour, startMinute] = normalizedStart.split(':').map(Number);
      const [endHour, endMinute] = normalizedEnd.split(':').map(Number);

      const start = new Date(scheduledDate);
      start.setHours(startHour ?? 0, startMinute ?? 0, 0, 0);

      const end = new Date(scheduledDate);
      end.setHours(endHour ?? 0, endMinute ?? 0, 0, 0);

      const statusStr = (visit.status as string) || '';

      // Consistent status color tokens:
      // Unassigned = amber dashed
      // Assigned = caregiver color
      // In Progress = cyan
      // Completed = green
      // Needs Review = purple
      // Cancelled = gray
      let color = '#3B82F6';
      if (visit.status === 'UNASSIGNED' || !visit.assignedCaregiverId) {
        color = '#F59E0B'; // amber
      } else if (visit.status === 'IN_PROGRESS') {
        color = '#06B6D4'; // cyan
      } else if (visit.status === 'COMPLETED') {
        color = '#10B981'; // green
      } else if (statusStr === 'NEEDS_REVIEW' || visit.requiresSupervision) {
        color = '#8B5CF6'; // purple
      } else if (visit.status === 'CANCELLED') {
        color = '#9CA3AF'; // gray
      } else if (visit.assignedCaregiverId != null) {
        color = caregiverColorMap.get(visit.assignedCaregiverId) ?? '#3B82F6';
      }

      const clientName = visit.clientFirstName != null && visit.clientLastName != null
        ? `${visit.clientFirstName} ${visit.clientLastName}`
        : 'Unknown Client';

      return {
        id: visit.id,
        title: `${clientName} - ${visit.serviceTypeName}`,
        start,
        end,
        resource: visit,
        color,
      };
    });
  }, [displayedVisits, caregiverColorMap]);

  // Check for conflicts when assigning caregiver
  const checkAndAssignCaregiver = useCallback(async (visitId: string, caregiverId: string) => {
    try {
      const conflictResult = await visitApi.checkConflicts(visitId, caregiverId);

      if (conflictResult.hasConflicts) {
        const conflictMessages = conflictResult.conflicts.map(c =>
          `${c.scheduled_start_time} - ${c.scheduled_end_time}: ${c.client_first_name} ${c.client_last_name}`
        ).join('\n');

        const proceed = window.confirm(
          `Scheduling conflicts detected:\n\n${conflictMessages}\n\nDo you want to assign anyway?`
        );

        if (!proceed) {
          return false;
        }
      }

      await visitApi.assignCaregiver(visitId, caregiverId, false);
      toast.success('Caregiver assigned successfully');
      await queryClient.invalidateQueries({ queryKey: ['visits'] });
      return true;
    } catch (error) {
      console.error('Error assigning caregiver:', error);
      toast.error('Failed to assign caregiver');
      return false;
    }
  }, [visitApi, queryClient]);

  // Shared helper for date/time schedule changes (drag-move and resize)
  const updateVisitSchedule = useCallback(async (_visitId: string, _start: Date, _end: Date) => {
    toast('Rescheduling a visit requires a backend endpoint that does not exist yet (no PATCH/PUT for date/time on /api/visits). Change not saved.', {
      duration: 4000,
      icon: '⚠️',
    });
    await refetch();
    return false;
  }, [refetch]);

  // Desktop Drag-and-drop handler
  const handleEventDrop = useCallback(async ({ event, start, end, resourceId }: { event: CalendarEvent; start: Date | string; end: Date | string; resourceId?: string | number }) => {
    try {
      const visit = event.resource;
      const newStart = start instanceof Date ? start : new Date(start);
      const newEnd = end instanceof Date ? end : new Date(end);

      if (resourceId != null && String(resourceId) !== visit.assignedCaregiverId) {
        await checkAndAssignCaregiver(visit.id, String(resourceId));
        return;
      }

      const originalStart = event.start;
      const dateTimeChanged =
        newStart.getTime() !== originalStart.getTime() || newEnd.getTime() !== event.end.getTime();

      if (dateTimeChanged) {
        await updateVisitSchedule(visit.id, newStart, newEnd);
        return;
      }

      await refetch();
    } catch (error) {
      console.error('Error updating visit:', error);
      toast.error('Failed to update visit');
    }
  }, [refetch, checkAndAssignCaregiver, updateVisitSchedule]);

  // Handle event resize (duration change)
  const handleEventResize = useCallback(async ({ event, start, end }: { event: CalendarEvent; start: Date | string; end: Date | string }) => {
    try {
      const newStart = start instanceof Date ? start : new Date(start);
      const newEnd = end instanceof Date ? end : new Date(end);
      await updateVisitSchedule(event.resource.id, newStart, newEnd);
    } catch (error) {
      console.error('Error resizing event:', error);
      toast.error('Failed to resize event');
    }
  }, [updateVisitSchedule]);

  // Mobile tap-to-reassign and event selection: opens modal with details + reassign option
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedVisitForAction(event.resource);
    setReassignCaregiverId(event.resource.assignedCaregiverId ?? '');
  }, []);

  // Handle slot selection (create visit)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setCreateVisitSlotInfo(slotInfo);
    setIsCreateVisitModalOpen(true);
  }, []);

  // Event styling with consistent tokens: Unassigned has dashed border
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const isUnassigned = event.resource.status === 'UNASSIGNED' || !event.resource.assignedCaregiverId;
    return {
      style: {
        backgroundColor: event.color,
        borderColor: isUnassigned ? '#B45309' : event.color,
        color: '#FFFFFF',
        borderRadius: '6px',
        opacity: event.resource.status === 'CANCELLED' ? 0.6 : 1,
        border: isUnassigned ? '2px dashed #B45309' : '1px solid transparent',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
    };
  }, []);

  // Date navigation handlers
  const handlePrevDate = useCallback(() => {
    if (view === 'day') {
      setCurrentDate(prev => moment(prev).subtract(1, 'day').toDate());
    } else if (view === 'week') {
      setCurrentDate(prev => moment(prev).subtract(1, 'week').toDate());
    } else {
      setCurrentDate(prev => moment(prev).subtract(1, 'month').toDate());
    }
  }, [view]);

  const handleNextDate = useCallback(() => {
    if (view === 'day') {
      setCurrentDate(prev => moment(prev).add(1, 'day').toDate());
    } else if (view === 'week') {
      setCurrentDate(prev => moment(prev).add(1, 'week').toDate());
    } else {
      setCurrentDate(prev => moment(prev).add(1, 'month').toDate());
    }
  }, [view]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // 7-day strip data for mobile Day navigation
  const weekStripDays = useMemo<DayStripItem[]>(() => {
    const start = moment(currentDate).startOf('week');
    const days: DayStripItem[] = [];
    for (let i = 0; i < 7; i++) {
      const d = start.clone().add(i, 'days');
      const dateKey = d.format('YYYY-MM-DD');
      days.push({
        key: dateKey,
        date: d,
        dayName: d.format('ddd'),
        dayNum: d.format('D'),
        isToday: d.isSame(moment(), 'day'),
        isSelected: d.isSame(moment(currentDate), 'day'),
        hasVisits: daysWithVisits.has(dateKey),
      });
    }
    return days;
  }, [currentDate, daysWithVisits]);

  // Error view
  if (error != null && !isLoading && visits.length === 0) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load visits';
    return (
      <div className="p-6">
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-red-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold">Error Loading Scheduling Calendar</h3>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
                >
                  {isRefetching ? 'Retrying...' : 'Retry'}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (isLoading && visits.length === 0) {
    return (
      <div className="h-full flex flex-col w-full bg-gray-50">
        <div className="bg-white border-b px-6 py-4 space-y-3">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 w-full max-w-xl bg-gray-100 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-6">
          <div className="bg-white rounded-xl shadow-sm h-full p-4 flex flex-col gap-4">
            <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
            <div className="flex-1 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-lg animate-pulse border border-gray-100"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col w-full max-w-full overflow-x-hidden bg-gray-50">
      {/* Top Header Row with Title, KPIs, and Navigation */}
      <div className="bg-white border-b px-3.5 sm:px-6 py-3.5 space-y-3 shrink-0">
        {/* Loading Indicator banner */}
        {(isLoading || isRefetching) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center gap-2.5 text-xs text-blue-800">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>{isLoading ? 'Loading calendar data...' : 'Refreshing calendar...'}</span>
          </div>
        )}

        {/* Row 1: Title & Toolbar Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Scheduling Calendar</h1>
              {visits.length >= 500 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  <Zap className="h-3 w-3" />
                  500+ Visits (Optimized)
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {isMobile
                ? 'Tap any visit to view details or reassign caregivers'
                : 'Manage schedules and reassign caregivers via drag-and-drop or tap'}
            </p>
          </div>

          {/* Action buttons (Min 44px touch targets) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Left Rail (Mini Calendar & Filters) */}
            <button
              type="button"
              onClick={() => setShowSidebar(prev => !prev)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors flex items-center gap-2 ${
                showSidebar
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              aria-label="Toggle mini calendar and filters"
            >
              <PanelLeft className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Mini Calendar & Filters</span>
              <span className="sm:hidden">Filters</span>
            </button>

            {/* Single Source of Truth: Legend Popover Toggle */}
            <div className="relative" ref={legendRef}>
              <button
                type="button"
                onClick={() => setShowLegendPopover(prev => !prev)}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors flex items-center gap-2 ${
                  showLegendPopover
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                aria-label="Toggle status legend"
                data-testid="legend-toggle-button"
              >
                <Info className="h-4 w-4 text-blue-600" />
                <span>Legend</span>
              </button>

              {/* Legend Popover (Single Source of Truth) */}
              {showLegendPopover && (
                <div
                  className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95"
                  data-testid="legend-popover"
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-gray-900">Visit Status Legend</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLegendPopover(false)}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      aria-label="Close legend"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <VisitStatusLegend compact={false} showTitle={false} />
                </div>
              )}
            </div>

            {/* Availability Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowAvailability(prev => !prev)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors flex items-center gap-2 ${
                showAvailability
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              aria-label="Toggle caregiver availability"
            >
              <List className="h-4 w-4 text-gray-600" />
              <span className="hidden md:inline">Availability</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="min-h-[44px] px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Refresh calendar"
            >
              {(isLoading || isRefetching) && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
              )}
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Row 2: Compact KPI Row with Consistent Color Tokens (Wraps on Mobile) */}
        <div
          role="region"
          aria-label="Visit summary metrics"
          className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap text-xs"
        >
          {/* Total / Weekly Visits */}
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === null
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            title="Click to view all visits"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>{metrics.weekly} Visits This Week</span>
          </button>

          {/* Unassigned: Amber Dashed Token */}
          <button
            type="button"
            onClick={() => setStatusFilter(prev => prev === 'UNASSIGNED' ? null : 'UNASSIGNED')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border-2 border-dashed ${
              statusFilter === 'UNASSIGNED'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-900 border-amber-500 hover:bg-amber-100'
            }`}
            title="Filter: Unassigned visits"
            data-testid="kpi-unassigned"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            <span>{metrics.unassigned} Unassigned</span>
          </button>

          {/* In Progress: Cyan Token */}
          <button
            type="button"
            onClick={() => setStatusFilter(prev => prev === 'IN_PROGRESS' ? null : 'IN_PROGRESS')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                : 'bg-cyan-50 text-cyan-900 border-cyan-400 hover:bg-cyan-100'
            }`}
            title="Filter: In Progress visits"
            data-testid="kpi-in-progress"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div>
            <span>{metrics.inProgress} In Progress</span>
          </button>

          {/* Completed: Green Token */}
          <button
            type="button"
            onClick={() => setStatusFilter(prev => prev === 'COMPLETED' ? null : 'COMPLETED')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50 text-emerald-900 border-emerald-400 hover:bg-emerald-100'
            }`}
            title="Filter: Completed visits"
            data-testid="kpi-completed"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span>{metrics.completed} Completed</span>
          </button>

          {/* Needs Review: Purple Token */}
          <button
            type="button"
            onClick={() => setStatusFilter(prev => prev === 'NEEDS_REVIEW' ? null : 'NEEDS_REVIEW')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === 'NEEDS_REVIEW'
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-purple-50 text-purple-900 border-purple-400 hover:bg-purple-100'
            }`}
            title="Filter: Needs Review visits"
            data-testid="kpi-needs-review"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
            <span>{metrics.needsReview} Needs Review</span>
          </button>

          {/* Cancelled Token (if any) */}
          {metrics.cancelled > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(prev => prev === 'CANCELLED' ? null : 'CANCELLED')}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border ${
                statusFilter === 'CANCELLED'
                  ? 'bg-gray-700 text-white border-gray-700 shadow-sm'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
              title="Filter: Cancelled visits"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400 opacity-60"></div>
              <span>{metrics.cancelled} Cancelled</span>
            </button>
          )}

          {/* Active filter badge clear button */}
          {(statusFilter || selectedCaregiverFilter) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setSelectedCaregiverFilter(null);
              }}
              className="min-h-[44px] px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Row 3: Date Navigation + Unified View Segmented Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
          {/* Navigation buttons + Current Date Heading */}
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button
                type="button"
                onClick={handlePrevDate}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-md hover:bg-white text-gray-700 transition-colors"
                aria-label="Previous period"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="min-h-[44px] px-3 py-1.5 rounded-md hover:bg-white text-xs sm:text-sm font-semibold text-gray-800 transition-colors"
                aria-label="Jump to today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextDate}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-md hover:bg-white text-gray-700 transition-colors"
                aria-label="Next period"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <span className="text-sm sm:text-base font-bold text-gray-900 ml-1">
              {view === 'day'
                ? moment(currentDate).format('dddd, MMMM D, YYYY')
                : view === 'week'
                ? `${moment(currentDate).startOf('week').format('MMM D')} – ${moment(currentDate).endOf('week').format('MMM D, YYYY')}`
                : moment(currentDate).format('MMMM YYYY')}
            </span>
          </div>

          {/* Segmented Control for Views + Density / Time Range (desktop) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Selector Segmented Control */}
            <div
              role="group"
              aria-label="Calendar view selector"
              className="inline-flex bg-gray-100 p-1 rounded-lg border border-gray-200"
            >
              <button
                type="button"
                onClick={() => setView('day')}
                className={`min-h-[44px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center justify-center ${
                  view === 'day'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                data-testid="view-day"
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                className={`min-h-[44px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center justify-center ${
                  view === 'week'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                data-testid="view-week"
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView('month')}
                className={`min-h-[44px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all flex items-center justify-center ${
                  view === 'month'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                data-testid="view-month"
              >
                Month
              </button>
            </div>

            {/* Density & Time Range Controls (Tablet & Desktop) */}
            {(view === 'week' || view === 'day') && (
              <div className="hidden lg:flex items-center gap-2 border-l pl-3">
                <div className="flex items-center gap-1.5">
                  <ZoomOut className="h-4 w-4 text-gray-400" />
                  <select
                    value={densityMode}
                    onChange={(e) => setDensityMode(e.target.value as DensityMode)}
                    className="text-xs border-gray-300 rounded-lg focus:ring-primary-500 py-2 min-h-[44px]"
                    title="Display density"
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                    <option value="ultra-compact">Ultra-Compact</option>
                  </select>
                  <ZoomIn className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                    className="text-xs border-gray-300 rounded-lg focus:ring-primary-500 py-2 min-h-[44px]"
                    title="Time range"
                  >
                    <option value="business">Business Hours (8am - 6pm)</option>
                    <option value="full">Full Day (6am - 10pm)</option>
                    <option value="extended">Extended (5am - 11pm)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 4 (Mobile Only): 7-Day Quick Date Strip */}
        <div className="md:hidden pt-2 border-t border-gray-100">
          <div className="grid grid-cols-7 gap-1 w-full">
            {weekStripDays.map((dayItem) => (
              <button
                key={dayItem.key}
                type="button"
                onClick={() => {
                  setCurrentDate(dayItem.date.toDate());
                  setView('day');
                }}
                className={`min-h-[44px] py-1 px-1 rounded-lg flex flex-col items-center justify-center transition-all ${
                  dayItem.isSelected
                    ? 'bg-primary-600 text-white font-bold shadow-sm'
                    : dayItem.isToday
                    ? 'bg-primary-50 text-primary-700 border border-primary-200 font-semibold'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                aria-label={`Select date ${dayItem.date.format('MMM D')}`}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">{dayItem.dayName}</span>
                <span className="text-sm font-semibold">{dayItem.dayNum}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    dayItem.hasVisits
                      ? dayItem.isSelected
                        ? 'bg-white'
                        : 'bg-primary-600'
                      : 'opacity-0'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Collapsible Left Rail (Mini Calendar & Filters) */}
        {showSidebar && (
          <div
            className="hidden md:flex flex-col w-72 lg:w-80 bg-white border-r p-4 overflow-y-auto space-y-4 shrink-0 shadow-sm z-10 transition-all"
            data-testid="desktop-sidebar"
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Mini Calendar & Filters
              </h3>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                aria-label="Collapse sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MiniCalendar
              currentDate={currentDate}
              daysWithVisits={daysWithVisits}
              onDateSelect={(date) => {
                setCurrentDate(date);
                setView('day');
              }}
              onMonthChange={setCurrentDate}
            />

            {/* Filter by Caregiver */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Filter by Caregiver
              </label>
              <select
                value={selectedCaregiverFilter ?? ''}
                onChange={(e) => setSelectedCaregiverFilter(e.target.value || null)}
                className="w-full text-xs border-gray-300 rounded-lg focus:ring-primary-500 py-2 min-h-[44px]"
              >
                <option value="">All Caregivers</option>
                {caregiversList.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.firstName} {cg.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Mobile Slide-Over Drawer for Mini Calendar & Filters */}
        {showSidebar && (
          <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowSidebar(false)}
            />
            {/* Drawer Sheet */}
            <div className="relative ml-auto w-full max-w-xs bg-white h-full shadow-2xl p-5 overflow-y-auto flex flex-col space-y-4 z-10">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  Calendar & Filters
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"
                  aria-label="Close drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <MiniCalendar
                currentDate={currentDate}
                daysWithVisits={daysWithVisits}
                onDateSelect={(date) => {
                  setCurrentDate(date);
                  setView('day');
                  setShowSidebar(false);
                }}
                onMonthChange={setCurrentDate}
              />

              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Filter by Caregiver
                </label>
                <select
                  value={selectedCaregiverFilter ?? ''}
                  onChange={(e) => {
                    setSelectedCaregiverFilter(e.target.value || null);
                    setShowSidebar(false);
                  }}
                  className="w-full text-sm border-gray-300 rounded-lg p-2.5 min-h-[44px]"
                >
                  <option value="">All Caregivers</option>
                  {caregiversList.map((cg) => (
                    <option key={cg.id} value={cg.id}>
                      {cg.firstName} {cg.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Schedule Grid Surface (Occupies majority/full width) */}
        <div className="flex-1 p-2 sm:p-4 md:p-6 bg-gray-50 overflow-auto min-w-0 w-full">
          {!isLoading && displayedVisits.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-16 w-16 text-gray-400" />}
              title="No visits scheduled for this period"
              description={
                statusFilter
                  ? `No ${statusFilter.toLowerCase().replace('_', ' ')} visits match the current filter.`
                  : view === 'day'
                  ? `No visits are scheduled for ${moment(currentDate).format('MMMM D, YYYY')}.`
                  : view === 'week'
                  ? `No visits are scheduled for the week of ${moment(currentDate).startOf('week').format('MMMM D')} – ${moment(currentDate).endOf('week').format('MMMM D, YYYY')}.`
                  : `No visits are scheduled for ${moment(currentDate).format('MMMM YYYY')}.`
              }
              metadata={
                weeklyVisitCount > 0 && view !== 'week' ? (
                  <div className="text-sm text-gray-500">
                    You have <span className="font-semibold text-gray-700">{weeklyVisitCount}</span> {weeklyVisitCount === 1 ? 'visit' : 'visits'} scheduled this week
                  </div>
                ) : undefined
              }
              action={
                <button
                  type="button"
                  onClick={() => setIsCreateVisitModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold text-sm min-h-[44px]"
                >
                  <Plus className="h-5 w-5" />
                  Add Visit
                </button>
              }
              secondaryAction={
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm min-h-[44px]"
                >
                  Go to Today
                </button>
              }
              size="lg"
            />
          ) : (
            <div
              ref={calendarRef}
              className={`bg-white rounded-xl shadow-sm h-full p-2 sm:p-4 calendar-${densityMode} w-full overflow-hidden`}
              style={{
                ['--event-min-height' as string]: `${DENSITY_CONFIG[densityMode].minEventHeight}px`,
                minHeight: '600px',
              }}
            >
              <DragAndDropCalendar
                localizer={localizer}
                events={events}
                view={view}
                onView={setView}
                date={currentDate}
                onNavigate={setCurrentDate}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                eventPropGetter={eventStyleGetter}
                selectable
                resizable
                toolbar={false}
                draggableAccessor={(_event) => {
                  return user?.roles.some(role => ['COORDINATOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(role)) ?? false;
                }}
                style={{ height: '100%' }}
                step={DENSITY_CONFIG[densityMode].step}
                timeslots={DENSITY_CONFIG[densityMode].timeslots}
                defaultView="week"
                views={['month', 'week', 'day']}
                min={new Date(2025, 0, 1, TIME_RANGES[timeRange].min, 0)}
                max={new Date(2025, 0, 1, TIME_RANGES[timeRange].max, 0)}
                components={{
                  event: (props) => <CustomEvent {...props} densityMode={densityMode} />,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Caregiver Availability Sidebar Drawer */}
      {showAvailability && (
        <div className="fixed right-0 top-16 bottom-0 w-80 bg-white border-l shadow-2xl overflow-y-auto z-40">
          <div className="p-4">
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <h3 className="text-base font-bold text-gray-900">Caregiver Availability</h3>
              <button
                type="button"
                onClick={() => setShowAvailability(false)}
                className="text-gray-400 hover:text-gray-600 p-1 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md"
                aria-label="Close availability drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              {moment(currentDate).format('MMMM D, YYYY')}
            </p>

            {isLoadingAvailability && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {availabilityError != null && !isLoadingAvailability && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">Failed to load availability data</p>
              </div>
            )}

            {!isLoadingAvailability && availabilityError == null && caregiverAvailability.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No caregivers available</p>
              </div>
            )}

            {!isLoadingAvailability && availabilityError == null && caregiverAvailability.length > 0 && (
              <div className="space-y-3">
                {caregiverAvailability.map(caregiver => {
                  const color = caregiverColorMap.get(caregiver.caregiver_id) ?? '#6B7280';
                  const totalHours = caregiver.visits.reduce((acc, visit) => {
                    const start = moment(visit.scheduled_start_time, 'HH:mm');
                    const end = moment(visit.scheduled_end_time, 'HH:mm');
                    return acc + end.diff(start, 'hours', true);
                  }, 0);
                  const isSelected = selectedCaregiverFilter === caregiver.caregiver_id;

                  return (
                    <div
                      key={caregiver.caregiver_id}
                      onClick={() => setSelectedCaregiverFilter(isSelected ? null : caregiver.caregiver_id)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-blue-500 shadow-md'
                          : 'hover:shadow-md hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="font-medium text-gray-900 text-sm">
                          {caregiver.first_name} {caregiver.last_name}
                        </span>
                        {isSelected && <span className="ml-auto text-xs font-semibold text-blue-600">FILTERED</span>}
                      </div>

                      <div className="text-xs text-gray-600 mb-2">
                        {caregiver.visits.length} visits • {totalHours.toFixed(1)}h scheduled
                      </div>

                      {caregiver.visits.length > 0 && (
                        <div className="space-y-1">
                          {(expandedCaregivers.has(caregiver.caregiver_id)
                            ? caregiver.visits
                            : caregiver.visits.slice(0, 4)
                          ).map(visit => (
                            <div key={visit.id} className="text-xs bg-gray-50 rounded p-1.5">
                              <div className="font-medium text-gray-700">
                                {visit.scheduled_start_time} - {visit.scheduled_end_time}
                              </div>
                              <div className="text-gray-500">{visit.client_name}</div>
                            </div>
                          ))}
                          {caregiver.visits.length > 4 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandedCaregiver(caregiver.caregiver_id);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium pt-1 block"
                            >
                              {expandedCaregivers.has(caregiver.caregiver_id)
                                ? 'Show less'
                                : `+${caregiver.visits.length - 4} more visits`}
                            </button>
                          )}
                        </div>
                      )}

                      {caregiver.visits.length === 0 && (
                        <div className="text-xs text-gray-500 italic">No visits scheduled</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tap-to-Reassign / Quick Action Modal */}
      {selectedVisitForAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          data-testid="visit-action-modal"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-5 sm:p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  selectedVisitForAction.status === 'UNASSIGNED' || !selectedVisitForAction.assignedCaregiverId
                    ? 'bg-amber-100 text-amber-800 border-2 border-dashed border-amber-400'
                    : selectedVisitForAction.status === 'IN_PROGRESS'
                    ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                    : selectedVisitForAction.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : ((selectedVisitForAction.status as string) === 'NEEDS_REVIEW' || selectedVisitForAction.requiresSupervision)
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedVisitForAction.status === 'UNASSIGNED' || !selectedVisitForAction.assignedCaregiverId
                    ? 'UNASSIGNED'
                    : selectedVisitForAction.status}
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedVisitForAction.clientFirstName} {selectedVisitForAction.clientLastName}
                </h3>
                <p className="text-xs text-gray-500">{selectedVisitForAction.serviceTypeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisitForAction(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Visit Details */}
            <div className="py-4 space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-gray-700">
                <CalendarIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>{moment(selectedVisitForAction.scheduledDate).format('dddd, MMMM D, YYYY')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-700">
                <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>
                  {selectedVisitForAction.scheduledStartTime} – {selectedVisitForAction.scheduledEndTime}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-700">
                <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>
                  Current Caregiver:{' '}
                  <strong className="text-gray-900">
                    {caregiversList.find(c => c.id === selectedVisitForAction.assignedCaregiverId)?.firstName
                      ? `${caregiversList.find(c => c.id === selectedVisitForAction.assignedCaregiverId)?.firstName} ${caregiversList.find(c => c.id === selectedVisitForAction.assignedCaregiverId)?.lastName}`
                      : selectedVisitForAction.assignedCaregiverId ? 'Assigned' : 'Unassigned'}
                  </strong>
                </span>
              </div>

              {/* Reassign Caregiver Form */}
              <div className="pt-3 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reassign Caregiver
                </label>
                <select
                  value={reassignCaregiverId}
                  onChange={(e) => setReassignCaregiverId(e.target.value)}
                  className="w-full text-sm border-gray-300 rounded-lg p-2.5 min-h-[44px] focus:ring-primary-500 focus:border-primary-500"
                  data-testid="reassign-caregiver-select"
                >
                  <option value="">Unassigned (No Caregiver)</option>
                  {caregiversList.map((cg) => (
                    <option key={cg.id} value={cg.id}>
                      {cg.firstName} {cg.lastName} ({cg.status || 'Active'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={isReassigning || reassignCaregiverId === (selectedVisitForAction.assignedCaregiverId ?? '')}
                onClick={async () => {
                  if (!reassignCaregiverId) {
                    toast('Unassigning requires removing caregiver assignment');
                    return;
                  }
                  setIsReassigning(true);
                  try {
                    const success = await checkAndAssignCaregiver(selectedVisitForAction.id, reassignCaregiverId);
                    if (success) {
                      setSelectedVisitForAction(null);
                    }
                  } finally {
                    setIsReassigning(false);
                  }
                }}
                className="min-h-[44px] flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="reassign-submit-button"
              >
                {isReassigning ? 'Reassigning...' : 'Save Reassignment'}
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate(`/visits/${selectedVisitForAction.id}`);
                }}
                className="min-h-[44px] px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                Full Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Visit Modal */}
      <CreateVisitModal
        isOpen={isCreateVisitModalOpen}
        onClose={() => {
          setIsCreateVisitModalOpen(false);
          setCreateVisitSlotInfo(null);
        }}
        onSuccess={() => {
          refetch();
        }}
        preSelectedDate={createVisitSlotInfo ? moment(createVisitSlotInfo.start).format('YYYY-MM-DD') : undefined}
        preSelectedStartTime={createVisitSlotInfo ? moment(createVisitSlotInfo.start).format('HH:mm') : undefined}
        preSelectedEndTime={createVisitSlotInfo ? moment(createVisitSlotInfo.end).format('HH:mm') : undefined}
      />
    </div>
  );
};
