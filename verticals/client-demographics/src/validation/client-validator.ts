/**
 * Client validation logic
 */

import { z } from 'zod';
import { CreateClientInput, UpdateClientInput } from '../types/client';

const uuidRegex = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const uuidSchema = z.string().regex(uuidRegex, 'Invalid UUID');

const phoneSchema = z.object({
  number: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number'),
  type: z.enum(['MOBILE', 'HOME', 'WORK']),
  canReceiveSMS: z.boolean(),
});

const addressSchema = z.object({
  type: z.enum(['HOME', 'BILLING', 'TEMPORARY']),
  line1: z.string().min(1, 'Address line 1 required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City required'),
  state: z.string().length(2, 'State must be 2-letter code'),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid postal code'),
  county: z.string().optional(),
  country: z.string().default('US'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
});

const emergencyContactSchema = z.object({
  name: z.string().min(1, 'Name required'),
  relationship: z.string().min(1, 'Relationship required'),
  phone: phoneSchema,
  alternatePhone: phoneSchema.optional(),
  email: z.string().email().optional(),
  isPrimary: z.boolean(),
  canMakeHealthcareDecisions: z.boolean(),
  notes: z.string().optional(),
});

const consentsSchema = z.object({
  careAgreement: z.boolean(),
  hipaa: z.boolean(),
  financialResponsibility: z.boolean(),
  evv: z.boolean(),
  signature: z.string(),
  signedDate: z.string(),
});

const primaryPhysicianSchema = z.object({
  name: z.string(),
  phone: z.union([
    phoneSchema,
    z.object({
      number: z.string(),
      type: z.enum(['MOBILE', 'HOME', 'WORK', 'OTHER']).optional(),
      isPrimary: z.boolean().optional(),
    }),
  ]).optional(),
  npi: z.string().optional(),
  specialty: z.string().optional(),
  clinicName: z.string().optional(),
  email: z.string().optional(),
});

const insuranceSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['MEDICAID', 'MEDICARE', 'PRIVATE', 'VA', 'LONG_TERM_CARE', 'SELF_PAY', 'OTHER']),
  payerName: z.string().optional(),
  policyNumber: z.string().optional(),
  groupNumber: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const authorizationInfoSchema = z.object({
  number: z.string().optional(),
  approvedHours: z.number().nonnegative().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

const adlLevelSchema = z.enum(['independent', 'assistance', 'dependent']);

const assessmentDataSchema = z.object({
  adls: z
    .object({
      bathing: adlLevelSchema.optional(),
      dressing: adlLevelSchema.optional(),
      toileting: adlLevelSchema.optional(),
      transferring: adlLevelSchema.optional(),
      feeding: adlLevelSchema.optional(),
    })
    .optional(),
  iadls: z
    .object({
      housekeeping: adlLevelSchema.optional(),
      laundry: adlLevelSchema.optional(),
      mealPrep: adlLevelSchema.optional(),
      medication: adlLevelSchema.optional(),
      transportation: adlLevelSchema.optional(),
    })
    .optional(),
  mobility: z.enum(['ambulatory', 'walker', 'wheelchair', 'bedbound']).optional(),
  cognitive: z.enum(['normal', 'mild', 'moderate', 'severe']).optional(),
  conditions: z.array(z.string()).optional(),
  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string(),
        frequency: z.string(),
      })
    )
    .optional(),
  allergies: z.array(z.string()).optional(),
  dietaryNeeds: z.string().optional(),
});

const carePlanSummarySchema = z.object({
  serviceTypes: z.array(z.string()).optional(),
  visitFrequency: z.enum(['daily', '3xweek', '2xweek', 'weekly']).optional(),
  visitDuration: z.number().nonnegative().optional(),
  preferredTimes: z.array(z.string()).optional(),
  tasks: z.array(z.string()).optional(),
  goals: z.string().optional(),
});

const visitScheduleSchema = z.object({
  scheduleStartDate: z.string().optional(),
  visitSchedule: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        time: z.string(),
        duration: z.number().nonnegative(),
      })
    )
    .optional(),
});

const caregiverAssignmentSchema = z.object({
  primaryCaregiver: z.string().optional(),
  backupCaregivers: z.array(z.string()).optional(),
  preferences: z
    .object({
      gender: z.enum(['no-preference', 'female', 'male']).optional(),
      language: z.array(z.string()).optional(),
    })
    .optional(),
});

