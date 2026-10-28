import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useOperationalKPIs, useComplianceAlerts, useDashboardStats } from '../useAnalytics';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/core/hooks', () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
  }),
}));

describe('useAnalytics hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('useOperationalKPIs fetches KPIs via apiClient', async () => {
    const kpiData = {
      clientMetrics: { activeClients: 15, newClients: 2 },
      staffing: { activeCaregivers: 8, utilizationRate: 85 },
      visits: { scheduled: 20, completed: 18 },
      evvCompliance: { complianceRate: 0.98 },
    };
    mockGet.mockResolvedValue(kpiData);

    const filters = {
      dateRange: {
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T00:00:00Z'),
      },
    };

    const { result } = renderHook(() => useOperationalKPIs(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(kpiData);
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/kpis?'));
  });

  it('useComplianceAlerts fetches alerts via apiClient', async () => {
    const alertsData = [
      { id: 'alert-1', title: 'Late EVV', severity: 'warning', count: 3 },
    ];
    mockGet.mockResolvedValue(alertsData);

    const filters = {
      dateRange: {
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-01T23:59:59Z'),
      },
    };

    const { result } = renderHook(() => useComplianceAlerts(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(alertsData);
    expect(mockGet).toHaveBeenCalledWith('/api/analytics/compliance-alerts');
  });

  it('useDashboardStats fetches dashboard stats via apiClient', async () => {
    const statsData = { inProgress: 4, completedToday: 10, needsReview: 1 };
    mockGet.mockResolvedValue(statsData);

    const { result } = renderHook(() => useDashboardStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(statsData);
    expect(mockGet).toHaveBeenCalledWith('/api/analytics/dashboard-stats');
  });
});
