import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdministratorDashboard } from '../AdministratorDashboard.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/verticals/analytics-reporting/hooks/useAnalytics', () => ({
  useOperationalKPIs: () => ({
    data: {
      clientMetrics: { activeClients: 10, newClients: 2 },
      staffing: { activeCaregivers: 5, utilizationRate: 85 },
      visits: { scheduled: 15, completed: 12 },
      evvCompliance: { complianceRate: 0.98, compliantVisits: 12, totalVisits: 12 },
      revenueMetrics: {
        outstandingAR: 1000,
        totalBilled: 6000,
        paidAmount: 5000,
        averageReimbursementRate: 35,
      },
    },
    isLoading: false,
    error: null,
  }),
  useComplianceAlerts: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/core/hooks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'u-admin', email: 'admin@folkcare.example', roles: ['SUPER_ADMIN'] },
    }),
  };
});

describe('AdministratorDashboard Quick Actions (wdvf3acfj0)', () => {
  it('navigates Review Exceptions quick action to /time-tracking/aggregator-submissions', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdministratorDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const reviewExceptionsBtn = screen.getByText('Review Exceptions');
    expect(reviewExceptionsBtn).toBeInTheDocument();

    fireEvent.click(reviewExceptionsBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/time-tracking/aggregator-submissions');
  });
});

