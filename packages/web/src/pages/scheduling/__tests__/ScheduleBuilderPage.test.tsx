import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduleBuilderPage from '../ScheduleBuilderPage.js';

// Mock the hooks
vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => mockToastError(...a), success: vi.fn() },
}));

const mockUseIsMobile = vi.fn();
vi.mock('@/core/hooks', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('@/verticals/caregivers/hooks/useCaregivers', () => ({
  useCaregivers: () => ({
    data: {
      items: [
        { id: 'cg-1', firstName: 'Alice', lastName: 'Walker', role: 'RN' },
        { id: 'cg-2', firstName: 'Bob', lastName: 'Smith', role: 'HHA' },
      ],
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
        assignedCaregiverId: null,
        scheduledDate: '2026-10-18T09:00:00.000Z',
        scheduledStartTime: '09:00',
        scheduledEndTime: '11:00',
        scheduledDuration: 7200,
        status: 'SCHEDULED',
        visitType: 'SKILLED_NURSING',
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useVisitApi: () => ({
    assignCaregiver: (...args: unknown[]) => mockAssign(...args),
    unassignCaregiver: (...args: unknown[]) => mockAssign(...args),
    createPattern: (...args: unknown[]) => mockCreatePattern(...args),
  }),
  useCaregiverAvailability: () => mockAvailability(),
}));

const { mockCreatePattern, mockClientsReturn, mockAvailability, mockAssign, mockToastError } = vi.hoisted(() => ({
  mockAvailability: vi.fn(() => ({
    data: [{ caregiver_id: 'cg-1', available: true }] as Array<{ caregiver_id: string; available: boolean }> | undefined,
    isLoading: false,
  })),
  mockAssign: vi.fn(),
  mockToastError: vi.fn(),
  mockCreatePattern: vi.fn().mockResolvedValue({ generatedVisitsCount: 4 }),
  mockClientsReturn: vi.fn(() => ({
    data: {
      items: [
        {
          id: 'client-1',
          firstName: 'John',
          lastName: 'Doe',
          primaryAddress: { state: 'FL' },
        },
      ],
    },
    isLoading: false,
  })),
}));

vi.mock('@/verticals/client-demographics/hooks/useClients', () => ({
  useClients: () => mockClientsReturn(),
}));

describe('ScheduleBuilderPage responsive header (wdvf3abp4v)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('Mobile layout (isMobile = true, 320px–430px)', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it('renders header controls stacked vertically on mobile', () => {
      const { container } = renderComponent();

      const header = container.querySelector('.schedule-builder-header') as HTMLElement;
      expect(header).toBeInTheDocument();
      expect(header.style.flexDirection).toBe('column');
      expect(header.style.alignItems).toBe('stretch');

      const controls = container.querySelector('.schedule-builder-controls') as HTMLElement;
      expect(controls).toBeInTheDocument();
      expect(controls.style.flexDirection).toBe('column');
      expect(controls.style.alignItems).toBe('stretch');
      expect(controls.style.width).toBe('100%');
    });

    it('places Day/Week toggle and Date select on one row on mobile', () => {
      const { container } = renderComponent();

      const controlsRow = container.querySelector('.schedule-builder-controls-row') as HTMLElement;
      expect(controlsRow).toBeInTheDocument();
      expect(controlsRow.style.display).toBe('flex');
      expect(controlsRow.style.width).toBe('100%');

      // Check toggle buttons inside row
      const dayButton = screen.getByRole('button', { name: /^Day$/i });
      const weekButton = screen.getByRole('button', { name: /^Week$/i });
      expect(controlsRow).toContainElement(dayButton);
      expect(controlsRow).toContainElement(weekButton);

      // Check date select inside row
      const dateSelect = container.querySelector('.schedule-builder-date-select') as HTMLSelectElement;
      expect(dateSelect).toBeInTheDocument();
      expect(controlsRow).toContainElement(dateSelect);
      expect(dateSelect.style.flex).toMatch(/^1/);
      expect(dateSelect.style.minHeight).toBe('44px');
    });

    it('renders "+ Recurring Schedule" full-width with minimum 44px tap target and complete text', () => {
      renderComponent();

      const recurringBtn = screen.getByRole('button', { name: /\+ Recurring Schedule/i });
      expect(recurringBtn).toBeInTheDocument();
      expect(recurringBtn.textContent?.trim()).toBe('+ Recurring Schedule');
      expect(recurringBtn.style.width).toBe('100%');
      expect(recurringBtn.style.minHeight).toBe('44px');
    });

    it('renders "Schedule Supervision Visit" full-width with minimum 44px tap target', () => {
      renderComponent();

      const supervisionBtn = screen.getByRole('button', { name: /Schedule Supervision Visit/i });
      expect(supervisionBtn).toBeInTheDocument();
      expect(supervisionBtn.textContent?.trim()).toBe('Schedule Supervision Visit');
      expect(supervisionBtn.style.width).toBe('100%');
      expect(supervisionBtn.style.minHeight).toBe('44px');
    });

    it('ensures Day and Week toggle buttons have >= 44px tap target on mobile', () => {
      renderComponent();

      const dayButton = screen.getByRole('button', { name: /^Day$/i });
      const weekButton = screen.getByRole('button', { name: /^Week$/i });

      expect(dayButton.style.minHeight).toBe('44px');
      expect(dayButton.style.minWidth).toBe('44px');
      expect(weekButton.style.minHeight).toBe('44px');
      expect(weekButton.style.minWidth).toBe('44px');
    });

    it('sets container to prevent horizontal overflow on mobile', () => {
      const { container } = renderComponent();

      const rootContainer = container.querySelector('.schedule-builder-container') as HTMLElement;
      expect(rootContainer).toBeInTheDocument();
      expect(rootContainer.style.overflowX).toBe('hidden');
      expect(rootContainer.style.maxWidth).toBe('100%');
    });
  });

  describe('Desktop layout (isMobile = false, >= 768px)', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(false);
    });

    it('preserves desktop horizontal header and controls layout', () => {
      const { container } = renderComponent();

      const header = container.querySelector('.schedule-builder-header') as HTMLElement;
      expect(header).toBeInTheDocument();
      expect(header.style.display).toBe('flex');
      expect(header.style.justifyContent).toBe('space-between');
      expect(header.style.alignItems).toBe('flex-start');

      const controls = container.querySelector('.schedule-builder-controls') as HTMLElement;
      expect(controls).toBeInTheDocument();
      expect(controls.style.display).toBe('flex');
      expect(controls.style.gap).toBe('12px');
      expect(controls.style.alignItems).toBe('center');

      // No separate controls-row container in desktop
      const controlsRow = container.querySelector('.schedule-builder-controls-row');
      expect(controlsRow).toBeNull();

      // Recurring button does not have 100% width on desktop
      const recurringBtn = screen.getByRole('button', { name: /\+ Recurring Schedule/i });
      expect(recurringBtn.style.width).not.toBe('100%');
    });
  });

  describe('CreateRecurringPatternModal', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(false);
      mockCreatePattern.mockClear();
      mockClientsReturn.mockReturnValue({
        data: {
          items: [
            {
              id: 'client-1',
              firstName: 'John',
              lastName: 'Doe',
              primaryAddress: { state: 'FL' },
            },
          ],
        },
      });
    });

    it('shows validation error and sends no request when submitted without a client', async () => {
      mockClientsReturn.mockReturnValue({ data: { items: [] } });
      renderComponent();

      fireEvent.click(screen.getByRole('button', { name: /\+ Recurring Schedule/i }));
      const submitBtn = screen.getByRole('button', { name: /Generate Recurring Visits/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByRole('alert')).toHaveTextContent('Please select a client');
      expect(mockCreatePattern).not.toHaveBeenCalled();
    });

    it('submits real clientId and serviceTypeId without hardcoded org/branch UUIDs', async () => {
      renderComponent();

      fireEvent.click(screen.getByRole('button', { name: /\+ Recurring Schedule/i }));
      const submitBtn = screen.getByRole('button', { name: /Generate Recurring Visits/i });
      fireEvent.click(submitBtn);

      await vi.waitFor(() => {
        expect(mockCreatePattern).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreatePattern.mock.calls[0]![0] as {
        clientId: string;
        serviceTypeId: string;
        serviceTypeCode?: string;
        serviceTypeName?: string;
      };
      expect(payload.clientId).toBe('client-1');
      expect(payload.clientId).not.toBe('00000000-0000-0000-0000-000000000001');
      expect(payload.serviceTypeId).toBe('00000000-0000-4000-8000-00000005ec01');
      expect(payload.serviceTypeId).not.toBe('00000000-0000-0000-0000-000000000002');
      expect(payload.serviceTypeCode).toBe('PC');
      expect(payload.serviceTypeName).toBe('Personal Care');
    });
  });

  describe('Availability guard (wdvf3adceg)', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(false);
      mockAssign.mockClear();
      mockToastError.mockClear();
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-18T16:00:00.000Z') });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('treats all caregivers as unavailable while availability is loading', () => {
      mockAvailability.mockReturnValue({ data: undefined, isLoading: true });
      renderComponent();

      expect(screen.getAllByText('Unavailable')).toHaveLength(2);
      expect(screen.getByText('Loading availability...')).toBeInTheDocument();
    });

    it('treats all caregivers as available when loaded with an empty array', () => {
      mockAvailability.mockReturnValue({ data: [], isLoading: false });
      renderComponent();

      expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading availability...')).not.toBeInTheDocument();
    });

    it('shows an error toast and does not assign when dropping on an unavailable caregiver', async () => {
      mockAvailability.mockReturnValue({
        data: [{ caregiver_id: 'cg-1', available: true }],
        isLoading: false,
      });
      const { container } = renderComponent();

      const draggable = container.querySelector('[draggable="true"]') as HTMLElement;
      expect(draggable).not.toBeNull();
      fireEvent.dragStart(draggable);

      // cg-2 (Bob) is the second caregiver column; drop on its first slot
      const bobHeader = screen.getByText('Bob Smith').closest('div')?.parentElement as HTMLElement;
      const slot = bobHeader.children[1] as HTMLElement;
      fireEvent.drop(slot);

      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Cannot assign: caregiver is not available for this time slot'
        );
      });
      expect(mockAssign).not.toHaveBeenCalled();
    });
  });
});
