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

  it('dynamically derives care tasks and shows 0% progress for a scheduled skilled nursing visit', () => {
    mockVisitData = {
      id: 'vis-nursing-1',
      visitNumber: 'VST-NURS-01',
      clientId: 'client-nursing',
      clientFirstName: 'Eleanor',
      clientLastName: 'Vance',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '08:00 AM',
      scheduledEndTime: '10:00 AM',
      scheduledDuration: 120,
      serviceTypeId: 'svc-nursing',
      serviceTypeName: 'Skilled Nursing & Wound Care',
      visitType: 'SUPERVISION',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-1',
      address: {
        line1: '100 Nursing Way',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    };

    renderPage('vis-nursing-1');

    // Tasks should reflect Skilled Nursing, NOT the hardcoded morning shower
    expect(screen.getByText(/Clinical assessment of vital signs/i)).toBeInTheDocument();
    expect(screen.getByText(/Medication administration & reconciliation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Assist with morning shower and dressing/i)).not.toBeInTheDocument();

    // Progress bar for scheduled visit starts at 0%
    expect(screen.getByText(/0 of 4 completed \(0%\)/i)).toBeInTheDocument();

    // EVV verification reflects SCHEDULED status with planned method
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('GPS Mobile App (Planned)')).toBeInTheDocument();
    expect(screen.getByText('Pending arrival')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument(); // actual clock-in
  });

  it('dynamically renders EVV records, verified status, and completed progress for COMPLETED visits', () => {
    mockVisitData = {
      id: 'vis-completed-1',
      visitNumber: 'VST-COMP-01',
      clientId: 'client-comp',
      clientFirstName: 'Robert',
      clientLastName: 'Chen',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '08:30 AM',
      scheduledEndTime: '11:30 AM',
      scheduledDuration: 180,
      actualStartTime: '08:24 AM',
      actualEndTime: '11:30 AM',
      actualDuration: 186,
      serviceTypeId: 'svc-personal-care',
      serviceTypeName: 'Personal Care & Assistance',
      visitType: 'REGULAR',
      status: 'COMPLETED',
      assignedCaregiverId: 'cg-1',
      address: {
        line1: '456 Maple St',
        city: 'Eugene',
        state: 'OR',
        postalCode: '97401',
      },
      evv: {
        verified: true,
        verificationMethod: 'GPS',
        geofenceStatus: 'VERIFIED',
        distanceMeters: 14,
        clockInTime: '08:24 AM',
      },
    } as any;

    renderPage('vis-completed-1');

    // EVV status is VERIFIED
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    expect(screen.getByText('GPS Mobile App')).toBeInTheDocument();
    expect(screen.getByText(/Within 100m \(14m dist\)/i)).toBeInTheDocument();
    expect(screen.getByText('08:24 AM')).toBeInTheDocument();

    // All tasks completed for COMPLETED visit
    expect(screen.getByText(/4 of 4 completed \(100%\)/i)).toBeInTheDocument();
  });

  it('interactively toggles tasks and accurately recalculates progress bar', () => {
    mockVisitData = {
      id: 'vis-toggle-1',
      visitNumber: 'VST-TOGGLE-01',
      clientId: 'client-toggle',
      clientFirstName: 'Jane',
      clientLastName: 'Doe',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '09:00 AM',
      scheduledEndTime: '11:00 AM',
      scheduledDuration: 120,
      serviceTypeId: 'svc-personal-care',
      serviceTypeName: 'Personal Care & Assistance',
      visitType: 'REGULAR',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-1',
      address: {
        line1: '789 Oak Ave',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    };

    renderPage('vis-toggle-1');

    // Initially 0 of 4
    expect(screen.getByText(/0 of 4 completed \(0%\)/i)).toBeInTheDocument();

    // Click first task to complete it
    const firstTask = screen.getByText(/Assist with morning shower/i);
    fireEvent.click(firstTask);

    // Progress updates to 1 of 4 (25%)
    expect(screen.getByText(/1 of 4 completed \(25%\)/i)).toBeInTheDocument();

    // Click second task to complete it
    const secondTask = screen.getByText(/Prepare low-sodium breakfast/i);
    fireEvent.click(secondTask);

    // Progress updates to 2 of 4 (50%)
    expect(screen.getByText(/2 of 4 completed \(50%\)/i)).toBeInTheDocument();

    // Click first task again to uncheck it
    fireEvent.click(firstTask);

    // Progress updates back to 1 of 4 (25%)
    expect(screen.getByText(/1 of 4 completed \(25%\)/i)).toBeInTheDocument();
  });

  it('displays caregiver full name in plain English and never shows raw caregiver ID', () => {
    mockVisitData = {
      id: 'vis-cg-name-1',
      visitNumber: 'VST-CG-01',
      clientId: 'client-1',
      clientFirstName: 'Margaret',
      clientLastName: 'Thompson',
      scheduledDate: '2026-10-25',
      scheduledStartTime: '09:00 AM',
      scheduledEndTime: '11:00 AM',
      scheduledDuration: 120,
      serviceTypeId: 'svc-personal-care',
      serviceTypeName: 'Personal Care & Assistance',
      visitType: 'REGULAR',
      status: 'SCHEDULED',
      assignedCaregiverId: 'cg-201',
      caregiverFirstName: 'Sarah',
      caregiverLastName: 'Jenkins',
      address: {
        line1: '789 Oak Ave',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
      },
    } as any;

    renderPage('vis-cg-name-1');

    expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    expect(screen.queryByText(/ID:\s*cg-201/i)).not.toBeInTheDocument();
  });
});
