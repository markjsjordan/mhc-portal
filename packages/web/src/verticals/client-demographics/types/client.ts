// Frontend types for client demographics (simplified from backend)
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type ClientStatus = 'INQUIRY' | 'PENDING_INTAKE' | 'ACTIVE' | 'INACTIVE' | 'ON_HOLD' | 'DISCHARGED' | 'DECEASED';
export type ContactMethod = 'PHONE' | 'EMAIL' | 'SMS' | 'MAIL' | 'IN_PERSON';

export interface Phone {
  number: string;
  type: 'MOBILE' | 'HOME' | 'WORK';
  canReceiveSMS: boolean;
}

export interface Address {
  type: 'HOME' | 'BILLING' | 'TEMPORARY';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  county?: string;
  country: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: Phone;
  alternatePhone?: Phone;
  email?: string;
  isPrimary: boolean;
  canMakeHealthcareDecisions: boolean;
  notes?: string;
}

export interface ClientConsents {
  careAgreement: boolean;
  hipaa: boolean;
  financialResponsibility: boolean;
  evv: boolean;
  signature: string;
  signedDate: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface ClientPrimaryPhysician {
  name: string;
  phone?: Phone | { number: string; type?: 'MOBILE' | 'HOME' | 'WORK' | 'OTHER'; isPrimary?: boolean };
}

export interface ClientInsurance {
  id?: string;
  type: 'MEDICAID' | 'MEDICARE' | 'PRIVATE' | 'VA' | 'LONG_TERM_CARE' | 'SELF_PAY' | 'OTHER';
  payerName?: string;
  policyNumber?: string;
  groupNumber?: string;
  isPrimary?: boolean;
}

export interface ClientAuthorizationInfo {
  number?: string;
  approvedHours?: number;
  validFrom?: string;
  validTo?: string;
}

export type AdlLevel = 'independent' | 'assistance' | 'dependent';

export interface ClientAssessmentData {
  adls?: {
    bathing?: AdlLevel;
    dressing?: AdlLevel;
    toileting?: AdlLevel;
    transferring?: AdlLevel;
    feeding?: AdlLevel;
  };
  iadls?: {
    housekeeping?: AdlLevel;
    laundry?: AdlLevel;
    mealPrep?: AdlLevel;
    medication?: AdlLevel;
    transportation?: AdlLevel;
  };
  mobility?: 'ambulatory' | 'walker' | 'wheelchair' | 'bedbound';
  cognitive?: 'normal' | 'mild' | 'moderate' | 'severe';
  conditions?: string[];
  medications?: Array<{ name: string; dosage: string; frequency: string }>;
  allergies?: string[];
  dietaryNeeds?: string;
}

export interface ClientCarePlanSummary {
  serviceTypes?: string[];
  visitFrequency?: 'daily' | '3xweek' | '2xweek' | 'weekly';
  visitDuration?: number;
  preferredTimes?: string[];
  tasks?: string[];
  goals?: string;
}

export interface ClientVisitSchedule {
  scheduleStartDate?: string;
  visitSchedule?: Array<{ dayOfWeek: number; time: string; duration: number }>;
}

export interface ClientCaregiverAssignment {
  primaryCaregiver?: string;
  backupCaregivers?: string[];
  preferences?: {
    gender?: 'no-preference' | 'female' | 'male';
    language?: string[];
  };
}

export interface Client {
  id: string;
  organizationId: string;
  branchId: string;
  clientNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender?: Gender;
  primaryPhone?: Phone;
  alternatePhone?: Phone;
  email?: string;
  preferredContactMethod?: ContactMethod;
  primaryAddress: Address;
  emergencyContacts: EmergencyContact[];
  status: ClientStatus;
  intakeDate?: string;
  dischargeDate?: string;
  isDemoData?: boolean;
  primaryPhysician?: ClientPrimaryPhysician;
  insurance?: ClientInsurance[];
  consents?: ClientConsents;
  authorizationInfo?: ClientAuthorizationInfo;
  assessmentData?: ClientAssessmentData;
  carePlanSummary?: ClientCarePlanSummary;
  visitSchedule?: ClientVisitSchedule;
  caregiverAssignment?: ClientCaregiverAssignment;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  organizationId: string;
  branchId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: string;
  gender?: Gender;
  primaryPhone?: Phone;
  email?: string;
  primaryAddress?: Address;
  emergencyContacts?: EmergencyContact[];
  status?: ClientStatus;
  primaryPhysician?: ClientPrimaryPhysician;
  insurance?: ClientInsurance[];
  consents?: ClientConsents;
  authorizationInfo?: ClientAuthorizationInfo;
  assessmentData?: ClientAssessmentData;
  carePlanSummary?: ClientCarePlanSummary;
  visitSchedule?: ClientVisitSchedule;
  caregiverAssignment?: ClientCaregiverAssignment;
}

export interface UpdateClientInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  primaryPhone?: Phone;
  alternatePhone?: Phone;
  email?: string;
  primaryAddress?: Address;
  emergencyContacts?: EmergencyContact[];
  status?: ClientStatus;
  primaryPhysician?: ClientPrimaryPhysician;
  insurance?: ClientInsurance[];
  consents?: ClientConsents;
  authorizationInfo?: ClientAuthorizationInfo;
  assessmentData?: ClientAssessmentData;
  carePlanSummary?: ClientCarePlanSummary;
  visitSchedule?: ClientVisitSchedule;
  caregiverAssignment?: ClientCaregiverAssignment;
}

export interface ClientSearchFilters {
  query?: string;
  status?: ClientStatus[];
  serviceLevel?: string[];
  insuranceType?: string[];
  city?: string;
  state?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
}

export type ClientFiltersFilters = ClientSearchFilters;

export type PortalAccessStatus = 'NONE' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface PortalAccessSummary {
  status: PortalAccessStatus;
  invitedAt: string | null;      // ISO
  activatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;  // only for callers with the update permission; otherwise null
  inviteExpiresAt: string | null; // the latest PENDING invite_tokens.expires_at
  lastLoginAt: string | null;    // users.last_login_at of the linked user
  linked: boolean;               // user_id IS NOT NULL
}

export type FamilyRelationship =
  | 'SPOUSE'
  | 'PARENT'
  | 'CHILD'
  | 'SIBLING'
  | 'GRANDPARENT'
  | 'GRANDCHILD'
  | 'GUARDIAN'
  | 'POWER_OF_ATTORNEY'
  | 'HEALTHCARE_PROXY'
  | 'OTHER';

export type PortalAccessLevel =
  | 'VIEW_BASIC'
  | 'VIEW_DETAILED'
  | 'VIEW_MEDICAL'
  | 'VIEW_FINANCIAL'
  | 'FULL_ACCESS';

export interface CreateFamilyMemberPortalInput {
  firstName: string;
  lastName: string;
  relationship: FamilyRelationship;
  relationshipNote?: string;
  email: string;
  phoneNumber: string;
  isPrimaryContact?: boolean;
  portalAccessLevel?: PortalAccessLevel;
}

export interface FamilyPortalAccessRow extends PortalAccessSummary {
  familyMemberId: string;
  firstName: string;
  lastName: string;
  relationship: string;          // family_members.relationship
  email: string;
  portalAccessLevel: PortalAccessLevel;
}


export interface ClientPortalAccess {
  clientId: string;
  email: string;
  clientStatus: string;
  status: PortalAccessStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  inviteExpiresAt: string | null;
  linked: boolean;
}
