import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo, EventProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { useCalendarVisits, useVisitApi, useCaregiverAvailability } from '../hooks/useVisits';
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
  const name = serviceTypeName.toLowerCase();
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
  const visitApi = useVisitApi();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('week');
  const [showAvailability, setShowAvailability] = useState(true);
  const [showLeftRail, setShowLeftRail] = useState(true);
  const [isMobileFilterDrawerOpen, setIsMobileFilterDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'grid' | 'caregivers'>('grid');
  const [reassignVisit, setReassignVisit] = useState<Visit | null>(null);

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
    return param ? param.split(',').filter(Boolean) : ['ASSIGNED'];
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
  } = useCalendarVisits(startDate, endDate, branchIds);

  // Fetch caregiver availability
  const {
    data: caregiverAvailability = [],
    isLoading: isLoadingAvailability,
  } = useCaregiverAvailability(currentDate, branchIds);

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

    // Seed from caregiverAvailability
    for (const ca of caregiverAvailability) {
      const name = `${ca.first_name} ${ca.last_name}`.trim();
      const hours = ca.visits.reduce((acc, v) => {
        const start = moment(v.scheduled_start_time, 'HH:mm');
        const end = moment(v.scheduled_end_time, 'HH:mm');
        return acc + Math.max(0, end.diff(start, 'hours', true));
      }, 0);

      map.set(ca.caregiver_id, {
        id: ca.caregiver_id,
        name,
        color: caregiverColorMap.get(ca.caregiver_id) || '#3B82F6',
        visitCount: ca.visits.length,
        scheduledHours: hours,
      });
    }

    // Add caregivers from visits if not present
    for (const v of visits) {
      if (v.assignedCaregiverId) {
        const existing = map.get(v.assignedCaregiverId);
        const name = existing ? existing.name : 'Caregiver';
        if (!existing) {
          map.set(v.assignedCaregiverId, {
            id: v.assignedCaregiverId,
            name,
            color: caregiverColorMap.get(v.assignedCaregiverId) || '#3B82F6',
            visitCount: 0,
            scheduledHours: 0,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits, caregiverAvailability, caregiverColorMap]);

  // Caregiver name map for display
  const caregiverNameMap = useMemo(() => {
    return new Map(allCaregivers.map((c) => [c.id, c.name]));
  }, [allCaregivers]);

  // Distinct clients list for filter bar
  const allClients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; visitCount: number }>();
    for (const v of visits) {
      const clientId = v.clientId || `${v.clientFirstName}_${v.clientLastName}`;
      const name =
        v.clientFirstName && v.clientLastName
          ? `${v.clientFirstName} ${v.clientLastName}`
          : 'Unknown Client';
      const existing = map.get(clientId);
      if (existing) {
        existing.visitCount += 1;
      } else {
        map.set(clientId, { id: clientId, name, visitCount: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);

  // Apply filters to visits (Caregiver, Client, and Status)
  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      // 1. Caregiver filter
      if (selectedCaregiverFilterIds.length > 0) {
        const isAssigned = visit.assignedCaregiverId
          ? selectedCaregiverFilterIds.includes(visit.assignedCaregiverId)
          : false;

        const isUnassignedAllowed =
          selectedStatusFilterIds.includes('UNASSIGNED') &&
          (!visit.assignedCaregiverId || visit.status === 'UNASSIGNED');

        if (!isAssigned && !isUnassignedAllowed) {
          return false;
        }
      }

      // 2. Client filter
      if (selectedClientFilterIds.length > 0) {
        const clientKey = visit.clientId || `${visit.clientFirstName}_${visit.clientLastName}`;
        if (!selectedClientFilterIds.includes(clientKey)) {
          return false;
        }
      }

      // 3. Status filter
      if (selectedStatusFilterIds.length > 0) {
        const status = visit.status || 'SCHEDULED';
        const isUnassignedMatch =
          selectedStatusFilterIds.includes('UNASSIGNED') &&
          (status === 'UNASSIGNED' || !visit.assignedCaregiverId);

        const isAssignedMatch =
          selectedStatusFilterIds.includes('ASSIGNED') &&
          Boolean(visit.assignedCaregiverId) &&
          status !== 'CANCELLED' &&
          status !== 'COMPLETED' &&
          status !== 'IN_PROGRESS';

        const isDirectStatusMatch = selectedStatusFilterIds.includes(status);

        if (!isUnassignedMatch && !isAssignedMatch && !isDirectStatusMatch) {
          return false;
        }
      }

      return true;
    });
  }, [visits, selectedCaregiverFilterIds, selectedClientFilterIds, selectedStatusFilterIds]);

  // Calculate filtered KPI metrics
  const { filteredVisitCount, filteredTotalHours } = useMemo(() => {
    let count = 0;
    let totalMinutes = 0;
    for (const v of filteredVisits) {
      count++;
      const start = moment(normalizeTimeFormat(v.scheduledStartTime), 'HH:mm');
      const end = moment(normalizeTimeFormat(v.scheduledEndTime), 'HH:mm');
      const diff = Math.max(0, end.diff(start, 'minutes'));
      totalMinutes += diff;
    }
    return {
      filteredVisitCount: count,
      filteredTotalHours: totalMinutes / 60,
    };
  }, [filteredVisits]);

  // Calculate days with matching visits for mini calendar
  const daysWithVisits = useMemo(() => {
    const days = new Set<string>();
    for (const visit of filteredVisits) {
      const dateKey = moment(visit.scheduledDate).format('YYYY-MM-DD');
      days.add(dateKey);
    }
    return days;
  }, [filteredVisits]);

  // Caregiver Availability cards with workload
  const caregiverCardItems = useMemo(() => {
    return allCaregivers.map((cg) => {
      const cgVisits = filteredVisits.filter((v) => v.assignedCaregiverId === cg.id);
      const hours = cgVisits.reduce((acc, v) => {
        const start = moment(normalizeTimeFormat(v.scheduledStartTime), 'HH:mm');
        const end = moment(normalizeTimeFormat(v.scheduledEndTime), 'HH:mm');
        return acc + Math.max(0, end.diff(start, 'hours', true));
      }, 0);

      return {
        id: cg.id,
        name: cg.name,
        color: cg.color,
        visitCount: cgVisits.length,
        scheduledHours: hours,
      };
    });
  }, [allCaregivers, filteredVisits]);

  // Toggle caregiver filter from availability rail
  const handleToggleCaregiverInAvailability = useCallback((caregiverId: string) => {
    setSelectedCaregiverFilterIds((prev) => {
      if (prev.includes(caregiverId)) {
        return prev.filter((id) => id !== caregiverId);
      } else {
        return [...prev, caregiverId];
      }
    });
  }, []);

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    setSelectedCaregiverFilterIds([]);
    setSelectedClientFilterIds([]);
    setSelectedStatusFilterIds(['ASSIGNED']);
  }, []);

  // Convert filtered visits to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return filteredVisits.map((visit) => {
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

      let color = '#6B7280';
      if (visit.assignedCaregiverId != null) {
        color = caregiverColorMap.get(visit.assignedCaregiverId) ?? '#3B82F6';
      } else if (visit.status === 'UNASSIGNED') {
        color = '#F59E0B';
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

  // Check for conflicts and assign caregiver (reassignment workflow)
  const checkAndAssignCaregiver = useCallback(
    async (visitId: string, caregiverId: string): Promise<boolean> => {
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
        return true;
      } catch (err) {
        console.error('Error assigning caregiver:', err);
        toast.error('Failed to assign caregiver');
        return false;
      }
    },
    [visitApi, queryClient]
  );

  const updateVisitSchedule = useCallback(
    async (_visitId: string, _start: Date, _end: Date) => {
      toast(
        'Rescheduling a visit requires a backend endpoint that does not exist yet (no PATCH/PUT for date/time on /api/visits). Change not saved.',
        {
          duration: 4000,
          icon: '⚠️',
        }
      );
      await refetch();
      return false;
    },
    [refetch]
  );

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
          newStart.getTime() !== originalStart.getTime() ||
          newEnd.getTime() !== event.end.getTime();

        if (dateTimeChanged) {
          await updateVisitSchedule(visit.id, newStart, newEnd);
          return;
        }

        await refetch();
      } catch (err) {
        console.error('Error updating visit:', err);
        toast.error('Failed to update visit');
      }
    },
    [refetch, checkAndAssignCaregiver, updateVisitSchedule]
  );

  const handleEventResize = useCallback(
    async ({
      event,
      start,
      end,
    }: {
      event: CalendarEvent;
      start: Date | string;
      end: Date | string;
    }) => {
      try {
        const newStart = start instanceof Date ? start : new Date(start);
        const newEnd = end instanceof Date ? end : new Date(end);
        await updateVisitSchedule(event.resource.id, newStart, newEnd);
      } catch (err) {
        console.error('Error resizing event:', err);
        toast.error('Failed to resize event');
      }
    },
    [updateVisitSchedule]
  );

  // Handle event selection - open details in an in-page side panel so the
  // calendar (date range, filters, scroll position) stays mounted.
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedVisitId(event.resource.id);
  }, []);

  // Visits in chronological order for prev/next navigation inside the panel.
  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events],
  );
  const selectedIndex = selectedVisitId != null
    ? orderedEvents.findIndex(e => e.id === selectedVisitId)
    : -1;
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
        opacity: event.resource.status === 'CANCELLED' ? 0.5 : 1,
        border: event.resource.status === 'UNASSIGNED' ? '2px dashed' : '1px solid',
      },
    };
  }, []);

  const activeFilterCount =
    selectedCaregiverFilterIds.length +
    selectedClientFilterIds.length +
    selectedStatusFilterIds.length;

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navbar / Breadcrumb Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-base md:text-lg">
              MHC Family Portal
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-xs md:text-sm font-medium text-gray-600">
              Scheduling &gt; Calendar
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filtered KPI Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
            <span>
              {filteredVisitCount} Visits | {filteredTotalHours.toFixed(1)} hrs (Filtered)
            </span>
          </span>

          {/* User profile icon */}
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
            <User className="w-4 h-4" />
          </div>

          {/* Availability Panel Toggle Button (Desktop) */}
          <button
            type="button"
            onClick={() => setShowAvailability((prev) => !prev)}
            className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-2xs"
          >
            <span>[Availability Panel | {showAvailability ? '&gt;' : '&lt;'}]</span>
          </button>
        </div>
      </header>

      {/* Subheader Toolbar: Mobile Tabs / Desktop View Switcher & Date Navigation */}
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
          <div className="flex items-center gap-2">
            {/* Prev / Next / Title */}
            <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const unit = view === 'month' ? 'month' : view === 'day' ? 'day' : 'week';
                  setCurrentDate(moment(currentDate).subtract(1, unit).toDate());
                }}
                className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label="Previous date"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs md:text-sm font-semibold text-gray-800 select-none">
                {view === 'month'
                  ? moment(currentDate).format('MMMM YYYY')
                  : view === 'day'
                  ? moment(currentDate).format('ddd, MMM D, YYYY')
                  : `${moment(currentDate).startOf('week').format('MMM D')} - ${moment(
                      currentDate
                    )
                      .endOf('week')
                      .format('MMM D, YYYY')}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  const unit = view === 'month' ? 'month' : view === 'day' ? 'day' : 'week';
                  setCurrentDate(moment(currentDate).add(1, unit).toDate());
                }}
                className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label="Next date"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs transition-colors"
            >
              Today
            </button>
          </div>

          {/* Desktop View Switcher */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setView('day')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  view === 'day'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  view === 'week'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView('month')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  view === 'month'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Month
              </button>
            </div>

            {/* Density & Time range controls */}
            {(view === 'week' || view === 'day') && (
              <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ZoomOut className="w-3.5 h-3.5" />
                  <select
                    value={densityMode}
                    onChange={(e) => setDensityMode(e.target.value as DensityMode)}
                    className="text-xs border-gray-300 rounded focus:ring-blue-500 py-0.5"
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
                    className="text-xs border-gray-300 rounded focus:ring-blue-500 py-0.5"
                    title="Time Range"
                  >
                    <option value="business">Business (8am-6pm)</option>
                    <option value="full">Full Day (6am-10pm)</option>
                    <option value="extended">Extended (5am-11pm)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Filter Button (< 768px) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileFilterDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters ({activeFilterCount} Active)</span>
            </button>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs font-semibold text-gray-600 underline"
              >
                [Clear all]
              </button>
            )}
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
              onSelectVisit={(v) => navigate(`/visits/${v.id}`)}
              onReassignVisit={(v) => setReassignVisit(v)}
              caregiverColorMap={caregiverColorMap}
              caregiverNameMap={caregiverNameMap}
            />
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Caregivers Availability
              </h3>
              {allCaregivers.map((cg) => (
                <div
                  key={cg.id}
                  onClick={() => handleToggleCaregiverInAvailability(cg.id)}
                  className={`p-3 rounded-xl border bg-white flex items-center justify-between ${
                    selectedCaregiverFilterIds.includes(cg.id)
                      ? 'border-teal-500 ring-2 ring-teal-500'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cg.color }}
                    />
                    <div>
                      <div className="font-bold text-sm text-gray-900">{cg.name}</div>
                      <div className="text-xs text-gray-500">
                        {cg.visitCount} visits | {cg.scheduledHours.toFixed(1)} hrs
                      </div>
                    </div>
                  </div>
                  {selectedCaregiverFilterIds.includes(cg.id) && (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                      FILTERED
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop 3-Zone Layout */}
        <div className="hidden md:flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Left Zone: Mini Calendar & Legend (~240px, Collapsible) */}
          {showLeftRail ? (
            <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 p-3 overflow-y-auto flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Navigation
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLeftRail(false)}
                    className="text-xs text-gray-500 hover:text-gray-800 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
                  >
                    &lt; Collapse
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
              </div>
              <div className="pt-3 border-t border-gray-100">
                <VisitStatusLegend compact={false} />
              </div>
            </aside>
          ) : (
            <div className="flex flex-col items-center py-2 px-1 border-r border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowLeftRail(true)}
                className="p-1 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded"
                title="Expand Left Rail"
              >
                &gt;
              </button>
            </div>
          )}

          {/* Center Zone: Schedule Grid (Flex Auto, NEVER overlaid) */}
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
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

          {/* Right Zone: Caregiver Availability Rail (Pushes grid, NEVER overlaying) */}
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

      {/* Visit details side panel (lazy-loads full record on open) */}
      {selectedVisitId != null && (
        <VisitDetailsPanel
          visitId={selectedVisitId}
          onClose={closePanel}
          onPrevious={selectedIndex > 0 ? goPrevious : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < orderedEvents.length - 1 ? goNext : undefined}
          positionLabel={selectedIndex >= 0 ? `${selectedIndex + 1} of ${orderedEvents.length}` : undefined}
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
