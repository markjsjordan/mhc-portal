import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitDetailPage } from '../VisitDetailPage';
import type { Visit } from '../../../verticals/scheduling-visits/types';

// Mock permissions
let mockCan = vi.fn().mockReturnValue(true);
let mockHasAnyRole = vi.fn().mockReturnValue(true);

vi.mock('@/core/hooks', () => ({
  usePermissions: () => ({
    can: mockCan,
    hasAnyRole: mockHasAnyRole,
  }),
  useApiClient: () => ({
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock visit hook
let mockVisitData: Visit | null = null;
vi.mock('../../../verticals/scheduling-visits', () => ({
  useVisit: () => ({
    data: mockVisitData,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useVisitApi: () => ({
    checkConflicts: vi.fn().mockResolvedValue({ hasConflicts: false, conflicts: [] }),
  }),
  useUpdateVisit: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  EditVisitModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" data-testid="mock-edit-visit-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
  VisitClockControl: () => <div data-testid="mock-visit-clock-control">Clock Control</div>,
}));

describe('VisitDetailPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockCan = vi.fn().mockReturnValue(true);
    mockHasAnyRole = vi.fn().mockReturnValue(true);
  });

  const renderPage = (visitId = 'vis-123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/scheduling/visits/${visitId}`]}>
          <Routes>
            <Route path="/scheduling/visits/:id" element={<VisitDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders Edit Visit button for scheduled visits when user has permission', () => {
    mockVisitData = {
      id: 'vis-123',
      visitNumber: 'VIS-2026-001',
      clientId: 'client-1',
      clientName: 'Margaret Thompson',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '18:10',
      scheduledEndTime: '21:10',
      scheduledDuration: 180,
      visitType: 'RESPITE',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-1',
      assignedCaregiverName: 'Sarah Jenkins',
      address: {
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    };

    renderPage();

    const editBtn = screen.getByTestId('edit-visit-button');
    expect(editBtn).toBeInTheDocument();
    expect(screen.queryByTestId('locked-visit-banner')).not.toBeInTheDocument();
  });

  it('opens EditVisitModal when Edit Visit button is clicked', () => {
    mockVisitData = {
      id: 'vis-123',
      visitNumber: 'VIS-2026-001',
      clientId: 'client-1',
      clientName: 'Margaret Thompson',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '18:10',
      scheduledEndTime: '21:10',
      scheduledDuration: 180,
      visitType: 'RESPITE',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-1',
      assignedCaregiverName: 'Sarah Jenkins',
      address: {
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    };

    renderPage();

    const editBtn = screen.getByTestId('edit-visit-button');
    fireEvent.click(editBtn);

    expect(screen.getByTestId('mock-edit-visit-modal')).toBeInTheDocument();
  });

  it('hides Edit Visit button and renders locked banner when visit is COMPLETED', () => {
    mockVisitData = {
      id: 'vis-123',
      visitNumber: 'VIS-2026-001',
      clientId: 'client-1',
      clientName: 'Margaret Thompson',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '18:10',
      scheduledEndTime: '21:10',
      scheduledDuration: 180,
      visitType: 'RESPITE',
      status: 'COMPLETED',
      assignedCaregiverId: 'cg-1',
      assignedCaregiverName: 'Sarah Jenkins',
      address: {
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    };

    renderPage();

    expect(screen.queryByTestId('edit-visit-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('locked-visit-banner')).toBeInTheDocument();
    expect(screen.getByText(/Visit Record Locked/i)).toBeInTheDocument();
  });

  it('hides Edit Visit button when user lacks scheduling permissions', () => {
    mockCan = vi.fn().mockReturnValue(false);
    mockHasAnyRole = vi.fn().mockReturnValue(false);

    mockVisitData = {
      id: 'vis-123',
      visitNumber: 'VIS-2026-001',
      clientId: 'client-1',
      clientName: 'Margaret Thompson',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '18:10',
      scheduledEndTime: '21:10',
      scheduledDuration: 180,
      visitType: 'RESPITE',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-1',
      assignedCaregiverName: 'Sarah Jenkins',
      address: {
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    };

    renderPage();

    expect(screen.queryByTestId('edit-visit-button')).not.toBeInTheDocument();
  });

  it('renders VisitClockControl and correct client demographics for non-hardcoded clients', () => {
    mockVisitData = {
      id: 'vis-mark-1',
      visitNumber: 'V2026-000001',
      clientId: 'client-mark-jordan',
      clientFirstName: 'Mark',
      clientLastName: 'Jordan',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '09:00',
      scheduledEndTime: '11:00',
      scheduledDuration: 120,
      visitType: 'REGULAR',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-1',
      address: {
        line1: '121 East Case Street',
        city: 'Negaunee',
        state: 'MI',
        postalCode: '49866',
      },
    };

    renderPage('vis-mark-1');

    expect(screen.getByTestId('mock-visit-clock-control')).toBeInTheDocument();
    expect(screen.getByText('Mark Jordan')).toBeInTheDocument();
    expect(screen.queryByText('Margaret Thompson')).not.toBeInTheDocument();
  });
});
