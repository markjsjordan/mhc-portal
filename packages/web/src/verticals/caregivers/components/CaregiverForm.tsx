/**
 * Caregiver Form
 *
 * Collects every field the backend's CreateCaregiverSchema (Zod, see
 * verticals/caregiver-staff/src/validation/caregiver-validator.ts) actually
 * requires for POST /api/caregivers. The route handler
 * (packages/app/src/routes/caregivers.ts ~L186-195) unconditionally does
 * `new Date(req.body.dateOfBirth)` and reads `req.body.payRate.effectiveDate`
 * BEFORE validation runs, so a payload missing those fields throws a raw
 * TypeError (500), not a clean validation error. This form makes dateOfBirth,
 * hireDate, and payRate.effectiveDate real required fields so that crash path
 * is never hit. It also collects primaryAddress and one emergencyContact,
 * which the Zod schema requires (min 1 emergency contact, full address) —
 * without them the service layer still rejects with a clean 400, but the
 * create flow would never actually succeed for a real user.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Input, Select, FormField } from '@/core/components';
import type { SelectOption } from '@/core/components/forms/Select';
import { useBranches } from '@/verticals/client-demographics/hooks/index.js';
import { Search, ChevronDown, Check, X } from 'lucide-react';

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
  payRateAmount: '',
  payRateUnit: 'HOURLY',
  payRateEffectiveDate: '',
  addressLine1: '',
  addressLine2: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactPhone: '',
};

const roleOptions: SelectOption[] = [
  { value: 'CAREGIVER', label: 'Caregiver' },
  { value: 'SENIOR_CAREGIVER', label: 'Senior Caregiver' },
  { value: 'CERTIFIED_NURSING_ASSISTANT', label: 'Certified Nursing Assistant' },
  { value: 'HOME_HEALTH_AIDE', label: 'Home Health Aide' },
  { value: 'PERSONAL_CARE_AIDE', label: 'Personal Care Aide' },
  { value: 'COMPANION', label: 'Companion' },
  { value: 'NURSE_RN', label: 'Registered Nurse' },
  { value: 'NURSE_LPN', label: 'Licensed Practical Nurse' },
  { value: 'THERAPIST', label: 'Therapist' },
  { value: 'COORDINATOR', label: 'Coordinator' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SCHEDULER', label: 'Scheduler' },
  { value: 'ADMINISTRATIVE', label: 'Administrative' },
];

const employmentTypeOptions: SelectOption[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'PER_DIEM', label: 'Per Diem' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'SEASONAL', label: 'Seasonal' },
];

const statusOptions: SelectOption[] = [
  { value: 'APPLICATION', label: 'Application' },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'PENDING_ONBOARDING', label: 'Pending Onboarding' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const phoneTypeOptions: SelectOption[] = [
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'HOME', label: 'Home' },
  { value: 'WORK', label: 'Work' },
];

const payUnitOptions: SelectOption[] = [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'VISIT', label: 'Per Visit' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'SALARY', label: 'Salary' },
];

export interface CaregiverFormProps {
  values: CaregiverFormValues;
  onChange: (values: CaregiverFormValues) => void;
  errors?: Partial<Record<keyof CaregiverFormValues, string>>;
  disabled?: boolean;
}

export const CaregiverForm: React.FC<CaregiverFormProps> = ({
  values,
  onChange,
  errors = {},
  disabled = false,
}) => {
  const { data: fetchedBranches = [] } = useBranches();
  const [branchSearch, setBranchSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // If backend returns branches, use them. Otherwise provide a default Main branch fallback
  const availableBranches = fetchedBranches.length > 0
    ? fetchedBranches
    : [{ id: '00000000-0000-0000-0000-000000000002', name: 'Main Branch', code: 'MAIN' }];

  const set = <K extends keyof CaregiverFormValues>(key: K, value: CaregiverFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Parse currently selected branch IDs from branchIdsRaw
  const selectedBranchIds = values.branchIdsRaw
    ? values.branchIdsRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  // Auto-select "Main" branch on load if no branch is currently selected
  useEffect(() => {
    if (availableBranches.length > 0 && selectedBranchIds.length === 0 && !values.primaryBranchId) {
      const mainBranch =
        availableBranches.find(
          (b) => b.name?.toLowerCase().includes('main') || b.code?.toLowerCase().includes('main')
        ) || availableBranches[0];

      if (mainBranch) {
        onChange({
          ...values,
          branchIdsRaw: mainBranch.id,
          primaryBranchId: mainBranch.id,
        });
      }
    }
  }, [availableBranches, selectedBranchIds.length, values, onChange]);

  const toggleBranchSelection = (branchId: string) => {
    const exists = selectedBranchIds.includes(branchId);
    let nextBranchIds: string[];
    let nextPrimary = values.primaryBranchId;

    if (exists) {
      nextBranchIds = selectedBranchIds.filter((id) => id !== branchId);
      if (nextPrimary === branchId) {
        nextPrimary = nextBranchIds[0] || '';
      }
    } else {
      nextBranchIds = [...selectedBranchIds, branchId];
      if (!nextPrimary) {
        nextPrimary = branchId;
      }
    }

    onChange({
      ...values,
      branchIdsRaw: nextBranchIds.join(', '),
      primaryBranchId: nextPrimary,
    });
  };

  const setPrimaryBranch = (branchId: string) => {
    const nextBranchIds = selectedBranchIds.includes(branchId)
      ? selectedBranchIds
      : [...selectedBranchIds, branchId];

    onChange({
      ...values,
      branchIdsRaw: nextBranchIds.join(', '),
      primaryBranchId: branchId,
    });
  };

  const filteredBranches = availableBranches.filter((b) => {
    const q = branchSearch.toLowerCase();
    return b.name?.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="First Name" required error={errors.firstName}>
            <Input
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              disabled={disabled}
              placeholder="Jane"
            />
          </FormField>
          <FormField label="Last Name" required error={errors.lastName}>
            <Input
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              disabled={disabled}
              placeholder="Doe"
            />
          </FormField>
          <FormField label="Middle Name" error={errors.middleName}>
            <Input
              value={values.middleName}
              onChange={(e) => set('middleName', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Preferred Name" error={errors.preferredName}>
            <Input
              value={values.preferredName}
              onChange={(e) => set('preferredName', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Date of Birth" required error={errors.dateOfBirth}>
            <Input
              type="date"
              value={values.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Email" required error={errors.email}>
            <Input
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={disabled}
              placeholder="jane@example.com"
            />
          </FormField>
          <FormField label="Phone Number" required error={errors.phoneNumber}>
            <Input
              type="tel"
              value={values.phoneNumber}
              onChange={(e) => set('phoneNumber', e.target.value)}
              disabled={disabled}
              placeholder="5551234567"
            />
          </FormField>
          <Select
            label="Phone Type"
            required
            options={phoneTypeOptions}
            value={values.phoneType}
            onChange={(e) => set('phoneType', e.target.value as CaregiverFormValues['phoneType'])}
            disabled={disabled}
          />
        </div>
      </section>

      {/* Home Address (required by backend validator) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Home Address</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Street Address" required error={errors.addressLine1} className="md:col-span-2">
            <Input
              value={values.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
              disabled={disabled}
              placeholder="123 Main St"
            />
          </FormField>
          <FormField label="Apt / Suite" error={errors.addressLine2} className="md:col-span-2">
            <Input
              value={values.addressLine2}
              onChange={(e) => set('addressLine2', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="City" required error={errors.addressCity}>
            <Input
              value={values.addressCity}
              onChange={(e) => set('addressCity', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="State (2-letter)" required error={errors.addressState}>
            <Input
              value={values.addressState}
              onChange={(e) => set('addressState', e.target.value.toUpperCase())}
              maxLength={2}
              disabled={disabled}
              placeholder="TX"
            />
          </FormField>
          <FormField label="ZIP Code" required error={errors.addressPostalCode}>
            <Input
              value={values.addressPostalCode}
              onChange={(e) => set('addressPostalCode', e.target.value)}
              disabled={disabled}
              placeholder="78701"
            />
          </FormField>
        </div>
      </section>

      {/* Emergency Contact (required by backend validator: min 1) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Emergency Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.emergencyContactName}>
            <Input
              value={values.emergencyContactName}
              onChange={(e) => set('emergencyContactName', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Relationship" required error={errors.emergencyContactRelationship}>
            <Input
              value={values.emergencyContactRelationship}
              onChange={(e) => set('emergencyContactRelationship', e.target.value)}
              disabled={disabled}
              placeholder="Spouse, Parent, Sibling..."
            />
          </FormField>
          <FormField label="Phone Number" required error={errors.emergencyContactPhone}>
            <Input
              type="tel"
              value={values.emergencyContactPhone}
              onChange={(e) => set('emergencyContactPhone', e.target.value)}
              disabled={disabled}
              placeholder="5559876543"
            />
          </FormField>
        </div>
      </section>

      {/* Employment */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Employment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Role"
            required
            options={roleOptions}
            value={values.role}
            onChange={(e) => set('role', e.target.value)}
            disabled={disabled}
          />
          <Select
            label="Employment Type"
            required
            options={employmentTypeOptions}
            value={values.employmentType}
            onChange={(e) => set('employmentType', e.target.value as CaregiverFormValues['employmentType'])}
            disabled={disabled}
          />
          <Select
            label="Status"
            options={statusOptions}
            value={values.status}
            onChange={(e) => set('status', e.target.value)}
            disabled={disabled}
          />
          <FormField label="Hire Date" required error={errors.hireDate}>
            <Input
              type="date"
              value={values.hireDate}
              onChange={(e) => set('hireDate', e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
      </section>

      {/* Branches */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Branch Assignment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Branch Selector Dropdown */}
          <div className="space-y-1 relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700">
              Assigned Branches <span className="text-red-500">*</span>
            </label>
            <div
              className={`min-h-[38px] w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer flex flex-wrap items-center justify-between gap-1.5 ${
                errors.branchIdsRaw ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300 focus-within:border-primary-500'
              } ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-75' : ''}`}
              onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
              data-testid="branch-dropdown-toggle"
            >
              <div className="flex flex-wrap items-center gap-1 flex-1">
                {selectedBranchIds.length === 0 ? (
                  <span className="text-gray-400">Select branches...</span>
                ) : (
                  selectedBranchIds.map((branchId) => {
                    const branch = availableBranches.find((b) => b.id === branchId);
                    const name = branch ? `${branch.name}${branch.code ? ` (${branch.code})` : ''}` : branchId;
                    const isPrimary = values.primaryBranchId === branchId;
                    return (
                      <span
                        key={branchId}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isPrimary
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {name} {isPrimary && '(Primary)'}
                        {!disabled && (
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600 focus:outline-none ml-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBranchSelection(branchId);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    );
                  })
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            </div>

            {/* Dropdown popup */}
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 py-1 max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Search branches..."
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-44 py-1">
                  {filteredBranches.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center">No branches found</div>
                  ) : (
                    filteredBranches.map((branch) => {
                      const isSelected = selectedBranchIds.includes(branch.id);
                      return (
                        <div
                          key={branch.id}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-sm"
                          onClick={() => toggleBranchSelection(branch.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="font-medium text-gray-900">{branch.name}</span>
                            {branch.code && <span className="text-xs text-gray-400">({branch.code})</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {errors.branchIdsRaw && <p className="text-xs text-red-600 mt-1">{errors.branchIdsRaw}</p>}
            <p className="text-xs text-gray-500 mt-1">Select one or more branches assigned to this caregiver.</p>
          </div>

          {/* Primary Branch Dropdown */}
          <FormField
            label="Primary Branch"
            required
            error={errors.primaryBranchId}
            helperText="The primary location for this caregiver's employment records and scheduling"
          >
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              value={values.primaryBranchId}
              onChange={(e) => setPrimaryBranch(e.target.value)}
              disabled={disabled || selectedBranchIds.length === 0}
            >
              {selectedBranchIds.length === 0 ? (
                <option value="">Select an assigned branch first</option>
              ) : (
                selectedBranchIds.map((branchId) => {
                  const b = availableBranches.find((item) => item.id === branchId);
                  const name = b ? `${b.name}${b.code ? ` (${b.code})` : ''}` : branchId;
                  return (
                    <option key={branchId} value={branchId}>
                      {name}
                    </option>
                  );
                })
              )}
            </select>
          </FormField>
        </div>
      </section>

      {/* Pay Rate */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Pay Rate</h2>
        <p className="text-sm text-gray-500">
          Required so the create request always carries a complete payRate.effectiveDate
          (the backend throws a 500 if this is missing).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Amount ($)" required error={errors.payRateAmount}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values.payRateAmount}
              onChange={(e) => set('payRateAmount', e.target.value)}
              disabled={disabled}
              placeholder="20.00"
            />
          </FormField>
          <Select
            label="Unit"
            required
            options={payUnitOptions}
            value={values.payRateUnit}
            onChange={(e) => set('payRateUnit', e.target.value as CaregiverFormValues['payRateUnit'])}
            disabled={disabled}
          />
          <FormField label="Effective Date" required error={errors.payRateEffectiveDate}>
            <Input
              type="date"
              value={values.payRateEffectiveDate}
              onChange={(e) => set('payRateEffectiveDate', e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
      </section>
    </div>
  );
};
