import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditVisitModal } from '../EditVisitModal';
import type { Visit } from '../../types';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API client & hooks
const mockGet = vi.fn();
const mockMutateAsync = vi.fn();
const mockCheckConflicts = vi.fn();

vi.mock('@/core/hooks', () => ({
  useApiClient: () => ({
    get: mockGet,
  }),
}));

vi.mock('../../hooks/useVisits', () => ({
  useVisitApi: () => ({
    checkConflicts: mockCheckConflicts,
  }),
  useUpdateVisit: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const mockVisit: Visit = {
  id: 'visit-123',
  clientId: 'client-456',
  clientName: 'Margaret Thompson',
  scheduledDate: '2026-10-25',
  scheduledStartTime: '18:10',
  scheduledEndTime: '21:10',
  scheduledDuration: 180,
  visitType: 'RESPITE',
  serviceTypeId: 'svc-respite',
  serviceTypeName: 'Respite Care',
  status: 'SCHEDULED',
  assignedCaregiverId: 'cg-789',
  assignedCaregiverName: 'Sarah Jenkins',
  internalNotes: 'Patient requires transfer assistance.',
};

describe('EditVisitModal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGet.mockResolvedValue([
      { id: 'cg-789', first_name: 'Sarah', last_name: 'Jenkins', status: 'ACTIVE' },
      { id: 'cg-999', first_name: 'Alex', last_name: 'Rivera', status: 'ACTIVE' },
    ]);

    mockCheckConflicts.mockResolvedValue({
      hasConflicts: false,
      conflicts: [],
    });
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof EditVisitModal>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <EditVisitModal
          visit={mockVisit}
          isOpen={true}
          onClose={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders modal with initial visit data pre-populated', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Scheduled Visit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-10-25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('18:10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('180 minutes (3 hr)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Patient requires transfer assistance.')).toBeInTheDocument();
  });

  it('calculates end time dynamically when duration changes', async () => {
    renderModal();

    // Initial end time is 21:10 (18:10 + 180 mins)
    expect(screen.getByText('21:10')).toBeInTheDocument();

    const durationSelect = screen.getByLabelText(/Duration/i);
    fireEvent.click(durationSelect);
    const option = await screen.findByRole('option', { name: /^60 minutes/i });
    fireEvent.click(option);

    // New calculated end time should be 19:10 (18:10 + 60 mins)
    expect(screen.getByText('19:10')).toBeInTheDocument();
  });

  it('submits updated payload and calls onSaved callback', async () => {
    const handleSaved = vi.fn();
    const handleClose = vi.fn();
    mockMutateAsync.mockResolvedValueOnce({
      ...mockVisit,
      scheduledDate: '2026-10-26',
      scheduledStartTime: '09:00',
      scheduledDuration: 120,
    });

    renderModal({ onSaved: handleSaved, onClose: handleClose });

    const dateInput = screen.getByLabelText(/Scheduled Date/i);
    fireEvent.change(dateInput, { target: { value: '2026-10-26' } });

    const startInput = screen.getByLabelText(/Start Time/i);
    fireEvent.change(startInput, { target: { value: '09:00' } });

    const durationSelect = screen.getByLabelText(/Duration/i);
    fireEvent.click(durationSelect);
    const option = await screen.findByRole('option', { name: /120 minutes/i });
    fireEvent.click(option);

    const saveButton = screen.getByTestId('save-visit-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        visitId: 'visit-123',
        data: expect.objectContaining({
          scheduledDate: '2026-10-26',
          scheduledStartTime: '09:00',
          scheduledEndTime: '11:00',
          duration: 120,
          visitType: 'RESPITE',
        }),
      });
      expect(handleSaved).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays locked compliance alert and disables saving when visit is COMPLETED', () => {
    const completedVisit: Visit = {
      ...mockVisit,
      status: 'COMPLETED',
    };

    renderModal({ visit: completedVisit });

    expect(screen.getByTestId('edit-locked-banner')).toBeInTheDocument();
    expect(screen.getByText(/Visit Record Locked/i)).toBeInTheDocument();
    expect(screen.getByText(/21st Century Cures Act/i)).toBeInTheDocument();

    const saveButton = screen.getByTestId('save-visit-button');
    expect(saveButton).toBeDisabled();
  });

  it('displays locked compliance alert when visit has EVV actualStartTime recorded', () => {
    const clockedInVisit: Visit = {
      ...mockVisit,
      status: 'IN_PROGRESS',
      actualStartTime: '2026-10-25T18:12:00Z',
    };

    renderModal({ visit: clockedInVisit });

    expect(screen.getByTestId('edit-locked-banner')).toBeInTheDocument();
    const saveButton = screen.getByTestId('save-visit-button');
    expect(saveButton).toBeDisabled();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    renderModal({ onClose: handleClose });

    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows warning alert when a scheduling conflict is detected for caregiver', async () => {
    mockCheckConflicts.mockResolvedValueOnce({
      hasConflicts: true,
      conflicts: [
        {
          id: 'conflict-1',
          scheduled_start_time: '18:00',
          scheduled_end_time: '20:00',
        },
      ],
    });

    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('conflict-warning')).toBeInTheDocument();
      expect(screen.getByText(/Scheduling Conflict Detected/i)).toBeInTheDocument();
    });
  });

  it('enforces minimum 44px tap targets for mobile accessibility', () => {
    renderModal();

    const closeBtn = screen.getByLabelText('Close dialog');
    expect(closeBtn.className).toContain('min-h-[44px]');

    const dateInput = screen.getByLabelText(/Scheduled Date/i);
    expect(dateInput.className).toContain('min-h-[44px]');

    const saveBtn = screen.getByTestId('save-visit-button');
    expect(saveBtn.className).toContain('min-h-[44px]');
  });
});
