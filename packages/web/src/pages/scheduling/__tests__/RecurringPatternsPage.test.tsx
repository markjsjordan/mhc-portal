import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecurringPatternsPage from '../RecurringPatternsPage.js';
import type { PatternListItem } from '@folkcare/scheduling-visits';

const mockPatterns: PatternListItem[] = [
  {
    id: 'pat-1',
    organizationId: 'org-1',
    clientId: 'client-1',
    clientName: 'Eleanor Vance',
    caregiverId: 'cg-1',
    caregiverName: 'Sarah Jenkins',
    serviceTypeId: 'st-1',
    serviceTypeName: 'Personal Care',
    frequency: 'WEEKLY',
    dayOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startTime: '09:00',
    duration: 120,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    recurrenceSummary: 'Mon, Wed, Fri 9:00 AM - 11:00 AM (Weekly)',
    visitStats: {
      totalGenerated: 12,
      futureScheduled: 8,
      completed: 4,
    },
    createdAt: '2026-10-01T00:00:00Z',
    createdBy: 'usr-1',
    updatedAt: '2026-10-01T00:00:00Z',
    updatedBy: 'usr-1',
  },
  {
    id: 'pat-2',
    organizationId: 'org-1',
    clientId: 'client-2',
    clientName: 'Harold Miller',
    caregiverId: null,
    caregiverName: null,
    serviceTypeId: 'st-2',
    serviceTypeName: 'Companionship',
    frequency: 'WEEKLY',
    dayOfWeek: ['TUESDAY', 'THURSDAY'],
    startTime: '13:00',
    duration: 60,
    startDate: '2026-10-01',
    endDate: null,
    status: 'PAUSED',
    pauseReason: 'Client temporary hospital stay',
    pausedAt: '2026-10-15T00:00:00Z',
    recurrenceSummary: 'Tue, Thu 1:00 PM - 2:00 PM (Weekly)',
    visitStats: {
      totalGenerated: 6,
      futureScheduled: 0,
      completed: 6,
    },
    createdAt: '2026-10-01T00:00:00Z',
    createdBy: 'usr-1',
    updatedAt: '2026-10-15T00:00:00Z',
    updatedBy: 'usr-1',
  },
];

const mockPause = vi.fn().mockResolvedValue({});
const mockResume = vi.fn().mockResolvedValue({});
const mockEnd = vi.fn().mockResolvedValue({});
const mockRefetch = vi.fn();

vi.mock('@/core/hooks/index', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/core/hooks/permissions', () => ({
  usePermissions: () => ({
    can: () => true,
    hasRole: () => true,
  }),
}));

vi.mock('@/verticals/scheduling-visits/hooks/usePatterns', () => ({
  usePatterns: () => ({
    data: {
      patterns: mockPatterns,
      total: 2,
    },
    isLoading: false,
    refetch: mockRefetch,
  }),
  usePatternMutations: () => ({
    pausePattern: mockPause,
    resumePattern: mockResume,
    endPattern: mockEnd,
    isEnding: false,
  }),
}));

vi.mock('@/verticals/caregivers/hooks/useCaregivers', () => ({
  useCaregivers: () => ({
    caregivers: [
      { id: 'cg-1', firstName: 'Sarah', lastName: 'Jenkins', role: 'HHA' },
    ],
    isLoading: false,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecurringPatternsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RecurringPatternsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recurring patterns table with clients and unassigned badges', () => {
    renderPage();

    expect(screen.getByText('Scheduling & Visits')).toBeInTheDocument();
    expect(screen.getByText('Eleanor Vance')).toBeInTheDocument();
    expect(screen.getByText('Harold Miller')).toBeInTheDocument();

    // Sarah Jenkins assigned for pat-1
    expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();

    // pat-2 has null caregiver -> Unassigned badge (plus filter button)
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(1);

    // Status badges (and tab buttons)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Paused').length).toBeGreaterThanOrEqual(1);
  });

  it('displays navigation tabs and count indicator', () => {
    renderPage();

    expect(screen.getByText('Visits List')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Recurring Patterns')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 2 recurring pattern(s)')).toBeInTheDocument();
  });

  it('allows clicking Resume for paused pattern', async () => {
    renderPage();

    const resumeBtn = screen.getByRole('button', { name: /Resume/i });
    expect(resumeBtn).toBeInTheDocument();
    fireEvent.click(resumeBtn);

    expect(mockResume).toHaveBeenCalledWith({ id: 'pat-2' });
  });
});
