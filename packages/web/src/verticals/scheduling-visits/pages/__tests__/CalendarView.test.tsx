import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CalendarView } from '../CalendarView';
import type { Visit } from '../../types';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

// Mock react-query
const mockInvalidateQueries = vi.fn();
const mockRemoveQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    removeQueries: mockRemoveQueries,
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: { id: 'user-1', roles: ['COORDINATOR', 'ADMINISTRATOR'] },
  }),
}));

// Mock visits data
const mockVisits: Visit[] = [
  {
    id: 'visit-1',
    organizationId: 'org-1',
    branchId: 'branch-1',
    clientId: 'client-1',
    visitNumber: 'V-001',
    visitType: 'REGULAR',
    serviceTypeId: 'st-1',
    serviceTypeName: 'Personal Care',
    scheduledDate: new Date('2026-10-18T10:00:00Z'),
    scheduledStartTime: '09:00',
    scheduledEndTime: '11:00',
    scheduledDuration: 120,
    timezone: 'America/New_York',
    assignedCaregiverId: undefined, // Unassigned
    clientFirstName: 'Eleanor',
    clientLastName: 'Vance',
    address: {
      line1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'USA',
    },
    status: 'UNASSIGNED',
    isUrgent: false,
    isPriority: false,
    requiresSupervision: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'visit-2',
    organizationId: 'org-1',
    branchId: 'branch-1',
    clientId: 'client-2',
    visitNumber: 'V-002',
    visitType: 'REGULAR',
    serviceTypeId: 'st-2',
    serviceTypeName: 'Companion Care',
    scheduledDate: new Date('2026-10-18T14:00:00Z'),
    scheduledStartTime: '14:00',
    scheduledEndTime: '16:00',
    scheduledDuration: 120,
    timezone: 'America/New_York',
    assignedCaregiverId: 'cg-1',
    clientFirstName: 'Arthur',
    clientLastName: 'Dent',
    address: {
      line1: '42 Galaxy Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78702',
      country: 'USA',
    },
    status: 'IN_PROGRESS',
    isUrgent: false,
    isPriority: false,
    requiresSupervision: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'visit-3',
    organizationId: 'org-1',
    branchId: 'branch-1',
    clientId: 'client-3',
    visitNumber: 'V-003',
    visitType: 'REGULAR',
    serviceTypeId: 'st-1',
    serviceTypeName: 'Personal Care',
    scheduledDate: new Date('2026-10-18T16:00:00Z'),
    scheduledStartTime: '16:00',
    scheduledEndTime: '18:00',
    scheduledDuration: 120,
    timezone: 'America/New_York',
    assignedCaregiverId: 'cg-2',
    clientFirstName: 'Ford',
    clientLastName: 'Prefect',
    address: {
      line1: '43 Galaxy Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78702',
      country: 'USA',
    },
    status: 'COMPLETED',
    isUrgent: false,
    isPriority: false,
    requiresSupervision: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockAssignCaregiver = vi.fn().mockResolvedValue({ success: true });
const mockCheckConflicts = vi.fn().mockResolvedValue({ hasConflicts: false, conflicts: [] });
const mockRefetch = vi.fn();

// Mock useVisits hooks
vi.mock('../../hooks/useVisits', () => ({
  useCalendarVisits: () => ({
    data: mockVisits,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    isRefetching: false,
  }),
  useVisit: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
  useCaregiverAvailability: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useVisitApi: () => ({
    assignCaregiver: mockAssignCaregiver,
    checkConflicts: mockCheckConflicts,
  }),
}));

// Mock useCaregivers hook
vi.mock('@/verticals/caregivers/hooks/useCaregivers', () => ({
  useCaregivers: () => ({
    data: {
      items: [
        { id: 'cg-1', firstName: 'Sarah', lastName: 'Connor', status: 'ACTIVE' },
        { id: 'cg-2', firstName: 'John', lastName: 'Doe', status: 'ACTIVE' },
      ],
      total: 2,
    },
  }),
}));

// Mock react-big-calendar to render a controllable mock calendar
vi.mock('react-big-calendar', () => {
  return {
    Calendar: ({ events, onSelectEvent, view }: any) => (
      <div data-testid="big-calendar" data-view={view}>
        {events.map((evt: any) => (
          <div
            key={evt.id}
            data-testid={`calendar-event-${evt.id}`}
            onClick={() => onSelectEvent(evt)}
            style={{ backgroundColor: evt.color }}
          >
            <span>{evt.title}</span>
          </div>
        ))}
      </div>
    ),
    momentLocalizer: () => ({}),
  };
});

vi.mock('react-big-calendar/lib/addons/dragAndDrop', () => ({
  default: (component: any) => component,
}));

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and responsive KPI metrics row with status color tokens', () => {
    render(<CalendarView />);

    expect(screen.getByText('Scheduling Calendar')).toBeInTheDocument();

    // Verify KPI metric chips
    expect(screen.getByTestId('kpi-unassigned')).toBeInTheDocument();
    expect(screen.getByText(/1 Unassigned/)).toBeInTheDocument();

    expect(screen.getByTestId('kpi-in-progress')).toBeInTheDocument();
    expect(screen.getByText(/1 In Progress/)).toBeInTheDocument();

    expect(screen.getByTestId('kpi-completed')).toBeInTheDocument();
    expect(screen.getByText(/1 Completed/)).toBeInTheDocument();
  });

  it('renders unified segmented control for Day, Week, and Month views', async () => {
    const user = userEvent.setup();
    render(<CalendarView />);

    const dayBtn = screen.getByTestId('view-day');
    const weekBtn = screen.getByTestId('view-week');
    const monthBtn = screen.getByTestId('view-month');

    expect(dayBtn).toBeInTheDocument();
    expect(weekBtn).toBeInTheDocument();
    expect(monthBtn).toBeInTheDocument();

    // Switch to Day view
    await user.click(dayBtn);
    expect(screen.getByTestId('big-calendar')).toHaveAttribute('data-view', 'day');

    // Switch to Month view
    await user.click(monthBtn);
    expect(screen.getByTestId('big-calendar')).toHaveAttribute('data-view', 'month');
  });

  it('toggles single-source-of-truth status legend popover', async () => {
    const user = userEvent.setup();
    render(<CalendarView />);

    // Initially legend popover is hidden
    expect(screen.queryByTestId('legend-popover')).not.toBeInTheDocument();

    // Click legend toggle button
    const legendBtn = screen.getByTestId('legend-toggle-button');
    await user.click(legendBtn);

    // Popover is displayed with legend content
    expect(screen.getByTestId('legend-popover')).toBeInTheDocument();
    expect(screen.getByText('Visit needs caregiver assignment')).toBeInTheDocument();

    // Click close button
    const closeBtn = screen.getByLabelText('Close legend');
    await user.click(closeBtn);

    expect(screen.queryByTestId('legend-popover')).not.toBeInTheDocument();
  });

  it('toggles collapsible left rail for mini calendar and filters', async () => {
    const user = userEvent.setup();
    render(<CalendarView />);

    // Initially sidebar is closed
    expect(screen.queryByTestId('desktop-sidebar')).not.toBeInTheDocument();

    // Click toggle button
    const sidebarToggle = screen.getByLabelText('Toggle mini calendar and filters');
    await user.click(sidebarToggle);

    // Sidebar is opened
    expect(screen.getByTestId('desktop-sidebar')).toBeInTheDocument();

    // Click again to collapse
    await user.click(sidebarToggle);
    expect(screen.queryByTestId('desktop-sidebar')).not.toBeInTheDocument();
  });

  it('supports tap-to-reassign: clicking a visit opens modal and allows reassignment', async () => {
    const user = userEvent.setup();
    render(<CalendarView />);

    // Click unassigned visit event
    const eventElement = screen.getByTestId('calendar-event-visit-1');
    await user.click(eventElement);

    // Modal opens with visit details
    expect(screen.getByTestId('visit-action-modal')).toBeInTheDocument();
    expect(screen.getByText('Eleanor Vance')).toBeInTheDocument();
    expect(screen.getByText('Personal Care')).toBeInTheDocument();

    // Select caregiver from dropdown
    const select = screen.getByTestId('reassign-caregiver-select');
    await user.selectOptions(select, 'cg-1');

    // Submit reassignment
    const submitBtn = screen.getByTestId('reassign-submit-button');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCheckConflicts).toHaveBeenCalledWith('visit-1', 'cg-1');
      expect(mockAssignCaregiver).toHaveBeenCalledWith('visit-1', 'cg-1', false);
    });
  });

  it('navigates to full visit details from the quick action modal', async () => {
    const user = userEvent.setup();
    render(<CalendarView />);

    const eventElement = screen.getByTestId('calendar-event-visit-2');
    await user.click(eventElement);

    const fullDetailsBtn = screen.getByText('Full Details');
    await user.click(fullDetailsBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/visits/visit-2');
  });

  it('filters visits when clicking a KPI chip', async () => {
    const user = userEvent.setup();
    render(<CalendarView />);

    // All 3 events are present
    expect(screen.getByTestId('calendar-event-visit-1')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-event-visit-2')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-event-visit-3')).toBeInTheDocument();

    // Filter by Unassigned
    const unassignedChip = screen.getByTestId('kpi-unassigned');
    await user.click(unassignedChip);

    // Only visit-1 (unassigned) is shown
    expect(screen.getByTestId('calendar-event-visit-1')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-event-visit-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-event-visit-3')).not.toBeInTheDocument();

    // Clear filter
    const clearBtn = screen.getByText('Clear filters');
    await user.click(clearBtn);

    expect(screen.getByTestId('calendar-event-visit-1')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-event-visit-2')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-event-visit-3')).toBeInTheDocument();
  });
});
