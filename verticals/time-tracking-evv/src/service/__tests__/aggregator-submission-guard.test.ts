import { describe, it, expect } from 'vitest';
import { assertLocationSubmittable } from '../aggregator-submission-guard.js';
import type { EVVRecord } from '../../types/evv.js';

describe('aggregator-submission-guard', () => {
  it('throws EVV_LOCATION_NOT_CAPTURED error when clockInVerification locationCaptured is false', () => {
    const record: Partial<EVVRecord> = {
      id: 'rec-1',
      clockInVerification: {
        locationCaptured: false,
        reason: 'ORG_LOCATION_NOT_REQUIRED',
        timestamp: new Date().toISOString(),
        timestampSource: 'DEVICE',
        deviceId: 'dev-1',
        method: 'GPS',
      },
      clockOutVerification: {
        locationCaptured: true,
        latitude: 30.123,
        longitude: -97.123,
        accuracy: 10,
        mockLocationDetected: false,
        timestamp: new Date().toISOString(),
        timestampSource: 'DEVICE',
        deviceId: 'dev-1',
        method: 'GPS',
      },
    };

    expect(() => assertLocationSubmittable(record as EVVRecord)).toThrowError(
      /EVV_LOCATION_NOT_CAPTURED/
    );
  });

  it('throws EVV_LOCATION_NOT_CAPTURED error when clockOutVerification locationCaptured is false', () => {
    const record: Partial<EVVRecord> = {
      id: 'rec-2',
      clockInVerification: {
        locationCaptured: true,
        latitude: 30.123,
        longitude: -97.123,
        accuracy: 10,
        mockLocationDetected: false,
        timestamp: new Date().toISOString(),
        timestampSource: 'DEVICE',
        deviceId: 'dev-1',
        method: 'GPS',
      },
      clockOutVerification: {
        locationCaptured: false,
        reason: 'ORG_LOCATION_NOT_REQUIRED',
        timestamp: new Date().toISOString(),
        timestampSource: 'DEVICE',
        deviceId: 'dev-1',
        method: 'GPS',
      },
    };

    expect(() => assertLocationSubmittable(record as EVVRecord)).toThrowError(
      /EVV_LOCATION_NOT_CAPTURED/
    );
  });

  it('passes when coordinates are present on both clockIn and clockOut, even if org switch is later off', () => {
    const record: Partial<EVVRecord> = {
      id: 'rec-3',
      clockInVerification: {
        locationCaptured: true,
        latitude: 30.123,
        longitude: -97.123,
        accuracy: 10,
        mockLocationDetected: false,
        timestamp: new Date().toISOString(),
        timestampSource: 'DEVICE',
        deviceId: 'dev-1',
        method: 'GPS',
      },
      clockOutVerification: {
        locationCaptured: true,
        latitude: 30.124,
        longitude: -97.124,
        accuracy: 12,
        mockLocationDetected: false,
        timestamp: new Date().toISOString(),
        timestampSource: 'DEVICE',
        deviceId: 'dev-1',
        method: 'GPS',
      },
    };

    expect(() => assertLocationSubmittable(record as EVVRecord)).not.toThrow();
  });
});
