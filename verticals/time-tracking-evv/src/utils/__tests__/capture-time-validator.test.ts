/**
 * Tests for Capture-Time Geofence and Grace Period Validator
 *
 * All tests use FIXED TIMESTAMPS to ensure deterministic behavior.
 * No Date.now() or flaky time-dependent logic.
 */

import { describe, it, expect } from 'vitest';
import {
  validateCaptureTimeClockEvent,
  type ClockEventInput,
  type StateCode,
} from '../capture-time-validator.js';

// Fixed timestamps for deterministic tests
const SCHEDULED_START = new Date('2024-10-24T09:00:00.000Z');
const TX_10_MIN_BEFORE = new Date('2024-10-24T08:50:00.000Z'); // Exactly 10 min before
const TX_10_MIN_AFTER = new Date('2024-10-24T09:10:00.000Z'); // Exactly 10 min after
const TX_10_MIN_1_SEC_AFTER = new Date('2024-10-24T09:10:01.000Z'); // 10 min 1 sec after (out of grace)
const FL_15_MIN_BEFORE = new Date('2024-10-24T08:45:00.000Z'); // Exactly 15 min before
const FL_15_MIN_AFTER = new Date('2024-10-24T09:15:00.000Z'); // Exactly 15 min after
const FL_15_MIN_1_SEC_AFTER = new Date('2024-10-24T09:15:01.000Z'); // 15 min 1 sec after (out of grace)

