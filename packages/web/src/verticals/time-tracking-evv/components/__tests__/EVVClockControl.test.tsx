import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { EVVClockControl } from '../EVVClockControl.js';

const mockClockInMutate = vi.fn();
const mockClockOutMutate = vi.fn();
let mockLocationRequired = true;
let mockEVVRecord: unknown = null;

vi.mock('../../hooks', () => ({
  useClockIn: () => ({
    mutate: mockClockInMutate,
    isPending: false,
  }),
  useClockOut: () => ({
    mutate: mockClockOutMutate,
    isPending: false,
  }),
  useEVVRecord: () => ({
    data: mockEVVRecord,
    refetch: vi.fn(),
  }),
  useLocationPolicy: () => ({
    locationRequired: mockLocationRequired,
  }),
}));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: { id: 'caregiver-123' },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EVVClockControl', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationRequired = true;
    mockEVVRecord = null;

    mockGetCurrentPosition = vi.fn((success) => {
      success({
        coords: {
          latitude: 30.2672,
          longitude: -97.7431,
          accuracy: 10,
          altitude: null,
          heading: null,
          speed: null,
        },
      });
    });

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
      },
      configurable: true,
      writable: true,
    });
  });

  it('when policy is ON: calls getCurrentPosition and sends location on clock-in', async () => {
    mockLocationRequired = true;
    renderWithQueryClient(<EVVClockControl visitId="visit-1" />);

    const checkInButton = screen.getByRole('button', { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(mockClockInMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          visitId: 'visit-1',
          caregiverId: 'caregiver-123',
          location: expect.objectContaining({
            latitude: 30.2672,
            longitude: -97.7431,
            method: 'GPS',
          }),
        }),
        expect.anything()
      );
    });
  });

  it('when policy is OFF: does NOT call getCurrentPosition and sends NO location key on clock-in', async () => {
    mockLocationRequired = false;
    renderWithQueryClient(<EVVClockControl visitId="visit-1" />);

    const checkInButton = screen.getByRole('button', { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
      expect(mockClockInMutate).toHaveBeenCalled();
    });

    const callPayload = mockClockInMutate.mock.calls[0][0];
    expect(callPayload.visitId).toBe('visit-1');
    expect(callPayload.caregiverId).toBe('caregiver-123');
    expect('location' in callPayload).toBe(false);
    expect(callPayload.deviceInfo).toBeDefined();
  });

  it('when policy is OFF: does NOT call getCurrentPosition and sends NO location key on clock-out', async () => {
    mockLocationRequired = false;
    mockEVVRecord = {
      id: 'evv-rec-1',
      recordStatus: 'PENDING',
      clockInTime: '2027-06-15T10:00:00Z',
    };

    renderWithQueryClient(
      <EVVClockControl visitId="visit-1" evvRecordId="evv-rec-1" />
    );

    const checkOutButton = screen.getByRole('button', { name: /check out/i });
    fireEvent.click(checkOutButton);

    await waitFor(() => {
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
      expect(mockClockOutMutate).toHaveBeenCalled();
    });

    const callPayload = mockClockOutMutate.mock.calls[0][0];
    expect(callPayload.id).toBe('evv-rec-1');
    expect(callPayload.visitId).toBe('visit-1');
    expect(callPayload.caregiverId).toBe('caregiver-123');
    expect('location' in callPayload).toBe(false);
    expect(callPayload.deviceInfo).toBeDefined();
  });
});
