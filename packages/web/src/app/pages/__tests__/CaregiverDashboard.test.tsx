import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CaregiverDashboard } from '../CaregiverDashboard';

const mockNavigate = vi.fn();
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockApiClient = {
  get: mockGet,
  post: mockPost,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: { id: 'user-123', name: 'Jane Caregiver', roles: ['CAREGIVER'] },
  }),
  useIsMobile: () => false,
  useApiClient: () => mockApiClient,
}));

vi.mock('@/hooks', () => ({
  useConnectionStatus: () => ({ isConnected: true }),
}));

vi.mock('@/components/sync/NetworkStatusBanner', () => ({
  NetworkStatusBanner: () => null,
}));

vi.mock('@/components/DataFreshness', () => ({
  DataFreshness: () => null,
  StaleDataWarning: () => null,
}));

describe('CaregiverDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches and renders live visits, tasks, credentials, and stats from the API', async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/visits/my-visits')) {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'visit-live-1',
              clientId: 'client-1',
              clientFirstName: 'Elena',
              clientLastName: 'Vance',
              serviceTypeName: 'Skilled Nursing',
              scheduledDate: todayStr,
              scheduledStartTime: '09:30:00',
              scheduledDuration: 90,
              address: { line1: '500 Live Oak Blvd', city: 'Dallas', state: 'TX', postalCode: '75201' },
              status: 'SCHEDULED',
            },
            {
              id: 'visit-live-2',
              clientId: 'client-2',
              clientFirstName: 'Marcus',
              clientLastName: 'Cole',
              serviceTypeName: 'Personal Care',
              scheduledDate: todayStr,
              scheduledStartTime: '13:00:00',
              scheduledDuration: 120,
              actualDuration: 120,
              status: 'COMPLETED',
            },
          ],
        });
      }
      if (url.startsWith('/api/tasks')) {
        return Promise.resolve({
          items: [{ id: 'task-1', visitId: 'visit-live-1', title: 'Check blood pressure' }],
        });
      }
      if (url === '/api/caregivers/me') {
        return Promise.resolve({
          id: 'caregiver-456',
          credentials: [
            { name: 'TX Nurse Aide License', expirationDate: in10Days, status: 'ACTIVE' },
          ],
          training: [],
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <CaregiverDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Elena Vance')).toBeInTheDocument();
    });

    expect(screen.getByText('Marcus Cole')).toBeInTheDocument();
    expect(screen.getByText('Check blood pressure')).toBeInTheDocument();
    expect(screen.getByText('500 Live Oak Blvd, Dallas, TX 75201')).toBeInTheDocument();
    expect(screen.getByText('TX Nurse Aide License')).toBeInTheDocument();
    expect(screen.getByText('3.5 hours scheduled')).toBeInTheDocument();

    // Ensure no hardcoded mock data is rendered
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('CPR Certification')).not.toBeInTheDocument();
    expect(screen.queryByText('32.5')).not.toBeInTheDocument();
  });

  it('renders empty state and zero stats when API returns no visits and /api/caregivers/me returns 404', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/visits/my-visits')) {
        return Promise.resolve({ success: true, data: [] });
      }
      if (url.startsWith('/api/tasks')) {
        return Promise.resolve({ items: [] });
      }
      if (url === '/api/caregivers/me') {
        return Promise.reject({ status: 404, message: 'Not Found' });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <CaregiverDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No visits scheduled today')).toBeInTheDocument();
    });

    expect(screen.getByText('0 hours scheduled')).toBeInTheDocument();
    expect(screen.queryByText('Training & Credential Reminders')).not.toBeInTheDocument();
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
  });

  it('calls EVV clock-in and clock-out endpoints and reverts on failure', async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/visits/my-visits')) {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'visit-evv-1',
              clientId: 'client-1',
              clientFirstName: 'Ada',
              clientLastName: 'Lovelace',
              serviceTypeName: 'Personal Care',
              scheduledDate: todayStr,
              scheduledStartTime: '08:00:00',
              scheduledDuration: 60,
              status: 'SCHEDULED',
            },
          ],
        });
      }
      if (url.startsWith('/api/tasks')) {
        return Promise.resolve({ items: [] });
      }
      if (url === '/api/caregivers/me') {
        return Promise.resolve({ id: 'cg-789', credentials: [], training: [] });
      }
      return Promise.resolve({});
    });

    mockPost.mockResolvedValueOnce({ evvRecordId: 'evv-rec-1' });

    render(
      <MemoryRouter>
        <CaregiverDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Check In/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/evv/clock-in',
        expect.objectContaining({
          visitId: 'visit-evv-1',
          caregiverId: 'cg-789',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Check Out/i })).toBeInTheDocument();
    });

    // Simulate clock-out failure and verify optimistic state reverts
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/evv/evv-rec-1/clock-out',
        expect.objectContaining({
          visitId: 'visit-evv-1',
          caregiverId: 'cg-789',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Check In/i })).toBeInTheDocument();
    });
  });
});
