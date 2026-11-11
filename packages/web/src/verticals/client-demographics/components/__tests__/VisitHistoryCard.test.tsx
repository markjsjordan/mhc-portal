/**
 * Tests for VisitHistoryCard component
 * 
 * Covers rendering of completed visits, empty state, error state, and pagination.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { VisitHistoryCard } from '../VisitHistoryCard';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('VisitHistoryCard', () => {
  it('should render loading state initially', () => {
    (apiClient.get as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    expect(screen.getByText('Visit History')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should render completed visit with all details', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-1',
              visitNumber: 'V2024-000123',
              visitType: 'REGULAR',
              serviceTypeName: 'Personal Care',
              scheduledDate: '2024-11-11',
              scheduledStartTime: '09:00',
              scheduledEndTime: '10:00',
              scheduledDuration: 60,
              actualStartTime: '2024-11-11T09:05:00Z',
              actualEndTime: '2024-11-11T10:10:00Z',
              actualDuration: 65,
              status: 'COMPLETED',
              statusHistory: [],
              caregiverFirstName: 'Jane',
              caregiverLastName: 'Doe',
              createdAt: '2024-11-11T08:00:00Z',
              updatedAt: '2024-11-11T10:10:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('V2024-000123')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal Care')).toBeInTheDocument();
    expect(screen.getByText('Nov 11, 2024')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/09:00.*10:00/)).toBeInTheDocument();
    expect(screen.getByText(/1h 0m/)).toBeInTheDocument(); // Duration
  });

  it('should render cancelled visit with distinct styling', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-2',
              visitNumber: 'V2024-000456',
              visitType: 'REGULAR',
              serviceTypeName: 'Respite Care',
              scheduledDate: '2024-11-10',
              scheduledStartTime: '14:00',
              scheduledEndTime: '16:00',
              scheduledDuration: 120,
              status: 'CANCELLED',
              statusHistory: [],
              createdAt: '2024-11-10T08:00:00Z',
              updatedAt: '2024-11-10T14:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });

    expect(screen.getByText('(Not completed)')).toBeInTheDocument();
  });

  it('should render no-show visit with distinct styling', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-3',
              visitNumber: 'V2024-000789',
              visitType: 'REGULAR',
              serviceTypeName: 'Companion Care',
              scheduledDate: '2024-11-09',
              scheduledStartTime: '10:00',
              scheduledEndTime: '11:00',
              scheduledDuration: 60,
              status: 'NO_SHOW_CLIENT',
              statusHistory: [],
              createdAt: '2024-11-09T08:00:00Z',
              updatedAt: '2024-11-09T10:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('NO SHOW CLIENT')).toBeInTheDocument();
    });

    expect(screen.getByText('(Not completed)')).toBeInTheDocument();
  });

  it('should render empty state when no visits', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No visit history found for this client.')).toBeInTheDocument();
    });
  });

  it('should render error state and retry button', async () => {
    (apiClient.get as any).mockRejectedValue(new Error('Network error'));

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load visit history/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should show pagination controls when multiple pages', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: Array.from({ length: 10 }, (_, i) => ({
            id: `visit-${i}`,
            visitNumber: `V2024-00${i}`,
            visitType: 'REGULAR',
            serviceTypeName: 'Personal Care',
            scheduledDate: '2024-11-11',
            scheduledStartTime: '09:00',
            scheduledEndTime: '10:00',
            scheduledDuration: 60,
            status: 'COMPLETED',
            statusHistory: [],
            createdAt: '2024-11-11T08:00:00Z',
            updatedAt: '2024-11-11T10:00:00Z',
          })),
          total: 25,
          page: 1,
          limit: 10,
          totalPages: 3,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('should show total visit count', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: Array.from({ length: 5 }, (_, i) => ({
            id: `visit-${i}`,
            visitNumber: `V2024-00${i}`,
            visitType: 'REGULAR',
            serviceTypeName: 'Personal Care',
            scheduledDate: '2024-11-11',
            scheduledStartTime: '09:00',
            scheduledEndTime: '10:00',
            scheduledDuration: 60,
            status: 'COMPLETED',
            statusHistory: [],
            createdAt: '2024-11-11T08:00:00Z',
            updatedAt: '2024-11-11T10:00:00Z',
          })),
          total: 42,
          page: 1,
          limit: 10,
          totalPages: 5,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('42 total visits')).toBeInTheDocument();
    });
  });

  it('should link each visit to the visit detail page', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'visit-detail-id',
              visitNumber: 'V2024-999',
              visitType: 'REGULAR',
              serviceTypeName: 'Personal Care',
              scheduledDate: '2024-11-11',
              scheduledStartTime: '09:00',
              scheduledEndTime: '10:00',
              scheduledDuration: 60,
              status: 'COMPLETED',
              statusHistory: [],
              createdAt: '2024-11-11T08:00:00Z',
              updatedAt: '2024-11-11T10:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    });

    render(<VisitHistoryCard clientId="test-client-id" />, { wrapper: createWrapper() });

    await waitFor(() => {
      const link = screen.getByText('V2024-999').closest('a');
      expect(link).toHaveAttribute('href', '/scheduling/visits/visit-detail-id');
    });
  });
});
