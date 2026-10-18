import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduleBuilderPage from '../ScheduleBuilderPage.js';

// Mock the hooks
const mockUseIsMobile = vi.fn();
vi.mock('@/core/hooks', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('@/verticals/caregivers/hooks/useCaregivers', () => ({
  useCaregivers: () => ({
    caregivers: [
      { id: 'cg-1', firstName: 'Alice', lastName: 'Walker', role: 'RN' },
      { id: 'cg-2', firstName: 'Bob', lastName: 'Smith', role: 'HHA' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/verticals/scheduling-visits/hooks/useVisits', () => ({
  useCalendarVisits: () => ({
    visits: [
      {
        id: 'visit-1',
        clientId: 'client-1',
        clientFirstName: 'John',
        clientLastName: 'Doe',
        assignedCaregiverId: null,
        scheduledDate: '2026-10-18T09:00:00.000Z',
        startTime: '09:00',
        endTime: '11:00',
        status: 'SCHEDULED',
        visitType: 'SKILLED_NURSING',
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
    clients: [
      {
        id: 'client-1',
        firstName: 'John',
        lastName: 'Doe',
        primaryAddress: { state: 'FL' },
      },
    ],
    isLoading: false,
  }),
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
});
