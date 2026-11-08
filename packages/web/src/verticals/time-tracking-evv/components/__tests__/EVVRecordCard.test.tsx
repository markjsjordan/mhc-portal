import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EVVRecordCard } from '../EVVRecordCard.js';
import type { EVVRecord } from '../../types/index.js';

describe('EVVRecordCard', () => {
  const baseRecord: EVVRecord = {
    id: 'rec-1',
    visitId: 'visit-12345678',
    caregiverId: 'cg-12345678',
    clientId: 'client-12345678',
    clockInTime: '2027-06-15T10:00:00Z',
    recordStatus: 'COMPLETE',
    verificationLevel: 'FULL',
    complianceFlags: [],
    createdAt: '2027-06-15T10:00:00Z',
    updatedAt: '2027-06-15T10:00:00Z',
  };

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
