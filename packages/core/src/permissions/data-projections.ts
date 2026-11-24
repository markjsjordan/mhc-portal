/**
 * Minimum-necessary data projections for role-based access control (HIPAA / E5 RBAC).
 *
 * Ensures API responses return only fields the caller's role is permitted to see
 * (e.g., caregiver phone/email and internal/billing notes are hidden from family members).
 */

import { UserContext } from '../types/base';

const ELEVATED_ROLES = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'ADMIN',
  'COORDINATOR',
]);

const FAMILY_OR_CLIENT_ROLES = new Set(['FAMILY', 'FAMILY_MEMBER', 'CLIENT']);

const CAREGIVER_PRIVATE_FIELDS = new Set([
  'phone',
  'phoneNumber',
  'phone_number',
  'primaryPhone',
  'primary_phone',
  'alternatePhone',
  'alternate_phone',
  'email',
  'address',
  'primaryAddress',
  'primary_address',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'payRate',
  'pay_rate',
  'hourlyRate',
  'hourly_rate',
  'payrollInfo',
  'payroll_info',
  'backgroundCheckDetails',
  'background_check_details',
]);

const VISIT_FAMILY_REDACTED_FIELDS = new Set([
  'caregiverPhone',
  'caregiver_phone',
  'caregiverEmail',
  'caregiver_email',
  'internalNotes',
  'internal_notes',
  'billingInfo',
  'billing_info',
  'payrollInfo',
  'payroll_info',
  'hourlyRate',
  'hourly_rate',
  'payRate',
  'pay_rate',
  'riskFlags',
  'risk_flags',
]);

const VISIT_CAREGIVER_REDACTED_FIELDS = new Set([
  'billingInfo',
  'billing_info',
  'payrollInfo',
  'payroll_info',
  'clientSsn',
  'client_ssn',
  'ssn',
]);

const CLIENT_CAREGIVER_REDACTED_FIELDS = new Set([
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'billingInfo',
  'billing_info',
  'paymentMethod',
  'payment_method',
  'financialInfo',
  'financial_info',
]);

const CLIENT_FAMILY_REDACTED_FIELDS = new Set([
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'internalNotes',
  'internal_notes',
  'billingInfo',
  'billing_info',
]);

function hasElevatedRole(context: UserContext): boolean {
  return context.roles.some((role) => ELEVATED_ROLES.has(role));
}

function isFamilyOrClientOnly(context: UserContext): boolean {
  if (hasElevatedRole(context)) {
    return false;
  }
  return context.roles.some((role) => FAMILY_OR_CLIENT_ROLES.has(role));
}

function isCaregiverOnly(context: UserContext): boolean {
  if (hasElevatedRole(context)) {
    return false;
  }
  return context.roles.includes('CAREGIVER');
}

function omitKeys<T extends Record<string, unknown>>(
  record: T,
  keysToOmit: Set<string>
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!keysToOmit.has(key)) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Project a visit record according to the caller's role.
 * - ADMIN / ORG_ADMIN / COORDINATOR: full visit fields
 * - FAMILY / FAMILY_MEMBER / CLIENT: excludes caregiver phone/email, internal notes, billing/payroll
 * - CAREGIVER: excludes billing/payroll/SSN fields
 */
export function projectVisitForRole<T extends Record<string, unknown>>(
  visit: T,
  context: UserContext
): Partial<T> {
  if (hasElevatedRole(context)) {
    return { ...visit };
  }

  if (isFamilyOrClientOnly(context)) {
    const projected = omitKeys(visit, VISIT_FAMILY_REDACTED_FIELDS) as Record<string, unknown>;
    if (
      projected['caregiver'] !== null &&
      typeof projected['caregiver'] === 'object' &&
      !Array.isArray(projected['caregiver'])
    ) {
      projected['caregiver'] = omitKeys(
        projected['caregiver'] as Record<string, unknown>,
        CAREGIVER_PRIVATE_FIELDS
      );
    }
    return projected as Partial<T>;
  }

  if (isCaregiverOnly(context)) {
    return omitKeys(visit, VISIT_CAREGIVER_REDACTED_FIELDS);
  }

  return { ...visit };
}

/**
 * Project a list of visit records according to the caller's role.
 */
export function projectVisitsForRole<T extends Record<string, unknown>>(
  visits: T[],
  context: UserContext
): Partial<T>[] {
  return visits.map((visit) => projectVisitForRole(visit, context));
}

/**
 * Project a caregiver record according to the caller's role.
 * - ADMIN / ORG_ADMIN / COORDINATOR / HR: full record
 * - CAREGIVER: full record only for own profile; otherwise strips private contact/payroll/SSN
 * - FAMILY / FAMILY_MEMBER / CLIENT: strips phone, email, address, SSN, payroll/payRate
 */
export function projectCaregiverForRole<T extends Record<string, unknown>>(
  caregiver: T,
  context: UserContext
): Partial<T> {
  if (hasElevatedRole(context) || context.roles.includes('HR')) {
    return { ...caregiver };
  }

  if (
    isCaregiverOnly(context) &&
    typeof caregiver['id'] === 'string' &&
    context.caregiverId !== undefined &&
    caregiver['id'] === context.caregiverId
  ) {
    return { ...caregiver };
  }

  return omitKeys(caregiver, CAREGIVER_PRIVATE_FIELDS);
}

/**
 * Project a client record according to the caller's role.
 * - ADMIN / ORG_ADMIN / COORDINATOR: full record
 * - CAREGIVER: strips SSN and billing/financial details
 * - FAMILY / FAMILY_MEMBER / CLIENT: strips SSN, internal notes, and billing details
 */
export function projectClientForRole<T extends Record<string, unknown>>(
  client: T,
  context: UserContext
): Partial<T> {
  if (hasElevatedRole(context)) {
    return { ...client };
  }

  if (isFamilyOrClientOnly(context)) {
    return omitKeys(client, CLIENT_FAMILY_REDACTED_FIELDS);
  }

  if (isCaregiverOnly(context)) {
    return omitKeys(client, CLIENT_CAREGIVER_REDACTED_FIELDS);
  }

  return { ...client };
}
