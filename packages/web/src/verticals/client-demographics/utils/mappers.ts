import type { Client } from '../types/client';

type BathingLevel = 'independent' | 'assistance' | 'dependent';

/**
 * IntakeData interface used by ClientIntakeWorkflow
 * Mirrors the form data structure used in the workflow
 */
export interface IntakeData {
  // Step 1: Demographics & Contact
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth: string;
  gender?: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  phone: string;
  email: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  physician: {
    name: string;
    phone: string;
  };
  insurance: {
    type: 'medicare' | 'medicaid' | 'private' | 'other';
    memberId: string;
    groupNumber: string;
  };
  authorization: {
    number: string;
    approvedHours: number;
    validFrom: string;
    validTo: string;
  };

  // Step 2: Care Assessment
  adls: {
    bathing: BathingLevel;
    dressing: BathingLevel;
    toileting: BathingLevel;
    transferring: BathingLevel;
    feeding: BathingLevel;
  };
  iadls: {
    housekeeping: BathingLevel;
    laundry: BathingLevel;
    mealPrep: BathingLevel;
    medication: BathingLevel;
    transportation: BathingLevel;
  };
  mobility: 'ambulatory' | 'walker' | 'wheelchair' | 'bedbound';
  cognitive: 'normal' | 'mild' | 'moderate' | 'severe';
  conditions: string[];
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  allergies: string[];
  dietaryNeeds: string;

  // Step 3: Care Plan
  serviceTypes: string[];
  visitFrequency: 'daily' | '3xweek' | '2xweek' | 'weekly';
  visitDuration: number;
  preferredTimes: string[];
  tasks: string[];
  goals: string;

  // Step 4: Caregiver Assignment
  primaryCaregiver: string;
  backupCaregivers: string[];
  preferences: {
    gender: 'no-preference' | 'female' | 'male';
    language: string[];
  };

  // Step 5: Initial Schedule
  scheduleStartDate: string;
  visitSchedule: Array<{
    dayOfWeek: number;
    time: string;
    duration: number;
  }>;

  // Step 6: Consent
  consents: {
    careAgreement: boolean;
    hipaa: boolean;
    financialResponsibility: boolean;
    evv: boolean;
  };
  signature: string;
  signedDate: string;
}

/**
 * Map a Client database object to IntakeData form structure
 * Handles type conversions and provides sensible defaults for missing fields
 */
export function mapClientToIntakeData(client: Client): Partial<IntakeData> {
  return {
    // Demographics
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    middleName: client.middleName || '',
    preferredName: client.preferredName || '',
    dateOfBirth: client.dateOfBirth
      ? new Date(client.dateOfBirth).toISOString().split('T')[0]
      : '',
    gender: client.gender || '',

    // Address
    address: {
      line1: client.primaryAddress?.line1 || '',
      line2: client.primaryAddress?.line2 || '',
      city: client.primaryAddress?.city || '',
      state: client.primaryAddress?.state || '',
      postalCode: client.primaryAddress?.postalCode || '',
    },

    // Contact
    phone: client.primaryPhone?.number || '',
    email: client.email || '',

    // Default empty structures for other fields
    emergencyContacts: [],
    physician: {
      name: '',
      phone: '',
    },
    insurance: {
      type: 'private' as const,
      memberId: '',
      groupNumber: '',
    },
    authorization: {
      number: '',
      approvedHours: 0,
      validFrom: '',
      validTo: '',
    },
    adls: {
      bathing: 'independent',
      dressing: 'independent',
      toileting: 'independent',
      transferring: 'independent',
      feeding: 'independent',
    },
    iadls: {
      housekeeping: 'independent',
      laundry: 'independent',
      mealPrep: 'independent',
      medication: 'independent',
      transportation: 'independent',
    },
    mobility: 'ambulatory',
    cognitive: 'normal',
    conditions: [],
    medications: [],
    allergies: [],
    dietaryNeeds: '',
    serviceTypes: [],
    visitFrequency: 'weekly' as const,
    visitDuration: 1,
    preferredTimes: [],
    tasks: [],
    goals: '',
    primaryCaregiver: '',
    backupCaregivers: [],
    preferences: {
      gender: 'no-preference',
      language: [],
    },
    scheduleStartDate: '',
    visitSchedule: [],
    consents: {
      careAgreement: false,
      hipaa: false,
      financialResponsibility: false,
      evv: false,
    },
    signature: '',
    signedDate: '',
  };
}
