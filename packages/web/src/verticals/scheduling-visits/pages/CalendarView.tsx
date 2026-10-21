import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo, EventProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Home,
  Phone,
  Building2,
  ZoomIn,
  ZoomOut,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  SlidersHorizontal,
  List,
  PanelLeft,
  Info,
  X,
  Calendar as CalendarIcon,
  Zap,
} from 'lucide-react';
import { useCalendarVisits, useVisitApi, useCaregiverAvailability } from '../hooks/useVisits';
import { useCaregivers } from '@/verticals/caregivers/hooks/useCaregivers';
import { useAuth } from '@/core/hooks';
import { CreateVisitModal } from '@/core/components/forms/CreateVisitModal';
import {
  MiniCalendar,
  VisitStatusLegend,
  CalendarFilterBar,
  CaregiverAvailabilityRail,
  MobileAgendaView,
  MobileFilterDrawer,
  ReassignVisitModal,
  VisitDetailsPanel,
} from '../components';
import type { Visit } from '../types';
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

// Custom Event Component with tooltip and icon
interface CustomEventProps extends EventProps<CalendarEvent> {
  densityMode: DensityMode;
}

const VisitTypeIconRenderer: React.FC<{ serviceTypeName: string; className?: string }> = ({
  serviceTypeName,
  className,
}) => {
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

  const clientName =
    event.resource.clientFirstName && event.resource.clientLastName
      ? `${event.resource.clientFirstName} ${event.resource.clientLastName}`
      : 'Unknown Client';

  const startTime = moment(event.start).format('h:mm A');
  const endTime = moment(event.end).format('h:mm A');
  const duration = moment(event.end).diff(moment(event.start), 'minutes');
  const durationText =
    duration >= 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`;

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', event.resource.id);
        e.dataTransfer.setData('application/json', JSON.stringify(event.resource));
      }}
    >
      {/* Event content */}
      <div
        className={`flex items-start gap-1 h-full overflow-hidden ${
          isUltraCompact ? 'px-1' : 'px-2 py-1'
        }`}
      >
        <VisitTypeIconRenderer
          serviceTypeName={event.resource.serviceTypeName}
          className={`flex-shrink-0 ${isUltraCompact ? 'h-3 w-3' : 'h-4 w-4'}`}
        />
        {!isUltraCompact && (
          <span className="truncate text-xs font-medium">{event.title}</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-full top-0 ml-2 z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 min-w-[200px] pointer-events-none">
          <div className="font-semibold mb-1">{clientName}</div>
          <div className="text-gray-300 mb-2">{event.resource.serviceTypeName}</div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="h-3 w-3" />
            <span>
              {startTime} - {endTime} ({durationText})
            </span>
          </div>
          {event.resource.assignedCaregiverId && (
            <div className="mt-2 pt-2 border-t border-gray-700 text-gray-300">
              Caregiver Assigned
            </div>
          )}
          {event.resource.status === 'UNASSIGNED' && (
            <div className="mt-2 pt-2 border-t border-gray-700 text-amber-400 font-medium">
              Needs Assignment
            </div>
          )}
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
  const navigate = useNavigate();
  const visitApi = useVisitApi();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for visit selection and quick actions
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [selectedVisitForAction, setSelectedVisitForAction] = useState<Visit | null>(null);
  const [reassignCaregiverId, setReassignCaregiverId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('week');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLegendPopover, setShowLegendPopover] = useState(false);
  const [isMobileFilterDrawerOpen, setIsMobileFilterDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'grid' | 'caregivers'>('grid');
  const [reassignVisit, setReassignVisit] = useState<Visit | null>(null);

  // Status and Caregiver filter chips (interactive KPI row)
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedCaregiverFilter, setSelectedCaregiverFilter] = useState<string | null>(null);

  // Filters state with URL synchronization
  const [selectedCaregiverFilterIds, setSelectedCaregiverFilterIds] = useState<string[]>(() => {
    const param = searchParams.get('caregiver');
    return param ? param.split(',').filter(Boolean) : [];
  });

  const [selectedClientFilterIds, setSelectedClientFilterIds] = useState<string[]>(() => {
    const param = searchParams.get('client');
    return param ? param.split(',').filter(Boolean) : [];
  });

  const [selectedStatusFilterIds, setSelectedStatusFilterIds] = useState<string[]>(() => {
    const param = searchParams.get('status');
    return param ? param.split(',').filter(Boolean) : [];
  });

  // Sync state to URL search parameters
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);

    if (selectedCaregiverFilterIds.length > 0) {
      newParams.set('caregiver', selectedCaregiverFilterIds.join(','));
    } else {
      newParams.delete('caregiver');
    }

    if (selectedClientFilterIds.length > 0) {
      newParams.set('client', selectedClientFilterIds.join(','));
    } else {
      newParams.delete('client');
    }

    if (selectedStatusFilterIds.length > 0) {
      newParams.set('status', selectedStatusFilterIds.join(','));
    } else {
      newParams.delete('status');
    }

    setSearchParams(newParams, { replace: true });
  }, [selectedCaregiverFilterIds, selectedClientFilterIds, selectedStatusFilterIds]);

  const [selectedBranches] = useState<string[]>([]);
  const [isCreateVisitModalOpen, setIsCreateVisitModalOpen] = useState(false);
  const [createVisitSlotInfo, setCreateVisitSlotInfo] = useState<SlotInfo | null>(null);

  // Week view UX controls
  const [densityMode, setDensityMode] = useState<DensityMode>(() => {
    const saved = localStorage.getItem('calendar-density');
    return (saved as DensityMode) ?? 'comfortable';
  });
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const saved = localStorage.getItem('calendar-time-range');
    return (saved as TimeRange) ?? 'full';
  });

  const calendarRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  // Close legend popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
        setShowLegendPopover(false);
      }
    };
    if (showLegendPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLegendPopover]);

  useEffect(() => {
    localStorage.setItem('calendar-density', densityMode);
  }, [densityMode]);

  useEffect(() => {
    localStorage.setItem('calendar-time-range', timeRange);
  }, [timeRange]);

  // Auto-scroll to current time on week view
  useEffect(() => {
    if (view !== 'week' || !calendarRef.current) {
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
    refetch,
    isRefetching = false,
  } = useCalendarVisits(startDate, endDate, branchIds) as any;

  // Fetch caregiver availability
  const {
    data: caregiverAvailability = [],
    isLoading: isLoadingAvailability,
  } = useCaregiverAvailability(currentDate, branchIds);

  // Fetch caregivers list for reassignment options
  const { data: caregiversData } = useCaregivers();
  const caregiversList = useMemo(() => {
    if (!caregiversData?.items) return [];
    return caregiversData.items;
  }, [caregiversData]);

  // Color map for caregivers
  const caregiverColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueCaregiverIds = new Set<string>();

    for (const ca of caregiverAvailability) {
      uniqueCaregiverIds.add(ca.caregiver_id);
    }
    for (const visit of visits) {
      if (visit.assignedCaregiverId != null) {
        uniqueCaregiverIds.add(visit.assignedCaregiverId);
      }
    }

    for (const [index, caregiverId] of Array.from(uniqueCaregiverIds).entries()) {
      map.set(caregiverId, CAREGIVER_COLORS[index % CAREGIVER_COLORS.length]!);
    }

    return map;
  }, [visits, caregiverAvailability]);

  // Distinct caregivers list for filter bar and availability rail
  const allCaregivers = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; color: string; visitCount: number; scheduledHours: number; role?: string }
    >();

    for (const ca of caregiverAvailability) {
      const name = `${ca.first_name} ${ca.last_name}`.trim();
      const hours = ca.visits.reduce((acc, v) => {
        const start = moment(v.scheduled_start_time, 'HH:mm');
        const end = moment(v.scheduled_end_time, 'HH:mm');
        return acc + Math.max(0, end.diff(start, 'hours', true));
      }, 0);

      map.set(ca.caregiver_id, {
        id: ca.caregiver_id,
        name: name || 'Caregiver',
        color: caregiverColorMap.get(ca.caregiver_id) ?? '#3B82F6',
        visitCount: ca.visits.length,
        scheduledHours: hours,
        role: (ca as { role?: string }).role,
      });
    }

    for (const v of visits) {
      if (v.assignedCaregiverId && !map.has(v.assignedCaregiverId)) {
        map.set(v.assignedCaregiverId, {
          id: v.assignedCaregiverId,
          name: 'Caregiver',
          color: caregiverColorMap.get(v.assignedCaregiverId) ?? '#3B82F6',
          visitCount: 0,
          scheduledHours: 0,
        });
      }
    }

    return Array.from(map.values());
  }, [caregiverAvailability, visits, caregiverColorMap]);

  // Distinct clients list for filter bar
  const allClients = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    for (const v of visits) {
      if (v.clientId) {
        const name =
          v.clientFirstName && v.clientLastName
            ? `${v.clientFirstName} ${v.clientLastName}`
            : 'Client';
        map.set(v.clientId, { id: v.clientId, name });
      }
    }

    return Array.from(map.values());
  }, [visits]);

  // Weekly visit count
  const weeklyVisitCount = useMemo(() => {
    const weekStart = moment(currentDate).startOf('week');
    const weekEnd = moment(currentDate).endOf('week');

    return visits.filter((visit: Visit) => {
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

  // Calculate days with visits for mini calendar and mobile date strip
  const daysWithVisits = useMemo(() => {
    const days = new Set<string>();
    for (const visit of visits) {
      const dateKey = moment(visit.scheduledDate).format('YYYY-MM-DD');
      days.add(dateKey);
    }
    return days;
  }, [visits]);

  // Filter visits based on active KPI chips, filter bar, and search
  const filteredVisits = useMemo(() => {
    return visits.filter((visit: Visit) => {
      // 1. KPI Chip Status Filter
      if (statusFilter) {
        if (statusFilter === 'UNASSIGNED') {
          if (visit.status !== 'UNASSIGNED' && visit.assignedCaregiverId) return false;
        } else if (statusFilter === 'NEEDS_REVIEW') {
          if ((visit.status as string) !== 'NEEDS_REVIEW' && !visit.requiresSupervision) return false;
        } else {
          if (visit.status !== statusFilter) return false;
        }
      } else if (selectedStatusFilterIds.length > 0) {
        if (!selectedStatusFilterIds.includes(visit.status)) {
          return false;
        }
      }

      // 2. Caregiver Filter
      if (selectedCaregiverFilter) {
        if (visit.assignedCaregiverId !== selectedCaregiverFilter) return false;
      } else if (selectedCaregiverFilterIds.length > 0) {
        if (!visit.assignedCaregiverId || !selectedCaregiverFilterIds.includes(visit.assignedCaregiverId)) {
          return false;
        }
      }

      // 3. Client Filter
      if (selectedClientFilterIds.length > 0) {
        if (!selectedClientFilterIds.includes(visit.clientId)) {
          return false;
        }
      }

      return true;
    });
  }, [
    visits,
    statusFilter,
    selectedStatusFilterIds,
    selectedCaregiverFilter,
    selectedCaregiverFilterIds,
    selectedClientFilterIds,
  ]);

  // Calculate filtered KPI metrics

  // Convert visits to calendar events with consistent status color tokens
  const events: CalendarEvent[] = useMemo(() => {
    return filteredVisits.map((visit: Visit) => {
      const scheduledDate =
        typeof visit.scheduledDate === 'string'
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

      const clientName =
        visit.clientFirstName != null && visit.clientLastName != null
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
  }, [filteredVisits, caregiverColorMap]);

  // Check conflicts and assign caregiver
  const checkAndAssignCaregiver = useCallback(
    async (visitId: string, caregiverId: string) => {
      try {
        const conflictResult = await visitApi.checkConflicts(visitId, caregiverId);

        if (conflictResult.hasConflicts) {
          const conflictMessages = conflictResult.conflicts
            .map(
              (c) =>
                `${c.scheduled_start_time} - ${c.scheduled_end_time}: ${c.client_first_name} ${c.client_last_name}`
            )
            .join('\n');

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
        await refetch();
        return true;
      } catch (error) {
        console.error('Error assigning caregiver:', error);
        toast.error('Failed to assign caregiver');
        return false;
      }
    },
    [visitApi, queryClient, refetch]
  );

  // Desktop Drag-and-drop handler
  const handleEventDrop = useCallback(
    async ({
      event,
      start,
      end,
      resourceId,
    }: {
      event: CalendarEvent;
      start: Date | string;
      end: Date | string;
      resourceId?: string | number;
    }) => {
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
          toast(
            'Rescheduling a visit requires a backend endpoint that does not exist yet. Change not saved.',
            { duration: 4000, icon: '⚠️' }
          );
          await refetch();
        }
      } catch (error) {
        console.error('Error moving visit:', error);
        toast.error('Failed to update visit schedule');
        await refetch();
      }
    },
    [checkAndAssignCaregiver, refetch]
  );

  const handleEventResize = useCallback(
    async ({ event: _event }: { event: CalendarEvent; start: Date | string; end: Date | string }) => {
      toast('Rescheduling a visit requires a backend endpoint that does not exist yet. Change not saved.', {
        duration: 4000,
        icon: '⚠️',
      });
      await refetch();
    },
    [refetch]
  );

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedVisitId(event.resource.id);
    setSelectedVisitForAction(event.resource);
    setReassignCaregiverId(event.resource.assignedCaregiverId ?? '');
  }, []);

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events]
  );
  const selectedIndex =
    selectedVisitId != null ? orderedEvents.findIndex((e) => e.id === selectedVisitId) : -1;
  const closePanel = useCallback(() => setSelectedVisitId(null), []);
  const goPrevious = useCallback(() => {
    const prev = orderedEvents[selectedIndex - 1];
    if (prev) setSelectedVisitId(prev.id);
  }, [orderedEvents, selectedIndex]);
  const goNext = useCallback(() => {
    const next = orderedEvents[selectedIndex + 1];
    if (next) setSelectedVisitId(next.id);
  }, [orderedEvents, selectedIndex]);

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setCreateVisitSlotInfo(slotInfo);
    setIsCreateVisitModalOpen(true);
  }, []);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: event.color,
        borderColor: event.color,
        color: '#FFFFFF',
        borderRadius: '4px',
        opacity: event.resource.status === 'CANCELLED' ? 0.6 : 1,
        border: event.resource.status === 'UNASSIGNED' ? '2px dashed #F59E0B' : '1px solid',
      },
    };
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setStatusFilter(null);
    setSelectedCaregiverFilter(null);
    setSelectedCaregiverFilterIds([]);
    setSelectedClientFilterIds([]);
    setSelectedStatusFilterIds([]);
  }, []);

  const isAnyFilterActive =
    statusFilter !== null ||
    selectedCaregiverFilter !== null ||
    selectedCaregiverFilterIds.length > 0 ||
    selectedClientFilterIds.length > 0 ||
    selectedStatusFilterIds.length > 0;

  // 7-day strip days for mobile view
  const weekStripDays = useMemo(() => {
    const startOfWeek = moment(currentDate).startOf('week');
    const days: Array<{
      date: moment.Moment;
      key: string;
      dayName: string;
      dayNum: string;
      isSelected: boolean;
      isToday: boolean;
      hasVisits: boolean;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const day = moment(startOfWeek).add(i, 'days');
      const dateKey = day.format('YYYY-MM-DD');
      const isSelected = day.isSame(currentDate, 'day');
      const isToday = day.isSame(moment(), 'day');
      const hasVisits = daysWithVisits.has(dateKey);

      days.push({
        date: day,
        key: dateKey,
        dayName: day.format('ddd'),
        dayNum: day.format('D'),
        isSelected,
        isToday,
        hasVisits,
      });
    }

    return days;
  }, [currentDate, daysWithVisits]);

  // Caregiver card items for CaregiverAvailabilityRail
  const caregiverCardItems = useMemo(() => {
    return allCaregivers.map((cg) => ({
      id: cg.id,
      name: cg.name,
      color: cg.color,
      scheduledHours: cg.scheduledHours,
      visitCount: cg.visitCount,
      role: cg.role ?? 'Caregiver',
    }));
  }, [allCaregivers]);

  const handleToggleCaregiverInAvailability = (caregiverId: string) => {
    if (selectedCaregiverFilterIds.includes(caregiverId)) {
      setSelectedCaregiverFilterIds(selectedCaregiverFilterIds.filter((id) => id !== caregiverId));
    } else {
      setSelectedCaregiverFilterIds([...selectedCaregiverFilterIds, caregiverId]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navbar / Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Scheduling Calendar
            </h1>
            <span className="text-gray-300 hidden md:inline">|</span>
            <span className="text-xs md:text-sm font-medium text-gray-500 hidden md:inline">
              Scheduling &gt; Calendar
            </span>
            {visits.length >= 500 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <Zap className="h-3 w-3" />
                500+ Visits (Optimized)
              </span>
            )}
          </div>

          {/* Action buttons (Min 44px touch targets) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Left Rail (Mini Calendar & Filters) */}
            <button
              type="button"
              onClick={() => setShowSidebar((prev) => !prev)}
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
                onClick={() => setShowLegendPopover((prev) => !prev)}
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

            {/* Availability Panel Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAvailability((prev) => !prev)}
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
          className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 sm:pb-0 sm:flex-wrap text-xs"
        >
          {/* Total / Weekly Visits */}
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === null && !isAnyFilterActive
                ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
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
            onClick={() =>
              setStatusFilter((prev) => (prev === 'UNASSIGNED' ? null : 'UNASSIGNED'))
            }
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border-2 border-dashed ${
              statusFilter === 'UNASSIGNED'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
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
            onClick={() =>
              setStatusFilter((prev) => (prev === 'IN_PROGRESS' ? null : 'IN_PROGRESS'))
            }
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
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
            onClick={() =>
              setStatusFilter((prev) => (prev === 'COMPLETED' ? null : 'COMPLETED'))
            }
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
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
            onClick={() =>
              setStatusFilter((prev) => (prev === 'NEEDS_REVIEW' ? null : 'NEEDS_REVIEW'))
            }
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 whitespace-nowrap border ${
              statusFilter === 'NEEDS_REVIEW'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
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
              onClick={() =>
                setStatusFilter((prev) => (prev === 'CANCELLED' ? null : 'CANCELLED'))
              }
              className={`min-h-[44px] px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border ${
                statusFilter === 'CANCELLED'
                  ? 'bg-gray-700 text-white border-gray-700 shadow-xs'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
              title="Filter: Cancelled visits"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400 opacity-60"></div>
              <span>{metrics.cancelled} Cancelled</span>
            </button>
          )}

          {/* Clear filters button */}
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="min-h-[44px] px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </header>

      {/* Subheader Toolbar: View Switcher, Date Navigation, and Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex-shrink-0">
        {/* Mobile Tab bar (< 768px) */}
        <div className="flex md:hidden items-center border-b border-gray-200 mb-2">
          <button
            type="button"
            onClick={() => setMobileTab('grid')}
            className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors ${
              mobileTab === 'grid'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Schedule Grid*
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('caregivers')}
            className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors ${
              mobileTab === 'caregivers'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Caregivers ({allCaregivers.length})
          </button>
        </div>

        {/* Date navigation and View switches */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Prev / Next / Title */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  const unit = view === 'month' ? 'month' : view === 'day' ? 'day' : 'week';
                  setCurrentDate(moment(currentDate).subtract(1, unit).toDate());
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-md hover:bg-white text-gray-700 transition-colors"
                aria-label="Previous period"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(new Date())}
                className="min-h-[44px] px-3 py-1.5 rounded-md hover:bg-white text-xs sm:text-sm font-semibold text-gray-800 transition-colors"
                aria-label="Jump to today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const unit = view === 'month' ? 'month' : view === 'day' ? 'day' : 'week';
                  setCurrentDate(moment(currentDate).add(1, unit).toDate());
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-md hover:bg-white text-gray-700 transition-colors"
                aria-label="Next period"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <span className="text-sm sm:text-base font-bold text-gray-900 ml-1">
              {view === 'month'
                ? moment(currentDate).format('MMMM YYYY')
                : view === 'day'
                ? moment(currentDate).format('dddd, MMMM D, YYYY')
                : `${moment(currentDate).startOf('week').format('MMM D')} – ${moment(
                    currentDate
                  )
                    .endOf('week')
                    .format('MMM D, YYYY')}`}
            </span>
          </div>

          {/* Segmented Control for Views + Density / Time Range (desktop) */}
          <div className="flex items-center gap-2.5 flex-wrap">
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
                    ? 'bg-white text-blue-700 shadow-xs'
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
                    ? 'bg-white text-blue-700 shadow-xs'
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
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                data-testid="view-month"
              >
                Month
              </button>
            </div>

            {/* Density & Time range controls */}
            {(view === 'week' || view === 'day') && (
              <div className="hidden lg:flex items-center gap-2 border-l border-gray-200 pl-3">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ZoomOut className="w-3.5 h-3.5" />
                  <select
                    value={densityMode}
                    onChange={(e) => setDensityMode(e.target.value as DensityMode)}
                    className="text-xs border-gray-300 rounded focus:ring-blue-500 py-1 min-h-[44px]"
                    title="Density Mode"
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                    <option value="ultra-compact">Ultra-Compact</option>
                  </select>
                  <ZoomIn className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                    className="text-xs border-gray-300 rounded focus:ring-blue-500 py-1 min-h-[44px]"
                    title="Time Range"
                  >
                    <option value="business">Business (8am-6pm)</option>
                    <option value="full">Full Day (6am-10pm)</option>
                    <option value="extended">Extended (5am-11pm)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Mobile Filter Button (< 768px) */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileFilterDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 shadow-2xs min-h-[44px]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
            </div>
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
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : dayItem.isToday
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                aria-label={`Select date ${dayItem.date.format('MMM D')}`}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {dayItem.dayName}
                </span>
                <span className="text-sm font-semibold">{dayItem.dayNum}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    dayItem.hasVisits
                      ? dayItem.isSelected
                        ? 'bg-white'
                        : 'bg-blue-600'
                      : 'opacity-0'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Desktop Filter Bar */}
      <div className="hidden md:block px-4 pt-3 flex-shrink-0">
        <CalendarFilterBar
          allCaregivers={allCaregivers}
          allClients={allClients}
          selectedCaregivers={selectedCaregiverFilterIds}
          onCaregiversChange={setSelectedCaregiverFilterIds}
          selectedClients={selectedClientFilterIds}
          onClientsChange={setSelectedClientFilterIds}
          selectedStatuses={selectedStatusFilterIds}
          onStatusesChange={setSelectedStatusFilterIds}
          onClearAll={handleClearAllFilters}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 w-full relative">
        {/* Mobile View Content */}
        <div className="md:hidden flex-1 flex flex-col overflow-y-auto p-4">
          {mobileTab === 'grid' ? (
            <MobileAgendaView
              currentDate={currentDate}
              visits={filteredVisits}
              caregiverColorMap={caregiverColorMap}
              onSelectVisit={(visit) => {
                setSelectedVisitId(visit.id);
                setSelectedVisitForAction(visit);
                setReassignCaregiverId(visit.assignedCaregiverId ?? '');
              }}
              onReassignVisit={(visit) => setReassignVisit(visit)}
            />
          ) : (
            <div className="space-y-3">
              {allCaregivers.map((cg) => (
                <div
                  key={cg.id}
                  onClick={() => handleToggleCaregiverInAvailability(cg.id)}
                  className={`p-3 bg-white rounded-lg border transition-all cursor-pointer ${
                    selectedCaregiverFilterIds.includes(cg.id)
                      ? 'border-blue-600 ring-2 ring-blue-100'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-900">{cg.name}</span>
                    <span className="text-xs text-gray-500">{cg.scheduledHours.toFixed(1)}h</span>
                  </div>
                  <div className="text-xs text-gray-500">{cg.visitCount} visits scheduled</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop 3-Zone Layout */}
        <div className="hidden md:flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Left Zone: Mini Calendar & Filters (~280px, Collapsible) */}
          {showSidebar ? (
            <aside
              className="w-72 lg:w-80 flex-shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto flex flex-col justify-between space-y-4 shadow-sm"
              data-testid="desktop-sidebar"
            >
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b">
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Mini Calendar & Filters
                  </span>
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

                {/* Filter by Caregiver in sidebar */}
                <div className="pt-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Filter by Caregiver
                  </label>
                  <select
                    value={selectedCaregiverFilter ?? ''}
                    onChange={(e) => setSelectedCaregiverFilter(e.target.value || null)}
                    className="w-full text-xs border-gray-300 rounded-lg focus:ring-blue-500 py-2 min-h-[44px]"
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

              <div className="pt-3 border-t border-gray-100">
                <VisitStatusLegend compact={false} />
              </div>
            </aside>
          ) : (
            <div className="flex flex-col items-center py-2 px-1 border-r border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowSidebar(true)}
                className="p-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded min-h-[44px] min-w-[32px] flex items-center justify-center"
                title="Expand Left Rail"
                aria-label="Expand Left Rail"
              >
                &gt;
              </button>
            </div>
          )}

          {/* Center Zone: Schedule Grid */}
          <main className="flex-1 min-w-0 h-full p-4 overflow-auto bg-gray-50 flex flex-col">
            {!isLoading && filteredVisits.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center my-auto max-w-lg mx-auto shadow-sm">
                <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  No visits match these filters
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  No visits found for the selected caregiver, client, or status combination.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors min-h-[44px]"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div
                ref={calendarRef}
                className={`bg-white rounded-xl border border-gray-200 shadow-xs h-full p-3.5 calendar-${densityMode}`}
                style={{
                  ['--event-min-height' as string]: `${DENSITY_CONFIG[densityMode].minEventHeight}px`,
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
                  draggableAccessor={(_event) => {
                    return (
                      user?.roles.some((role) =>
                        ['COORDINATOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(role)
                      ) ?? false
                    );
                  }}
                  style={{ height: '100%' }}
                  step={DENSITY_CONFIG[densityMode].step}
                  timeslots={DENSITY_CONFIG[densityMode].timeslots}
                  defaultView="week"
                  views={['month', 'week', 'day']}
                  toolbar={false}
                  min={new Date(2025, 0, 1, TIME_RANGES[timeRange].min, 0)}
                  max={new Date(2025, 0, 1, TIME_RANGES[timeRange].max, 0)}
                  messages={{
                    next: 'Next',
                    previous: 'Previous',
                    today: 'Today',
                    month: 'Month',
                    week: 'Week',
                    day: 'Day',
                  }}
                  components={{
                    event: (props) => <CustomEvent {...props} densityMode={densityMode} />,
                  }}
                />
              </div>
            )}
          </main>

          {/* Right Zone: Caregiver Availability Rail */}
          <CaregiverAvailabilityRail
            isOpen={showAvailability}
            onClose={() => setShowAvailability(false)}
            caregivers={caregiverCardItems}
            selectedCaregiverIds={selectedCaregiverFilterIds}
            onToggleCaregiver={handleToggleCaregiverInAvailability}
            onAssignVisitToCaregiver={checkAndAssignCaregiver}
            isLoading={isLoadingAvailability}
          />
        </div>
      </div>

      {/* Mobile Bottom-sheet Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isMobileFilterDrawerOpen}
        onClose={() => setIsMobileFilterDrawerOpen(false)}
        allCaregivers={allCaregivers}
        allClients={allClients}
        selectedCaregivers={selectedCaregiverFilterIds}
        onCaregiversChange={setSelectedCaregiverFilterIds}
        selectedClients={selectedClientFilterIds}
        onClientsChange={setSelectedClientFilterIds}
        selectedStatuses={selectedStatusFilterIds}
        onStatusesChange={setSelectedStatusFilterIds}
        onReset={handleClearAllFilters}
      />

      {/* Mobile Tap-to-reassign modal */}
      <ReassignVisitModal
        isOpen={reassignVisit !== null}
        onClose={() => setReassignVisit(null)}
        visit={reassignVisit}
        caregivers={allCaregivers}
        onAssignCaregiver={checkAndAssignCaregiver}
      />

      {/* Tap-to-Reassign / Quick Action Modal (data-testid="visit-action-modal") */}
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
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    selectedVisitForAction.status === 'UNASSIGNED' ||
                    !selectedVisitForAction.assignedCaregiverId
                      ? 'bg-amber-100 text-amber-800 border-2 border-dashed border-amber-400'
                      : selectedVisitForAction.status === 'IN_PROGRESS'
                      ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                      : selectedVisitForAction.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : (selectedVisitForAction.status as string) === 'NEEDS_REVIEW' ||
                        selectedVisitForAction.requiresSupervision
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedVisitForAction.status === 'UNASSIGNED' ||
                  !selectedVisitForAction.assignedCaregiverId
                    ? 'UNASSIGNED'
                    : selectedVisitForAction.status}
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedVisitForAction.clientFirstName} {selectedVisitForAction.clientLastName}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedVisitForAction.serviceTypeName}
                </p>
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
                <span>
                  {moment(selectedVisitForAction.scheduledDate).format('dddd, MMMM D, YYYY')}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-700">
                <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>
                  {selectedVisitForAction.scheduledStartTime} –{' '}
                  {selectedVisitForAction.scheduledEndTime}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-700">
                <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span>
                  Current Caregiver:{' '}
                  <strong className="text-gray-900">
                    {caregiversList.find(
                      (c) => c.id === selectedVisitForAction.assignedCaregiverId
                    )?.firstName
                      ? `${
                          caregiversList.find(
                            (c) => c.id === selectedVisitForAction.assignedCaregiverId
                          )?.firstName
                        } ${
                          caregiversList.find(
                            (c) => c.id === selectedVisitForAction.assignedCaregiverId
                          )?.lastName
                        }`
                      : selectedVisitForAction.assignedCaregiverId
                      ? 'Assigned'
                      : 'Unassigned'}
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
                  className="w-full text-sm border-gray-300 rounded-lg p-2.5 min-h-[44px] focus:ring-blue-500 focus:border-blue-500"
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
                disabled={
                  isReassigning ||
                  reassignCaregiverId === (selectedVisitForAction.assignedCaregiverId ?? '')
                }
                onClick={async () => {
                  if (!reassignCaregiverId) {
                    toast('Unassigning requires removing caregiver assignment');
                    return;
                  }
                  setIsReassigning(true);
                  try {
                    const success = await checkAndAssignCaregiver(
                      selectedVisitForAction.id,
                      reassignCaregiverId
                    );
                    if (success) {
                      setSelectedVisitForAction(null);
                    }
                  } finally {
                    setIsReassigning(false);
                  }
                }}
                className="min-h-[44px] flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Visit details side panel */}
      {selectedVisitId != null && !selectedVisitForAction && (
        <VisitDetailsPanel
          visitId={selectedVisitId}
          onClose={closePanel}
          onPrevious={selectedIndex > 0 ? goPrevious : undefined}
          onNext={
            selectedIndex >= 0 && selectedIndex < orderedEvents.length - 1 ? goNext : undefined
          }
          positionLabel={
            selectedIndex >= 0 ? `${selectedIndex + 1} of ${orderedEvents.length}` : undefined
          }
        />
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
        preSelectedDate={
          createVisitSlotInfo ? moment(createVisitSlotInfo.start).format('YYYY-MM-DD') : undefined
        }
        preSelectedStartTime={
          createVisitSlotInfo ? moment(createVisitSlotInfo.start).format('HH:mm') : undefined
        }
        preSelectedEndTime={
          createVisitSlotInfo ? moment(createVisitSlotInfo.end).format('HH:mm') : undefined
        }
      />
    </div>
  );
};