const createClientSchema = z.object({
  organizationId: uuidSchema,
  branchId: uuidSchema.optional(),
  firstName: z.string().min(1, 'First name required').max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1, 'Last name required').max(100),
  preferredName: z.string().max(100).optional(),
  dateOfBirth: z.coerce.date().refine(
    (date) => {
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return age >= 0 && age <= 150;
    },
    { message: 'Invalid date of birth' }
  ),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  primaryPhone: phoneSchema.optional(),
  email: z.string().email().optional(),
  primaryAddress: addressSchema.optional(),
  emergencyContacts: z.array(emergencyContactSchema).optional(),
  referralSource: z.string().max(200).optional(),
  intakeDate: z.coerce.date().optional(),
  status: z
    .enum([
      'INQUIRY',
      'PENDING_INTAKE',
      'ACTIVE',
      'INACTIVE',
      'ON_HOLD',
      'DISCHARGED',
      'DECEASED',
    ])
    .optional(),
  primaryPhysician: primaryPhysicianSchema.optional(),
  insurance: z.array(insuranceSchema).optional(),
  consents: consentsSchema.optional(),
  authorizationInfo: authorizationInfoSchema.optional(),
  assessmentData: assessmentDataSchema.optional(),
  carePlanSummary: carePlanSummarySchema.optional(),
  visitSchedule: visitScheduleSchema.optional(),
  caregiverAssignment: caregiverAssignmentSchema.optional(),
});

const updateClientSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    middleName: z.string().max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    preferredName: z.string().max(100).optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    primaryPhone: phoneSchema.optional(),
    alternatePhone: phoneSchema.optional(),
    email: z.string().email().optional(),
    primaryAddress: addressSchema.optional(),
    emergencyContacts: z.array(emergencyContactSchema).optional(),
    status: z
      .enum([
        'INQUIRY',
        'PENDING_INTAKE',
        'ACTIVE',
        'INACTIVE',
        'ON_HOLD',
        'DISCHARGED',
        'DECEASED',
      ])
      .optional(),
    primaryPhysician: primaryPhysicianSchema.optional(),
    insurance: z.array(insuranceSchema).optional(),
    consents: consentsSchema.optional(),
    authorizationInfo: authorizationInfoSchema.optional(),
    assessmentData: assessmentDataSchema.optional(),
    carePlanSummary: carePlanSummarySchema.optional(),
    visitSchedule: visitScheduleSchema.optional(),
    caregiverAssignment: caregiverAssignmentSchema.optional(),
    notes: z.string().optional(),
  })
  .partial();

export class ClientValidator {
  validateCreate(input: CreateClientInput): ValidationResult {
    try {
      createClientSchema.parse(input);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // PHASE 2 FIX (wdvf3abhb7): Enhanced error messages for production clarity
        // Map generic Zod messages to user-facing, actionable messages
        const messages = error.issues.map((e) => {
          const fieldPath = e.path.join('.');
          
          // Special handling for branchId
          if (fieldPath === 'branchId') {
            return {
              path: fieldPath,
              message: 'Branch ID must be a valid UUID. Organization must have at least one existing client or branch.',
            };
          }
          
          // Provide specific guidance for other critical fields
          if (fieldPath === 'organizationId') {
            return {
              path: fieldPath,
              message: 'Organization ID is required and must be a valid UUID.',
            };
          }
          
          if (fieldPath === 'firstName' || fieldPath === 'lastName') {
            return {
              path: fieldPath,
              message: `${fieldPath.charAt(0).toUpperCase() + fieldPath.slice(1)} is required (max 100 characters).`,
            };
          }
          
          if (fieldPath.includes('primaryAddress')) {
            return {
              path: fieldPath,
              message: `Address field is invalid: ${e.message}. Ensure all required address fields (line1, city, state, postalCode) are populated correctly.`,
            };
          }

          // Default: preserve original Zod message with field path
          return {
            path: fieldPath,
            message: e.message,
          };
        });
        
        return {
          success: false,
          errors: messages,
        };
      }
      return {
        success: false,
        errors: [{ path: 'unknown', message: 'Validation failed unexpectedly. Please contact support.' }],
      };
    }
  }

  validateUpdate(input: UpdateClientInput): ValidationResult {
    try {
      updateClientSchema.parse(input);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
      }
      return {
        success: false,
        errors: [{ path: 'unknown', message: 'Validation failed' }],
      };
    }
  }

  /**
   * Validate SSN format
   */
  validateSSN(ssn: string): boolean {
    return /^\d{3}-?\d{2}-?\d{4}$/.test(ssn);
  }

  /**
   * Validate email using a ReDoS-safe pattern.
   * Uses atomic groups via possessive quantifiers simulation with length limits.
   */
  validateEmail(email: string): boolean {
    // Length check first to prevent ReDoS on long strings
    if (email.length > 254) return false;
    // Simple, safe email validation without nested quantifiers
    // Split and check parts to avoid backtracking
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || !domain || local.length > 64 || domain.length > 253) return false;
    // Check domain has at least one dot
    if (!domain.includes('.')) return false;
    // Check no leading/trailing dots or spaces
    if (/^\s|\s$|^\.|\.$/.test(local) || /^\s|\s$|^\.|\.$/.test(domain)) return false;
    return true;
  }

  /**
   * Validate age requirement (18+ for most programs)
   */
  validateMinimumAge(dateOfBirth: Date, minimumAge: number = 18): boolean {
    const age = this.calculateAge(dateOfBirth);
    return age >= minimumAge;
  }

  /**
   * Calculate age from date of birth
   */
  calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
    ) {
      age--;
    }

    return age;
  }
}

interface ValidationResult {
  success: boolean;
  errors?: Array<{ path: string; message: string }>;
}
