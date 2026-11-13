import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ClientTimelineCard } from '../ClientTimelineCard';

// Mock the hook the cards use. Tests below were written with an axios-style
// { data: <body> } envelope; the real ApiClient resolves the body directly.
const { apiClient } = vi.hoisted(() => {
  const get = vi.fn();
  return { apiClient: { get, real: { get: (...a: unknown[]) => (get(...a) as Promise<{ data: unknown }>).then((r) => r.data) } } };
});
vi.mock('@/core/hooks/api', () => ({
  useApiClient: () => apiClient.real,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

  return Wrapper;
};

describe('ClientTimelineCard', () => {
  it('renders lifecycle events', () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 5,
          totalPages: 0,
        },
      },
    });

    render(
      <ClientTimelineCard
        clientId="client-123"
        createdAt="2024-01-01T10:00:00Z"
        intakeDate="2024-01-05T14:00:00Z"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Client Created')).toBeInTheDocument();
    expect(screen.getByText('Intake Completed')).toBeInTheDocument();
  });

  it('renders completed visits in timeline', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-1',
              visitNumber: 'V-001',
              serviceTypeName: 'Personal Care',
              scheduledDate: '2024-01-10',
              status: 'COMPLETED',
              caregiverFirstName: 'Jane',
              caregiverLastName: 'Smith',
            },
            {
              id: 'visit-2',
              visitNumber: 'V-002',
              serviceTypeName: 'Companionship',
              scheduledDate: '2024-01-08',
              status: 'COMPLETED',
              caregiverFirstName: 'John',
              caregiverLastName: 'Doe',
            },
          ],
          total: 2,
          page: 1,
          limit: 5,
          totalPages: 1,
        },
      },
    });

    render(
      <ClientTimelineCard
        clientId="client-123"
        createdAt="2024-01-01T10:00:00Z"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getAllByText('Visit Completed')).toHaveLength(2);
    });

    expect(screen.getByText('Personal Care • Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Companionship • John Doe')).toBeInTheDocument();
  });

  it('only shows completed visits, not other statuses', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-1',
              visitNumber: 'V-001',
              serviceTypeName: 'Personal Care',
              scheduledDate: '2024-01-10',
              status: 'COMPLETED',
              caregiverFirstName: 'Jane',
              caregiverLastName: 'Smith',
            },
            {
              id: 'visit-2',
              visitNumber: 'V-002',
              serviceTypeName: 'Companionship',
              scheduledDate: '2024-01-08',
              status: 'CANCELLED',
              caregiverFirstName: 'John',
              caregiverLastName: 'Doe',
            },
            {
              id: 'visit-3',
              visitNumber: 'V-003',
              serviceTypeName: 'Skilled Nursing',
              scheduledDate: '2024-01-06',
              status: 'NO_SHOW_CLIENT',
            },
          ],
          total: 3,
          page: 1,
          limit: 5,
          totalPages: 1,
        },
      },
    });

    render(
      <ClientTimelineCard
        clientId="client-123"
        createdAt="2024-01-01T10:00:00Z"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      // Only the completed visit should show
      const visitCompleted = screen.getAllByText('Visit Completed');
      expect(visitCompleted).toHaveLength(1);
    });

    expect(screen.getByText('Personal Care • Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('Companionship • John Doe')).not.toBeInTheDocument();
  });

  it('limits timeline to 3 most recent completed visits', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-1',
              visitNumber: 'V-001',
              serviceTypeName: 'Service 1',
              scheduledDate: '2024-01-10',
              status: 'COMPLETED',
            },
            {
              id: 'visit-2',
              visitNumber: 'V-002',
              serviceTypeName: 'Service 2',
              scheduledDate: '2024-01-09',
              status: 'COMPLETED',
            },
            {
              id: 'visit-3',
              visitNumber: 'V-003',
              serviceTypeName: 'Service 3',
              scheduledDate: '2024-01-08',
              status: 'COMPLETED',
            },
            {
              id: 'visit-4',
              visitNumber: 'V-004',
              serviceTypeName: 'Service 4',
              scheduledDate: '2024-01-07',
              status: 'COMPLETED',
            },
          ],
          total: 4,
          page: 1,
          limit: 5,
          totalPages: 1,
        },
      },
    });

    render(
      <ClientTimelineCard
        clientId="client-123"
        createdAt="2024-01-01T10:00:00Z"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const visitCompleted = screen.getAllByText('Visit Completed');
      // Should only show 3, not 4
      expect(visitCompleted).toHaveLength(3);
    });
  });

  it('renders discharge event when present', () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 5,
          totalPages: 0,
        },
      },
    });

    render(
      <ClientTimelineCard
        clientId="client-123"
        createdAt="2024-01-01T10:00:00Z"
        dischargeDate="2024-02-01T10:00:00Z"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Discharged')).toBeInTheDocument();
  });

  it('renders view full history button', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 5,
          totalPages: 0,
        },
      },
    });

    render(
      <ClientTimelineCard
        clientId="client-123"
        createdAt="2024-01-01T10:00:00Z"
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('View Full Visit History')).toBeInTheDocument();
    });
  });
});
