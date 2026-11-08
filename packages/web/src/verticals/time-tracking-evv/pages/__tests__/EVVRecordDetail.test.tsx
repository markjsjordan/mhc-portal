import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EVVRecordDetail } from '../EVVRecordDetail.js';
import type { EVVRecord } from '../../types/index.js';

const mockUseEVVRecord = vi.fn();

vi.mock('../../hooks/index.js', () => ({
  useEVVRecord: (id: string | undefined) => mockUseEVVRecord(id),
}));

describe('EVVRecordDetail', () => {
  const baseRecord: EVVRecord = {
    id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    visitId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    caregiverId: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    clientId: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90',
    clientName: 'Alice Smith',
    caregiverName: 'Bob Johnson',
    serviceDate: '2027-06-15T00:00:00Z',
    clockInTime: '2027-06-15T10:00:00Z',
    clockOutTime: '2027-06-15T12:00:00Z',
    totalDuration: 120,
    recordStatus: 'COMPLETE',
    verificationLevel: 'FULL',
    complianceFlags: [],
    createdAt: '2027-06-15T10:00:00Z',
    updatedAt: '2027-06-15T12:00:00Z',
  };

  it('renders names, formatted visit, and caregiver blocks without any UUID-looking string', () => {
    mockUseEVVRecord.mockReturnValue({
      data: baseRecord,
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/time-tracking/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d']}>
        <Routes>
          <Route path="/time-tracking/:id" element={<EVVRecordDetail />} />
        </Routes>
      </MemoryRouter>
    );

    const formattedDate = new Date(baseRecord.serviceDate!).toLocaleDateString();
    expect(screen.getByText(`Alice Smith · ${formattedDate}`)).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

    const textContent = container.textContent ?? '';
    expect(textContent).not.toMatch(/[0-9a-f]{8}-?[0-9a-f]{4}/i);
    expect(textContent).not.toContain('b2c3d4e5');
    expect(textContent).not.toContain('c3d4e5f6');
  });

  it('renders fallback when clientName, serviceDate, or caregiverName are missing without displaying UUIDs', () => {
    mockUseEVVRecord.mockReturnValue({
      data: {
        ...baseRecord,
        clientName: undefined,
        serviceDate: undefined,
        caregiverName: undefined,
      },
      isLoading: false,
      error: null,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/time-tracking/a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d']}>
        <Routes>
          <Route path="/time-tracking/:id" element={<EVVRecordDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Visit', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Unassigned name')).toBeInTheDocument();

    const textContent = container.textContent ?? '';
    expect(textContent).not.toMatch(/[0-9a-f]{8}-?[0-9a-f]{4}/i);
    expect(textContent).not.toContain('b2c3d4e5');
    expect(textContent).not.toContain('c3d4e5f6');
  });
});
