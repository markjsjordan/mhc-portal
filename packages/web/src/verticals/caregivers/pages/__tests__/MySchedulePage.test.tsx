import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MySchedulePage } from '../MySchedulePage.js';
import { ProtectedRoute } from '@/core/components/ProtectedRoute.js';
import * as caregiverAvailabilityModule from '../../services/caregiver-availability-api.js';
import * as hooks from '@/core/hooks/index.js';

// Mock AppShell to keep tests scoped and fast
vi.mock('@/app/components/AppShell.js', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

// Mock auth and permissions
vi.mock('@/core/hooks', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/core/hooks');
  return {
    ...actual,
    useAuth: vi.fn(),
    usePermissions: vi.fn(),
    useApiClient: vi.fn(() => ({
      get: vi.fn(),
      put: vi.fn(),
    })),
  };
});

describe('MySchedulePage', () => {
  let queryClient: QueryClient;
  let mockSaveAvailability: ReturnType<typeof vi.fn>;
  let mockRefetch: ReturnType<typeof vi.fn>;

  const defaultAvailabilityData: caregiverAvailabilityModule.ResolvedCaregiverAvailability = {
    schedule: {
      monday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00' }] },
      tuesday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00' }] },
      wednesday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00' }] },
      thursday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00' }] },
      friday: { available: true, timeSlots: [{ startTime: '09:00', endTime: '17:00' }] },
      saturday: { available: false, timeSlots: [] },
      sunday: { available: false, timeSlots: [] },
    },
    editable: true,
    cutoffAt: '2026-11-15T18:00:00Z',
    conflicts: [],
    version: 1,
    source: 'TEMPLATE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockSaveAvailability = vi.fn().mockResolvedValue({
      success: true,
      version: 2,
      schedule: defaultAvailabilityData.schedule,
    });
    mockRefetch = vi.fn().mockResolvedValue({ data: defaultAvailabilityData });

    vi.spyOn(caregiverAvailabilityModule, 'useMyAvailability').mockReturnValue({
      data: defaultAvailabilityData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      saveAvailability: mockSaveAvailability,
      isSaving: false,
      saveError: null,
    } as any);

    vi.mocked(hooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      isInitializing: false,
      user: { id: 'u-1', email: 'caregiver@example.com', roles: ['CAREGIVER'], permissions: ['availability:read-own', 'availability:update-own'] } as any,
      token: 'test-token',
      login: vi.fn(),
      logout: vi.fn(),
      setInitializing: vi.fn(),
    });

    vi.mocked(hooks.usePermissions).mockReturnValue({
      can: vi.fn(() => true),
      canAny: vi.fn(() => true),
      canAll: vi.fn(() => true),
      hasRole: vi.fn((role: string) => role === 'CAREGIVER'),
      hasAnyRole: vi.fn((roles: string[]) => roles.includes('CAREGIVER')),
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/caregiver/schedule']}>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders required copy and disclosures exactly', () => {
    renderWithProviders(<MySchedulePage />);

    expect(screen.getByText('Availability — not a confirmed shift')).toBeInTheDocument();
    expect(screen.getByText(/Worked time is recorded only through check-in\/check-out and is not set here/i)).toBeInTheDocument();
  });

  it('locked week shows cutoff and disables save', () => {
    vi.spyOn(caregiverAvailabilityModule, 'useMyAvailability').mockReturnValue({
      data: {
        ...defaultAvailabilityData,
        editable: false,
        cutoffAt: '2026-11-01T23:59:59Z',
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      saveAvailability: mockSaveAvailability,
      isSaving: false,
      saveError: null,
    } as any);

    renderWithProviders(<MySchedulePage />);

    expect(screen.getByTestId('schedule-locked-banner')).toBeInTheDocument();
    expect(screen.getByText(/The availability cutoff for this week was/i)).toBeInTheDocument();
    
    const saveButton = screen.getByRole('button', { name: /save availability/i });
    expect(saveButton).toBeDisabled();
  });

  it('conflict response renders ConflictBanner with date/time only (no client names)', async () => {
    const conflictError = {
      code: 'AVAILABILITY_CONFLICT_BOOKED_VISITS',
      response: {
        data: {
          code: 'AVAILABILITY_CONFLICT_BOOKED_VISITS',
          conflicts: [
            {
              visitId: 'visit-999',
              date: '2026-11-02',
              start: '10:00',
              end: '14:00',
            },
          ],
        },
      },
    };

    mockSaveAvailability.mockRejectedValueOnce(conflictError);

    renderWithProviders(<MySchedulePage />);

    const saveButton = screen.getByRole('button', { name: /save availability/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('conflict-banner')).toBeInTheDocument();
    });

    // Conflict banner details
    expect(screen.getByText(/2026-11-02 10:00 – 14:00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view visit visit-999/i })).toHaveAttribute(
      'href',
      '/scheduling/visits/visit-999'
    );

    // Assert that client names are never rendered
    expect(screen.queryByText(/John Smith/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Client/i)).not.toBeInTheDocument();
  });

  it('saves successfully when schedule is valid', async () => {
    renderWithProviders(<MySchedulePage />);

    const saveButton = screen.getByRole('button', { name: /save availability/i });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveAvailability).toHaveBeenCalledWith({
        weekStart: expect.any(String),
        schedule: defaultAvailabilityData.schedule,
        expectedVersion: 1,
      });
    });

    expect(await screen.findByText(/Availability schedule saved successfully/i)).toBeInTheDocument();
  });

  it('handles version mismatch error by reloading schedule and notifying user', async () => {
    const mismatchError = {
      code: 'VERSION_MISMATCH',
      status: 409,
      response: {
        data: {
          code: 'VERSION_MISMATCH',
          message: 'Concurrent modification detected',
        },
      },
    };

    mockSaveAvailability.mockRejectedValueOnce(mismatchError);

    renderWithProviders(<MySchedulePage />);

    const saveButton = screen.getByRole('button', { name: /save availability/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });

    expect(
      screen.getByText(
        /Your edits were not saved because the schedule was updated elsewhere\. The schedule has been refreshed\./i
      )
    ).toBeInTheDocument();
  });

  it('role guard: a non-CAREGIVER user cannot reach the route', async () => {
    vi.mocked(hooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      isInitializing: false,
      user: { id: 'u-coordinator', email: 'coord@example.com', roles: ['COORDINATOR'], permissions: [] } as any,
      token: 'test-token',
      login: vi.fn(),
      logout: vi.fn(),
      setInitializing: vi.fn(),
    });

    vi.mocked(hooks.usePermissions).mockReturnValue({
      can: vi.fn(() => false),
      canAny: vi.fn(() => false),
      canAll: vi.fn(() => false),
      hasRole: vi.fn((role: string) => role === 'COORDINATOR'),
      hasAnyRole: vi.fn((roles: string[]) => roles.includes('COORDINATOR')),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/caregiver/schedule']}>
          <Routes>
            <Route
              path="/caregiver/schedule"
              element={
                <ProtectedRoute requiredRoles={['CAREGIVER']}>
                  <MySchedulePage />
                </ProtectedRoute>
              }
            />
            <Route path="/analytics/coordinator" element={<div>Coordinator Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Weekly Schedule')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Coordinator Dashboard')).toBeInTheDocument();
  });
});
