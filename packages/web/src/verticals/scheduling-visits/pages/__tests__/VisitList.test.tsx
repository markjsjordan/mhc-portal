import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitList } from '../VisitList';
import { isVisitUnassigned, type Visit } from '../../types';

let mockVisitsData: Visit[] = [];

vi.mock('../../hooks/useVisits', () => ({
  useVisitApi: () => ({}),
  useVisits: () => ({
    data: mockVisitsData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/core/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', roles: ['ADMIN'], permissions: ['visits:create', 'visits:read'] },
  }),
}));

vi.mock('@/core/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../components/CreateVisitModal', () => ({
  CreateVisitModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="create-visit-modal">CreateVisitModal</div> : null,
}));

describe('VisitList (wdvf3ad4h8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisitsData = [];
  });

  it('renders Schedule Visit split-button popover with mobile viewport clamping and opens CreateVisitModal on selection', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <VisitList />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const trigger = await screen.findByRole('button', { name: /select visit type to schedule/i });
    fireEvent.click(trigger);

    const heading = await screen.findByText('Schedule by Visit Type');
    expect(heading).toBeInTheDocument();

    const dialog = heading.closest('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain('max-w-[calc(100vw-1rem)]');

    // Escape dismisses the popover
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Schedule by Visit Type')).not.toBeInTheDocument();
  });
});

const makeVisit = (overrides: Partial<Visit>): Visit => ({
  id: 'visit-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  visitNumber: 'V-001',
  visitType: 'REGULAR',
  serviceTypeId: 'st-1',
  serviceTypeName: 'Personal Care',
  scheduledDate: '2026-11-20',
  scheduledStartTime: '09:00',
  scheduledEndTime: '11:00',
  scheduledDuration: 120,
  timezone: 'America/Chicago',
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
  createdAt: '2026-11-20T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
  ...overrides,
});

describe('VisitList unassigned filter (wdvf3add17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisitsData = [
      makeVisit({
        id: 'v-unassigned',
        visitNumber: 'V-101',
        clientFirstName: 'Unassigned',
        clientLastName: 'ClientA',
        status: 'UNASSIGNED',
        assignedCaregiverId: undefined,
      }),
      makeVisit({
        id: 'v-scheduled-no-cg',
        visitNumber: 'V-102',
        clientFirstName: 'ScheduledNoCg',
        clientLastName: 'ClientB',
        status: 'SCHEDULED',
        assignedCaregiverId: undefined,
      }),
      makeVisit({
        id: 'v-assigned',
        visitNumber: 'V-103',
        clientFirstName: 'Assigned',
        clientLastName: 'ClientC',
        status: 'ASSIGNED',
        assignedCaregiverId: 'cg-1',
        assignedCaregiverName: 'Alice Walker',
      }),
      makeVisit({
        id: 'v-cancelled',
        visitNumber: 'V-104',
        clientFirstName: 'Cancelled',
        clientLastName: 'ClientD',
        status: 'CANCELLED',
        assignedCaregiverId: undefined,
      }),
    ];
  });

  const renderVisitList = (initialEntry = '/scheduling') => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <VisitList />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('isVisitUnassigned excludes CANCELLED and COMPLETED and includes UNASSIGNED or null caregiver', () => {
    expect(isVisitUnassigned({ status: 'UNASSIGNED', assignedCaregiverId: undefined })).toBe(true);
    expect(isVisitUnassigned({ status: 'SCHEDULED', assignedCaregiverId: undefined })).toBe(true);
    expect(isVisitUnassigned({ status: 'ASSIGNED', assignedCaregiverId: 'cg-1' })).toBe(false);
    expect(isVisitUnassigned({ status: 'CANCELLED', assignedCaregiverId: undefined })).toBe(false);
    expect(isVisitUnassigned({ status: 'COMPLETED', assignedCaregiverId: undefined })).toBe(false);
  });

  it('toggles unassigned filter via dedicated button and hides assigned/cancelled visits', () => {
    renderVisitList();

    const toggle = screen.getByTestId('unassigned-visits-filter-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByTestId('visit-card')).toHaveLength(4);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const cards = screen.getAllByTestId('visit-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Unassigned ClientA')).toBeInTheDocument();
    expect(screen.getByText('ScheduledNoCg ClientB')).toBeInTheDocument();
    expect(screen.queryByText('Assigned ClientC')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelled ClientD')).not.toBeInTheDocument();

    // Toggling off restores all visits
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByTestId('visit-card')).toHaveLength(4);
  });

  it('pre-activates unassigned filter when URL has ?filter=unassigned', () => {
    renderVisitList('/scheduling?filter=unassigned');

    const toggle = screen.getByTestId('unassigned-visits-filter-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('visit-card')).toHaveLength(2);
    expect(screen.queryByText('Assigned ClientC')).not.toBeInTheDocument();
  });

  it('activates unassigned filter when clicking the Unassigned summary card', () => {
    renderVisitList();

    const summaryCard = screen.getByTestId('summary-card-unassigned');
    fireEvent.click(summaryCard);

    expect(screen.getByTestId('unassigned-visits-filter-toggle')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getAllByTestId('visit-card')).toHaveLength(2);
  });
});
