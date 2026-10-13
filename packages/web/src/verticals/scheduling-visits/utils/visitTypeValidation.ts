import type { VisitType } from '../types';
import { getVisitTypeConfig, VISIT_TYPES } from '../config/visitTypeConfig';

/**
 * Validation error result
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate if a visit type is valid
 * @param type - The visit type to validate
 * @returns Validation error or undefined if valid
 */
export function validateVisitType(type: unknown): ValidationError | undefined {
  if (!type) {
    return { field: 'visitType', message: 'Visit type is required' };
  }

  if (typeof type !== 'string') {
    return { field: 'visitType', message: 'Visit type must be a string' };
  }

  const normalized = type.toUpperCase();
  if (!(normalized in VISIT_TYPES)) {
    return {
      field: 'visitType',
      message: `Invalid visit type: ${type}. Must be one of: ${Object.keys(VISIT_TYPES).join(', ')}`,
    };
  }

  return undefined;
}

/**
 * Validate if a caregiver has required certifications for a visit type
 * @param caregiverCertifications - Array of caregiver certifications
 * @param visitType - The visit type
 * @returns Validation error or undefined if caregiver is eligible
 */
export function validateCaregiverEligibility(
  caregiverCertifications: string[] | undefined,
  visitType: VisitType
): ValidationError | undefined {
  const config = getVisitTypeConfig(visitType);
  const requiredCerts = config.requiredCertifications;

  if (requiredCerts.length === 0) {
    // No certifications required
    return undefined;
  }

  if (!caregiverCertifications || caregiverCertifications.length === 0) {
    return {
      field: 'caregiver',
      message: `Caregiver has no certifications. ${visitType} requires: ${requiredCerts.join(', ')}`,
    };
  }

  const hasMissingCert = requiredCerts.some(req => !caregiverCertifications.includes(req));

  if (hasMissingCert) {
    return {
      field: 'caregiver',
      message: `Caregiver missing required certifications for ${config.label}. Requires: ${requiredCerts.join(', ')}, Has: ${caregiverCertifications.join(', ')}`,
    };
  }

  return undefined;
}

/**
 * Validate visit duration based on visit type
 * @param duration - Duration in minutes
 * @param visitType - The visit type
 * @returns Validation error or undefined if duration is reasonable
 */
export function validateVisitDuration(
  duration: number | undefined,
  visitType: VisitType
): ValidationError | undefined {
  if (!duration || duration <= 0) {
    return { field: 'duration', message: 'Visit duration must be greater than 0' };
  }

  if (duration < 15) {
    return { field: 'duration', message: 'Visit duration must be at least 15 minutes' };
  }

  if (duration > 1440) {
    return { field: 'duration', message: 'Visit duration cannot exceed 24 hours' };
  }

  const config = getVisitTypeConfig(visitType);
  const typical = config.typicalDuration;

  // Warn if duration is significantly different from typical
  // but don't fail - allow flexibility
  if (duration < typical / 2) {
    console.warn(
      `Visit duration (${duration}min) is much less than typical for ${config.label} (${typical}min)`
    );
  }

  if (duration > typical * 2) {
    console.warn(
      `Visit duration (${duration}min) is much more than typical for ${config.label} (${typical}min)`
    );
  }

  return undefined;
}

/**
 * Check if a visit type can be modified after caregiver assignment
 * Returns false - visit types should be immutable after assignment
 * @param assignedCaregiverId - The assigned caregiver ID
 * @returns Validation error if already assigned
 */
export function validateVisitTypeChangeAfterAssignment(
  assignedCaregiverId: string | undefined
): ValidationError | undefined {
  if (assignedCaregiverId) {
    return {
      field: 'visitType',
      message: 'Cannot change visit type after caregiver has been assigned',
    };
  }

  return undefined;
}

/**
 * Validate a complete visit creation payload
 * @param visitData - Visit data to validate
 * @returns Array of validation errors (empty if valid)
 */
export interface VisitCreationPayload {
  visitType?: unknown;
  duration?: number;
  caregiverCertifications?: string[];
  assignedCaregiverId?: string;
}

export function validateVisitCreation(visitData: VisitCreationPayload): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate visit type
  const visitTypeError = validateVisitType(visitData.visitType);
  if (visitTypeError) {
    errors.push(visitTypeError);
    return errors; // Can't validate further without a valid visit type
  }

  const visitType = (visitData.visitType as string).toUpperCase() as VisitType;

  // Validate duration
  const durationError = validateVisitDuration(visitData.duration, visitType);
  if (durationError) {
    errors.push(durationError);
  }

  // Validate caregiver eligibility if certifications provided
  if (visitData.caregiverCertifications) {
    const eligibilityError = validateCaregiverEligibility(
      visitData.caregiverCertifications,
      visitType
    );
    if (eligibilityError) {
      errors.push(eligibilityError);
    }
  }

  return errors;
}

/**
 * Get eligible visit types for a caregiver based on certifications
 * @param caregiverCertifications - Array of caregiver certifications
 * @returns Array of eligible visit types
 */
export function getEligibleVisitTypesForCaregiver(
  caregiverCertifications: string[] | undefined
): VisitType[] {
  if (!caregiverCertifications || caregiverCertifications.length === 0) {
    // Only types with no required certifications
    return Object.entries(VISIT_TYPES)
      .filter(([_, config]) => config.requiredCertifications.length === 0)
      .map(([type]) => type as VisitType);
  }

  return Object.entries(VISIT_TYPES)
    .filter(([_, config]) => {
      // All required certs must be present in caregiver's certs
      return config.requiredCertifications.every(req => caregiverCertifications.includes(req));
    })
    .map(([type]) => type as VisitType);
}
