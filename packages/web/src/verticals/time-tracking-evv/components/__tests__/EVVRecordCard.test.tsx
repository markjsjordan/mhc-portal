import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EVVRecordCard } from '../EVVRecordCard.js';
import type { EVVRecord } from '../../types/index.js';

describe('EVVRecordCard', () => {
  const baseRecord: EVVRecord = {
    id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    visitId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    caregiverId: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    clientId: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90',
    clientName: 'Alice Smith',
    caregiverName: 'Bob Johnson',
    serviceDate: '2027-06-15T00:00:00Z',
    clockInTime: '2027-06-15T10:00:00Z',
    recordStatus: 'COMPLETE',
    verificationLevel: 'FULL',
    complianceFlags: [],
    createdAt: '2027-06-15T10:00:00Z',
    updatedAt: '2027-06-15T10:00:00Z',
  };

  it('renders names and formatted visit info, and contains no UUID string or slice', () => {
    const { container } = render(
      <MemoryRouter>
        <EVVRecordCard record={baseRecord} />
      </MemoryRouter>
    );

    const formattedDate = new Date(baseRecord.serviceDate!).toLocaleDateString();
    expect(screen.getByText(`Visit: Alice Smith · ${formattedDate}`)).toBeInTheDocument();
    expect(screen.getByText('Caregiver: Bob Johnson')).toBeInTheDocument();

    const textContent = container.textContent ?? '';
    expect(textContent).not.toMatch(/[0-9a-f]{8}-?[0-9a-f]{4}/i);
    expect(textContent).not.toContain('b2c3d4e5');
    expect(textContent).not.toContain('c3d4e5f6');
  });

  it('renders fallback when clientName, serviceDate, or caregiverName are missing without showing UUIDs', () => {
    const fallbackRecord: EVVRecord = {
      ...baseRecord,
      clientName: undefined,
      serviceDate: undefined,
      caregiverName: undefined,
    };

    const { container } = render(
      <MemoryRouter>
        <EVVRecordCard record={fallbackRecord} />
      </MemoryRouter>
    );

    expect(screen.getByText('Visit')).toBeInTheDocument();
    expect(screen.getByText('Caregiver: Unassigned name')).toBeInTheDocument();

    const textContent = container.textContent ?? '';
    expect(textContent).not.toMatch(/[0-9a-f]{8}-?[0-9a-f]{4}/i);
    expect(textContent).not.toContain('b2c3d4e5');
    expect(textContent).not.toContain('c3d4e5f6');
  });

  it('renders "Location not captured" when locationCaptured === false', () => {
    const uncapturedRecord: EVVRecord = {
      ...baseRecord,
      clockInVerification: {
        locationCaptured: false,
      },
    };

    render(
      <MemoryRouter>
        <EVVRecordCard record={uncapturedRecord} />
      </MemoryRouter>
    );

    expect(screen.getByText('Location not captured')).toBeInTheDocument();
    expect(screen.queryByText('GPS Verified')).not.toBeInTheDocument();
  });

  it('renders "GPS Verified" when locationCaptured is true and coordinates are present', () => {
    const capturedRecord: EVVRecord = {
      ...baseRecord,
      clockInVerification: {
        locationCaptured: true,
        latitude: 30.2672,
        longitude: -97.7431,
      },
    };

    render(
      <MemoryRouter>
        <EVVRecordCard record={capturedRecord} />
      </MemoryRouter>
    );

    expect(screen.getByText('GPS Verified')).toBeInTheDocument();
    expect(screen.queryByText('Location not captured')).not.toBeInTheDocument();
  });
});
