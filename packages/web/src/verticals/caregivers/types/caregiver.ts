/**
 * Caregiver frontend types
 */

export type CaregiverStatus =
  | 'APPLICATION'
  | 'INTERVIEWING'
  | 'PENDING_ONBOARDING'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'RETIRED';

export interface Caregiver {
  id: string;
  organizationId: string;
  branchIds: string[];
  primaryBranchId: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth: Date | string;
  email: string;
  primaryPhone: {
    number: string;
    type: 'MOBILE' | 'HOME' | 'WORK';
    canReceiveSMS: boolean;
  };
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'PER_DIEM' | 'CONTRACT' | 'TEMPORARY' | 'SEASONAL';
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'RETIRED';
  hireDate: Date | string;
  role: string;
  status: 'APPLICATION' | 'INTERVIEWING' | 'PENDING_ONBOARDING' | 'ONBOARDING' | 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'RETIRED';
  complianceStatus: 'COMPLIANT' | 'PENDING_VERIFICATION' | 'EXPIRING_SOON' | 'EXPIRED' | 'NON_COMPLIANT';
  credentials: Credential[];
  training: TrainingRecord[];
  isDemoData?: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Persisted by CaregiverRepository (primary_address, emergency_contacts, pay_rate, version).
  // Optional: parsed with defaults and may be absent on older records.
  primaryAddress?: CaregiverAddress;
  emergencyContacts?: CaregiverEmergencyContact[];
  payRate?: CaregiverPayRate;
  version?: number;
}

export interface CaregiverAddress {
  type?: 'HOME' | 'MAILING';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface CaregiverEmergencyContact {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
}

export interface CaregiverPayRate {
  id?: string;
  rateType?: string;
  amount: number;
  unit: 'HOURLY' | 'VISIT' | 'DAILY' | 'SALARY';
  effectiveDate: Date | string;
  endDate?: Date | string;
}

export interface Credential {
  id: string;
  type: string;
  name: string;
  number?: string;
  issueDate: Date;
  expirationDate?: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_VERIFICATION' | 'REVOKED';
}

export interface TrainingRecord {
  id: string;
  name: string;
  category: string;
  completionDate: Date;
  expirationDate?: Date;
  status: 'COMPLETED' | 'EXPIRED' | 'IN_PROGRESS';
}

export interface CaregiverListItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  email: string;
  primaryPhone: {
    number: string;
    type: 'MOBILE' | 'HOME' | 'WORK';
    canReceiveSMS: boolean;
  };
  role: string;
  status: string;
  complianceStatus: string;
  employmentType: string;
  hireDate: Date;
  isDemoData?: boolean;
}

export interface CaregiverSearchFilters {
  query?: string;
  status?: string[];
  role?: string[];
  employmentType?: string[];
  complianceStatus?: string[];
  branchId?: string;
  credentialExpiring?: boolean;
  hireDateFrom?: string;
  hireDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedCaregivers {
  items: CaregiverListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
