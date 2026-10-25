/**
 * Capture-Time Geofence and Grace Period Validator
 *
 * Pure, dependency-free validator for EVV clock events that evaluates against
 * the device capture timestamp (not server time) with state-specific rules.
 *
 * Background:
 * - Existing geofence validators in texas-geofence-validator.ts validate spatial
 *   distance but don't enforce capture-time grace periods
 * - State configs in config/state-evv-configs.ts define gracePeriodMinutes but
 *   don't provide a unified validator
 * - Mobile location service (packages/mobile/src/services/location.ts:119-155)
 *   has verifyGeofence() but uses Date.now(), not capture time
 *
 * This validator:
 * - Validates clock events against CAPTURE TIMESTAMP (device time)
 * - Enforces state-specific grace periods (TX: 10 min, FL: 15 min)
 * - Enforces state-specific geofence rules (TX: 100m base + 50m tolerance, FL: 150m + 100m)
 * - Applies GPS accuracy allowance per existing project patterns
 * - Returns structured validation results with clear failure reasons
 *
 * References:
 * - verticals/time-tracking-evv/src/types/state-specific.ts:419-609 (getStateEVVRules)
 * - verticals/time-tracking-evv/src/config/state-evv-configs.ts:50-224 (state configs)
 * - packages/mobile/src/services/location.ts:119-155 (verifyGeofence)
 * - AGENTS.md: TX 100m + GPS accuracy, FL 150m + GPS accuracy, TX 10-min grace, FL 15-min grace
 */

/**
 * Supported state codes
 */
export type StateCode = 'TX' | 'FL';

/**
 * Validation result
 */
export type CaptureTimeValidationResult =
  | { status: 'ok'; reasons?: string[] }
  | { status: 'outOfGrace'; reasons: string[] }
  | { status: 'outOfGeofence'; reasons: string[] }
  | { status: 'flagged'; reasons: string[] };

// Backwards-compatible alias
export type ValidationResult = CaptureTimeValidationResult;

/**
 * Clock event input
 */
export interface ClockEventInput {
  /** Device timestamp when location was captured (NOT server time) */
  captureTimestamp: Date;
  /** State code (TX or FL) */
  state: StateCode;
  /** GPS accuracy in meters */
  gpsAccuracyMeters: number;
  /** Distance from service address in meters */
  distanceFromVisitMeters: number;
  /** Optional scheduled start time for grace period validation */
  scheduledStartTime?: Date;
}

/**
 * State-specific validation rules
 */
interface StateRules {
  gracePeriodMinutes: number;
  baseGeofenceMeters: number;
  geofenceToleranceMeters: number;
  maxGPSAccuracyMeters: number;
}

/**
 * State rules (from getStateEVVRules and STATE_EVV_CONFIGS)
 */
const STATE_RULES: Record<StateCode, StateRules> = {
  TX: {
    gracePeriodMinutes: 10,
    baseGeofenceMeters: 100,
    geofenceToleranceMeters: 50,
    maxGPSAccuracyMeters: 100,
  },
  FL: {
    gracePeriodMinutes: 15,
    baseGeofenceMeters: 150,
    geofenceToleranceMeters: 100,
    maxGPSAccuracyMeters: 150,
  },
};

/**
 * Validate a clock event against capture time with state-specific rules
 *
 * This is a PURE function - no I/O, no globals, deterministic.
 *
 * Grace Period Validation:
 * - Clock-in must be within [scheduledStart - gracePeriod, scheduledStart + gracePeriod]
 * - Evaluated against captureTimestamp, NOT Date.now()
 * - TX: 10-minute grace (±10 min), FL: 15-minute grace (±15 min)
 *
 * Geofence Validation:
 * - Effective radius = baseGeofence + geofenceTolerance + gpsAccuracy
 * - TX: 100m base + 50m tolerance = 150m baseline, then + GPS accuracy
 * - FL: 150m base + 100m tolerance = 250m baseline, then + GPS accuracy
 * - Per AGENTS.md and existing patterns in location.ts:137-138
 *
 * @param input - Clock event to validate
 * @returns Validation result with status and reasons
 */
export function validateCaptureTimeClockEvent(input: ClockEventInput): CaptureTimeValidationResult {
  const reasons: string[] = [];

  // Validate state
  if (!STATE_RULES[input.state]) {
    return {
      status: 'flagged',
      reasons: [`Unknown state: ${input.state}. Only TX and FL are supported.`],
    };
  }

  const rules = STATE_RULES[input.state];

  // Validate negative/invalid inputs
  if (input.gpsAccuracyMeters < 0) {
    return {
      status: 'flagged',
      reasons: ['GPS accuracy cannot be negative'],
    };
  }

  if (input.distanceFromVisitMeters < 0) {
    return {
      status: 'flagged',
      reasons: ['Distance from visit cannot be negative'],
    };
  }

  if (isNaN(input.captureTimestamp.getTime())) {
    return {
      status: 'flagged',
      reasons: ['Invalid capture timestamp'],
    };
  }

  // Grace period validation (if scheduledStartTime provided)
  if (input.scheduledStartTime) {
    if (isNaN(input.scheduledStartTime.getTime())) {
      return {
        status: 'flagged',
        reasons: ['Invalid scheduled start time'],
      };
    }

    const gracePeriodMs = rules.gracePeriodMinutes * 60 * 1000;
    const timeDiffMs = input.captureTimestamp.getTime() - input.scheduledStartTime.getTime();

    // Out of grace if before (scheduledStart - grace) or after (scheduledStart + grace)
    if (timeDiffMs < -gracePeriodMs || timeDiffMs > gracePeriodMs) {
      const minutesDiff = Math.abs(timeDiffMs) / (60 * 1000);
      const direction = timeDiffMs < 0 ? 'before' : 'after';
      reasons.push(
        `Clock event ${minutesDiff.toFixed(1)} minutes ${direction} scheduled start, exceeds ${rules.gracePeriodMinutes}-minute grace period for ${input.state}`
      );
      return { status: 'outOfGrace', reasons };
    }
  }

  // Geofence validation
  // Effective radius = base + tolerance + GPS accuracy allowance
  // Per location.ts:136-138 and AGENTS.md
  const effectiveRadiusMeters =
    rules.baseGeofenceMeters + rules.geofenceToleranceMeters + input.gpsAccuracyMeters;

  if (input.distanceFromVisitMeters > effectiveRadiusMeters) {
    const excessMeters = input.distanceFromVisitMeters - effectiveRadiusMeters;
    reasons.push(
      `Location ${input.distanceFromVisitMeters.toFixed(0)}m from visit address, exceeds effective geofence radius ${effectiveRadiusMeters.toFixed(0)}m (base ${rules.baseGeofenceMeters}m + tolerance ${rules.geofenceToleranceMeters}m + GPS accuracy ${input.gpsAccuracyMeters.toFixed(0)}m) by ${excessMeters.toFixed(0)}m`
    );
    return { status: 'outOfGeofence', reasons };
  }

  // GPS accuracy check (flagged, not rejected - may still be acceptable with manual review)
  if (input.gpsAccuracyMeters > rules.maxGPSAccuracyMeters) {
    reasons.push(
      `GPS accuracy ${input.gpsAccuracyMeters.toFixed(0)}m exceeds ${input.state} maximum ${rules.maxGPSAccuracyMeters}m (requires manual review)`
    );
    return { status: 'flagged', reasons };
  }

  // All checks passed
  return { status: 'ok' };
}