describe('validateCaptureTimeClockEvent', () => {
  describe('Grace Period Validation', () => {
    describe('Texas (10-minute grace period)', () => {
      it('should accept clock-in exactly 10 minutes before scheduled start', () => {
        const input: ClockEventInput = {
          captureTimestamp: TX_10_MIN_BEFORE,
          state: 'TX',
          gpsAccuracyMeters: 20,
          distanceFromVisitMeters: 50,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });

      it('should accept clock-in exactly 10 minutes after scheduled start', () => {
        const input: ClockEventInput = {
          captureTimestamp: TX_10_MIN_AFTER,
          state: 'TX',
          gpsAccuracyMeters: 20,
          distanceFromVisitMeters: 50,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });

      it('should reject clock-in 10 minutes 1 second after scheduled start', () => {
        const input: ClockEventInput = {
          captureTimestamp: TX_10_MIN_1_SEC_AFTER,
          state: 'TX',
          gpsAccuracyMeters: 20,
          distanceFromVisitMeters: 50,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('outOfGrace');
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toContain('10-minute grace period');
        expect(result.reasons[0]).toContain('TX');
      });

      it('should accept clock-in at exact scheduled start time', () => {
        const input: ClockEventInput = {
          captureTimestamp: SCHEDULED_START,
          state: 'TX',
          gpsAccuracyMeters: 20,
          distanceFromVisitMeters: 50,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });
    });

    describe('Florida (15-minute grace period)', () => {
      it('should accept clock-in exactly 15 minutes before scheduled start', () => {
        const input: ClockEventInput = {
          captureTimestamp: FL_15_MIN_BEFORE,
          state: 'FL',
          gpsAccuracyMeters: 30,
          distanceFromVisitMeters: 100,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });

      it('should accept clock-in exactly 15 minutes after scheduled start', () => {
        const input: ClockEventInput = {
          captureTimestamp: FL_15_MIN_AFTER,
          state: 'FL',
          gpsAccuracyMeters: 30,
          distanceFromVisitMeters: 100,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });

      it('should reject clock-in 15 minutes 1 second after scheduled start', () => {
        const input: ClockEventInput = {
          captureTimestamp: FL_15_MIN_1_SEC_AFTER,
          state: 'FL',
          gpsAccuracyMeters: 30,
          distanceFromVisitMeters: 100,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('outOfGrace');
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toContain('15-minute grace period');
        expect(result.reasons[0]).toContain('FL');
      });
    });
  });

  describe('Geofence Validation', () => {
    describe('Texas (100m base + 50m tolerance)', () => {
      it('should accept location at exactly 100m + 50m + accuracy boundary', () => {
        const input: ClockEventInput = {
          captureTimestamp: SCHEDULED_START,
          state: 'TX',
          gpsAccuracyMeters: 20,
          distanceFromVisitMeters: 170, // 100 + 50 + 20 = 170
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });

      it('should reject location 1 meter beyond effective radius', () => {
        const input: ClockEventInput = {
          captureTimestamp: SCHEDULED_START,
          state: 'TX',
          gpsAccuracyMeters: 20,
          distanceFromVisitMeters: 171, // 100 + 50 + 20 + 1 = 171
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('outOfGeofence');
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toContain('171m');
        expect(result.reasons[0]).toContain('170m');
      });

      it('should accept location well within base geofence', () => {
        const input: ClockEventInput = {
          captureTimestamp: SCHEDULED_START,
          state: 'TX',
          gpsAccuracyMeters: 10,
          distanceFromVisitMeters: 50,
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });
    });

    describe('Florida (150m base + 100m tolerance)', () => {
      it('should accept location at exactly 150m + 100m + accuracy boundary', () => {
        const input: ClockEventInput = {
          captureTimestamp: SCHEDULED_START,
          state: 'FL',
          gpsAccuracyMeters: 30,
          distanceFromVisitMeters: 280, // 150 + 100 + 30 = 280
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('ok');
      });

      it('should reject location 1 meter beyond effective radius', () => {
        const input: ClockEventInput = {
          captureTimestamp: SCHEDULED_START,
          state: 'FL',
          gpsAccuracyMeters: 30,
          distanceFromVisitMeters: 281, // 150 + 100 + 30 + 1 = 281
          scheduledStartTime: SCHEDULED_START,
        };

        const result = validateCaptureTimeClockEvent(input);
        expect(result.status).toBe('outOfGeofence');
        expect(result.reasons).toHaveLength(1);
        expect(result.reasons[0]).toContain('281m');
        expect(result.reasons[0]).toContain('280m');
      });
    });
  });

  describe('GPS Accuracy Limits', () => {
    it('should flag TX event with GPS accuracy exceeding 100m', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 101,
        distanceFromVisitMeters: 50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toContain('101m');
      expect(result.reasons[0]).toContain('100m');
      expect(result.reasons[0]).toContain('manual review');
    });

    it('should flag FL event with GPS accuracy exceeding 150m', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'FL',
        gpsAccuracyMeters: 151,
        distanceFromVisitMeters: 50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toContain('151m');
      expect(result.reasons[0]).toContain('150m');
    });

    it('should accept TX event at exactly 100m GPS accuracy', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 100,
        distanceFromVisitMeters: 50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('ok');
    });
  });

  describe('Invalid Inputs', () => {
    it('should reject unknown state', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'CA' as StateCode, // Invalid state
        gpsAccuracyMeters: 20,
        distanceFromVisitMeters: 50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons[0]).toContain('Unknown state');
    });

    it('should reject negative GPS accuracy', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: -10,
        distanceFromVisitMeters: 50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons[0]).toContain('GPS accuracy cannot be negative');
    });

    it('should reject negative distance', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 20,
        distanceFromVisitMeters: -50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons[0]).toContain('Distance from visit cannot be negative');
    });

    it('should reject invalid capture timestamp', () => {
      const input: ClockEventInput = {
        captureTimestamp: new Date('invalid'),
        state: 'TX',
        gpsAccuracyMeters: 20,
        distanceFromVisitMeters: 50,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons[0]).toContain('Invalid capture timestamp');
    });

    it('should reject invalid scheduled start time', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 20,
        distanceFromVisitMeters: 50,
        scheduledStartTime: new Date('invalid'),
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('flagged');
      expect(result.reasons[0]).toContain('Invalid scheduled start time');
    });
  });

  describe('Edge Cases', () => {
    it('should work without scheduledStartTime (no grace period check)', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 20,
        distanceFromVisitMeters: 50,
        // No scheduledStartTime - grace period check skipped
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('ok');
    });

    it('should handle zero GPS accuracy', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 0,
        distanceFromVisitMeters: 100,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      // 100m + 50m + 0m = 150m effective radius
      // 100m distance is within that
      expect(result.status).toBe('ok');
    });

    it('should handle zero distance', () => {
      const input: ClockEventInput = {
        captureTimestamp: SCHEDULED_START,
        state: 'TX',
        gpsAccuracyMeters: 20,
        distanceFromVisitMeters: 0,
        scheduledStartTime: SCHEDULED_START,
      };

      const result = validateCaptureTimeClockEvent(input);
      expect(result.status).toBe('ok');
    });
  });
});
