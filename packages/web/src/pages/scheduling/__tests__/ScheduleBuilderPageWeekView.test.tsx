import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduleBuilderPage from '../ScheduleBuilderPage.js';

// Mock the hooks
const mockUseIsMobile = vi.fn();
vi.mock('@/core/hooks', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('@/core/hooks/useTimezone.js', () => ({
  useTimezone: () => ({
    timezone: 'America/New_York',
    formatDateTime: vi.fn(),
    toLocal: vi.fn(),
    getAbbreviation: () => 'EDT',
    getOffset: () => '-04:00',
  }),
}));

vi.mock('@/verticals/caregivers/hooks/useCaregivers', () => ({
  useCaregivers: () => ({
    data: {
      items: [
        { id: 'cg-1', firstName: 'Alice', lastName: 'Walker', role: 'RN' },
        { id: 'cg-2', firstName: 'Bob', lastName: 'Smith', role: 'HHA' },
      ],
      total: 2,
    },
    isLoading: false,
  }),
}));

vi.mock('@/verticals/scheduling-visits/hooks/useVisits', () => ({
  useCalendarVisits: () => ({
    data: [
      {
        id: 'visit-1',
        clientId: 'client-1',
        clientFirstName: 'John',
        clientLastName: 'Doe',
        assignedCaregiverId: 'cg-1',
        scheduledDate: '2026-11-03T09:00:00.000Z',
        scheduledStartTime: '09:00',
        scheduledEndTime: '17:00',
        scheduledDuration: 480, // 8 hours
        status: 'ASSIGNED',
        visitType: 'REGULAR',
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useVisitApi: () => ({
    assignCaregiver: vi.fn(),
    unassignCaregiver: vi.fn(),
  }),
  useCaregiverAvailability: () => ({
    data: [{ caregiver_id: 'cg-1', available: true }],
  }),
}));

vi.mock('@/verticals/client-demographics/hooks/useClients', () => ({
  useClients: () => ({
    data: {
      items: [
        {
          id: 'client-1',
          firstName: 'John',
          lastName: 'Doe',
          primaryAddress: { state: 'FL' },
        },
      ],
      total: 1,
    },
    isLoading: false,
  }),
}));

describe('ScheduleBuilderPage week view and day-cell wiring (wdvf3acuka)', () => {
  let queryClient: QueryClient;

  // Fixed clock: the week view opens on the current week and the fixture visit is
  // dated Tue 2026-11-03. Without this the suite fails once that week has passed.
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ScheduleBuilderPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('toggles into week view and renders CaregiverWeekGrid', () => {
    renderComponent();

    // Find and click the Week toggle button
    const weekButtons = screen.getAllByRole('button', { name: /^week$/i });
    fireEvent.click(weekButtons[0]!);

    // Should render caregivers table and Total Hours sort button from CaregiverWeekGrid
    expect(screen.getByText('Total Hours')).toBeInTheDocument();
    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('clicking a day cell switches to day view and focuses on that caregiver, with option to clear focus', () => {
    renderComponent();

    // Toggle to week view
    const weekButtons = screen.getAllByRole('button', { name: /^week$/i });
    fireEvent.click(weekButtons[0]!);

    // In week view, find the cell for Alice Walker on Tuesday Nov 3 (8 hours)
    const dayCell = screen.getByRole('button', {
      name: /Alice Walker, Tue Nov 3, 8 hours/i,
    });
    expect(dayCell).toBeInTheDocument();

    // Click the day cell
    fireEvent.click(dayCell);

    // Should switch to Day view and show the focus banner
    expect(screen.getByText(/Focusing on:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Alice Walker').length).toBeGreaterThanOrEqual(1);

    // Only Alice Walker should be visible in the day grid
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();

    // Click "Show all caregivers" to clear focus
    const showAllButton = screen.getByRole('button', { name: /show all caregivers/i });
    fireEvent.click(showAllButton);

    // Focus banner removed and both caregivers visible again
    expect(screen.queryByText(/Focusing on:/i)).not.toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('provides week navigation controls (prev, next, today)', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next week/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next week/i }));
    fireEvent.click(screen.getByRole('button', { name: /previous week/i }));
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
  });
});
