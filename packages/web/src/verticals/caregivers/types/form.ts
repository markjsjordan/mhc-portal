export interface CaregiverFormValues {
  firstName: string;
  lastName: string;
  middleName: string;
  preferredName: string;
  email: string;
  phoneNumber: string;
  phoneType: 'MOBILE' | 'HOME' | 'WORK';
  dateOfBirth: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'PER_DIEM' | 'CONTRACT' | 'TEMPORARY' | 'SEASONAL';
  hireDate: string;
  role: string;
  status: string;
  branchIdsRaw: string;
  primaryBranchId: string;
  payRateAmount: string;
  payRateUnit: 'HOURLY' | 'VISIT' | 'DAILY' | 'SALARY';
  payRateEffectiveDate: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
}

export const EMPTY_CAREGIVER_FORM: CaregiverFormValues = {
  firstName: '',
  lastName: '',
  middleName: '',
  preferredName: '',
  email: '',
  phoneNumber: '',
  phoneType: 'MOBILE',
  dateOfBirth: '',
  employmentType: 'FULL_TIME',
  hireDate: '',
  role: 'CAREGIVER',
  status: 'ACTIVE',
  branchIdsRaw: '',
  primaryBranchId: '',
  payRateAmount: '20.00',
  payRateUnit: 'HOURLY',
  payRateEffectiveDate: new Date().toISOString().split('T')[0] ?? '',
  addressLine1: '',
  addressLine2: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
};
