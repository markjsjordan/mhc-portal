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

export interface FamilyPortalAccessRow extends PortalAccessSummary {
  familyMemberId: string;
  firstName: string;
  lastName: string;
  relationship: string;          // family_members.relationship
  email: string;
  portalAccessLevel: 'VIEW_BASIC' | 'VIEW_DETAILED' | 'VIEW_MEDICAL' | 'VIEW_FINANCIAL' | 'FULL_ACCESS';
}

