import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitDetailsPanel } from '../VisitDetailsPanel';
import type { Visit } from '../../types';

const mockUseVisit = vi.fn();
vi.mock('../../hooks/useVisits', () => ({
  useVisit: (id: string | undefined) => mockUseVisit(id),
}));

vi.mock('@/verticals/caregivers', () => ({
  useCaregiver: () => ({ data: undefined, isLoading: false }),
}));

const visit: Visit = {
  id: 'visit-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  visitNumber: 'VST-1',
  visitType: 'REGULAR',
  serviceTypeId: 'svc-1',
  serviceTypeName: 'Personal Care',
  scheduledDate: '2026-10-08T00:00:00.000Z',
  scheduledStartTime: '08:30',
  scheduledEndTime: '11:30',
  scheduledDuration: 180,
  timezone: 'America/New_York',
  clientFirstName: 'Ada',
  clientLastName: 'Lovelace',
  address: { line1: '1 Main St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
  status: 'SCHEDULED',
  isUrgent: false,
  isPriority: false,
  requiresSupervision: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const renderPanel = (props: Partial<React.ComponentProps<typeof VisitDetailsPanel>> = {}) => {
  const onClose = vi.fn();
  const client = new QueryClient();
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VisitDetailsPanel visitId="visit-1" onClose={onClose} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose, client, ...utils };
};

describe('VisitDetailsPanel', () => {
  beforeEach(() => {
    mockUseVisit.mockReset();
  });

  test('shows loading state while the detail fetch is in flight', () => {
    mockUseVisit.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderPanel();
    expect(screen.getByText('Loading visit details...')).toBeInTheDocument();
  });

  test('renders full details once loaded', () => {
    mockUseVisit.mockReturnValue({ data: visit, isLoading: false, error: null });
    renderPanel();
    expect(mockUseVisit).toHaveBeenCalledWith('visit-1');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
  });

  test('X button and Escape close the panel', () => {
    mockUseVisit.mockReturnValue({ data: visit, isLoading: false, error: null });
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('prev/next controls invoke handlers and disable when unavailable', () => {
    mockUseVisit.mockReturnValue({ data: visit, isLoading: false, error: null });
    const onNext = vi.fn();
    renderPanel({ onNext, positionLabel: '1 of 2' });
    expect(screen.getByRole('button', { name: 'Previous visit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next visit' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  test('shows an error state when details cannot be loaded', () => {
    mockUseVisit.mockReturnValue({ data: undefined, isLoading: false, error: new Error('403') });
    renderPanel();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('clears cached visit detail (PHI) on unmount', () => {
    mockUseVisit.mockReturnValue({ data: visit, isLoading: false, error: null });
    const { client, unmount } = renderPanel();
    client.setQueryData(['visits', 'detail', 'visit-1'], visit);
    unmount();
    expect(client.getQueryData(['visits', 'detail', 'visit-1'])).toBeUndefined();
  });

  test('renders caregiver full name when assigned and Unassigned when unassigned', () => {
    mockUseVisit.mockReturnValue({
      data: {
        ...visit,
        assignedCaregiverId: 'cg-1',
        caregiverFirstName: 'Elena',
        caregiverLastName: 'Rostova',
      },
      isLoading: false,
      error: null,
    });
    const { unmount } = renderPanel();
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    unmount();

    mockUseVisit.mockReturnValue({ data: visit, isLoading: false, error: null });
    renderPanel();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
