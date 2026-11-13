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
  phoneType?: 'MOBILE' | 'HOME' | 'WORK';
  phoneCanReceiveSMS?: boolean;
  email: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    id?: string;
    isPrimary?: boolean;
    canMakeHealthcareDecisions?: boolean;
    phoneType?: 'MOBILE' | 'HOME' | 'WORK';
    canReceiveSMS?: boolean;
    email?: string;
    notes?: string;
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
/**
 * What the API actually returns. `Client` declares primaryAddress and emergencyContacts
 * as always present, but a client can be saved without an address (intake allows it)
 * and older rows can lack contacts, so the mapper must not trust those two fields.
 * Widening only the mapper's input keeps the guards honest without changing `Client`,
 * which ClientCard, ClientDetail and the scheduler still dereference directly.
 */
type ClientWire = Omit<Client, 'primaryAddress' | 'emergencyContacts'> & {
  primaryAddress?: Client['primaryAddress'] | null;
  emergencyContacts?: Client['emergencyContacts'] | null;
};

export function mapClientToIntakeData(client: Client | ClientWire): Partial<IntakeData> {
  return {
    // Demographics
    firstName: client.firstName,
    lastName: client.lastName,
    middleName: client.middleName ?? '',
    preferredName: client.preferredName ?? '',
    dateOfBirth: client.dateOfBirth
      ? new Date(client.dateOfBirth).toISOString().split('T')[0]
      : '',
    gender: client.gender ?? '',

    // Address. The API can return a client saved without one (intake allows it), so
    // never dereference primaryAddress unguarded: that crashed the edit page.
    address: {
      line1: client.primaryAddress?.line1 ?? '',
      line2: client.primaryAddress?.line2 ?? '',
      city: client.primaryAddress?.city ?? '',
      state: client.primaryAddress?.state ?? '',
      postalCode: client.primaryAddress?.postalCode ?? '',
    },

    // Contact
    phone: client.primaryPhone?.number ?? '',
    ...(client.primaryPhone && {
      phoneType: client.primaryPhone.type,
      phoneCanReceiveSMS: client.primaryPhone.canReceiveSMS,
    }),
    email: client.email ?? '',

    // Saved emergency contacts. Without this the edit form opened empty and saving
    // sent emergencyContacts: [], which overwrote the stored list.
    emergencyContacts: (client.emergencyContacts ?? []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone.number,
      isPrimary: contact.isPrimary,
      canMakeHealthcareDecisions: contact.canMakeHealthcareDecisions,
      phoneType: contact.phone.type,
      canReceiveSMS: contact.phone.canReceiveSMS,
      ...(contact.email !== undefined && { email: contact.email }),
      ...(contact.notes !== undefined && { notes: contact.notes }),
    })),

    // Default empty structures for other fields
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
