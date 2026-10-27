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
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
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

export interface SelectOption {
  value: string;
  label: string;
}

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
        <h2 className="text-lg font-semibold text-foreground">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="caregiver-first-name">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-first-name"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              disabled={disabled}
              placeholder="Jane"
            />
            {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-last-name">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-last-name"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              disabled={disabled}
              placeholder="Doe"
            />
            {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-middle-name">Middle Name</Label>
            <Input
              id="caregiver-middle-name"
              value={values.middleName}
              onChange={(e) => set('middleName', e.target.value)}
              disabled={disabled}
            />
            {errors.middleName && <p className="text-sm text-destructive">{errors.middleName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-preferred-name">Preferred Name</Label>
            <Input
              id="caregiver-preferred-name"
              value={values.preferredName}
              onChange={(e) => set('preferredName', e.target.value)}
              disabled={disabled}
            />
            {errors.preferredName && <p className="text-sm text-destructive">{errors.preferredName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-date-of-birth">
              Date of Birth <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-date-of-birth"
              type="date"
              value={values.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              disabled={disabled}
            />
            {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth}</p>}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="caregiver-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              disabled={disabled}
              placeholder="jane@example.com"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-phone-number">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-phone-number"
              type="tel"
              value={values.phoneNumber}
              onChange={(e) => set('phoneNumber', e.target.value)}
              disabled={disabled}
              placeholder="5551234567"
            />
            {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-phone-type">
              Phone Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={values.phoneType}
              onValueChange={(val) => set('phoneType', val as CaregiverFormValues['phoneType'])}
              disabled={disabled}
            >
              <SelectTrigger id="caregiver-phone-type">
                <SelectValue placeholder="Select phone type" />
              </SelectTrigger>
              <SelectContent>
                {phoneTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Home Address (required by backend validator) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Home Address</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="caregiver-address-line1">
              Street Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-address-line1"
              value={values.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
              disabled={disabled}
              placeholder="123 Main St"
            />
            {errors.addressLine1 && <p className="text-sm text-destructive">{errors.addressLine1}</p>}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="caregiver-address-line2">Apt / Suite</Label>
            <Input
              id="caregiver-address-line2"
              value={values.addressLine2}
              onChange={(e) => set('addressLine2', e.target.value)}
              disabled={disabled}
            />
            {errors.addressLine2 && <p className="text-sm text-destructive">{errors.addressLine2}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-address-city">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-address-city"
              value={values.addressCity}
              onChange={(e) => set('addressCity', e.target.value)}
              disabled={disabled}
            />
            {errors.addressCity && <p className="text-sm text-destructive">{errors.addressCity}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-address-state">
              State (2-letter) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-address-state"
              value={values.addressState}
              onChange={(e) => set('addressState', e.target.value.toUpperCase())}
              maxLength={2}
              disabled={disabled}
              placeholder="TX"
            />
            {errors.addressState && <p className="text-sm text-destructive">{errors.addressState}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-address-postal-code">
              ZIP Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-address-postal-code"
              value={values.addressPostalCode}
              onChange={(e) => set('addressPostalCode', e.target.value)}
              disabled={disabled}
              placeholder="78701"
            />
            {errors.addressPostalCode && (
              <p className="text-sm text-destructive">{errors.addressPostalCode}</p>
            )}
          </div>
        </div>
      </section>

      {/* Emergency Contact (required by backend validator: min 1) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Emergency Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="caregiver-emergency-contact-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-emergency-contact-name"
              value={values.emergencyContactName}
              onChange={(e) => set('emergencyContactName', e.target.value)}
              disabled={disabled}
            />
            {errors.emergencyContactName && (
              <p className="text-sm text-destructive">{errors.emergencyContactName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-emergency-contact-relationship">
              Relationship <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-emergency-contact-relationship"
              value={values.emergencyContactRelationship}
              onChange={(e) => set('emergencyContactRelationship', e.target.value)}
              disabled={disabled}
              placeholder="Spouse, Parent, Sibling..."
            />
            {errors.emergencyContactRelationship && (
              <p className="text-sm text-destructive">{errors.emergencyContactRelationship}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-emergency-contact-phone">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-emergency-contact-phone"
              type="tel"
              value={values.emergencyContactPhone}
              onChange={(e) => set('emergencyContactPhone', e.target.value)}
              disabled={disabled}
              placeholder="5559876543"
            />
            {errors.emergencyContactPhone && (
              <p className="text-sm text-destructive">{errors.emergencyContactPhone}</p>
            )}
          </div>
        </div>
      </section>

      {/* Employment */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Employment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="caregiver-role">
              Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={values.role}
              onValueChange={(val) => set('role', val)}
              disabled={disabled}
            >
              <SelectTrigger id="caregiver-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-employment-type">
              Employment Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={values.employmentType}
              onValueChange={(val) => set('employmentType', val as CaregiverFormValues['employmentType'])}
              disabled={disabled}
            >
              <SelectTrigger id="caregiver-employment-type">
                <SelectValue placeholder="Select employment type" />
              </SelectTrigger>
              <SelectContent>
                {employmentTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-status">Status</Label>
            <Select
              value={values.status}
              onValueChange={(val) => set('status', val)}
              disabled={disabled}
            >
              <SelectTrigger id="caregiver-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-hire-date">
              Hire Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-hire-date"
              type="date"
              value={values.hireDate}
              onChange={(e) => set('hireDate', e.target.value)}
              disabled={disabled}
            />
            {errors.hireDate && <p className="text-sm text-destructive">{errors.hireDate}</p>}
          </div>
        </div>
      </section>

      {/* Branches */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Branch Assignment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Branch Selector Dropdown */}
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <Label htmlFor="branch-dropdown-toggle">
              Assigned Branches <span className="text-destructive">*</span>
            </Label>
            <div
              id="branch-dropdown-toggle"
              className={`min-h-[38px] w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer flex flex-wrap items-center justify-between gap-1.5 ${
                errors.branchIdsRaw ? 'border-destructive ring-1 ring-destructive' : 'border-input focus-within:border-ring'
              } ${disabled ? 'bg-muted cursor-not-allowed opacity-75' : ''}`}
              onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
              data-testid="branch-dropdown-toggle"
              tabIndex={0}
              role="button"
            >
              <div className="flex flex-wrap items-center gap-1 flex-1">
                {selectedBranchIds.length === 0 ? (
                  <span className="text-muted-foreground">Select branches...</span>
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
                            ? 'bg-secondary text-secondary-foreground border border-border'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {name} {isPrimary && '(Primary)'}
                        {!disabled && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-3.5 w-3.5 p-0 ml-0.5 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBranchSelection(branchId);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </span>
                    );
                  })
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>

            {/* Dropdown popup */}
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-md bg-white shadow-lg border border-border py-1 max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      type="text"
                      className="w-full pl-8 pr-3 h-8 text-xs"
                      placeholder="Search branches..."
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-44 py-1">
                  {filteredBranches.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">No branches found</div>
                  ) : (
                    filteredBranches.map((branch) => {
                      const isSelected = selectedBranchIds.includes(branch.id);
                      return (
                        <div
                          key={branch.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer flex items-center justify-between text-sm"
                          onClick={() => toggleBranchSelection(branch.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="font-medium text-foreground">{branch.name}</span>
                            {branch.code && <span className="text-xs text-muted-foreground">({branch.code})</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {errors.branchIdsRaw && <p className="text-sm text-destructive mt-1">{errors.branchIdsRaw}</p>}
            <p className="text-xs text-muted-foreground mt-1">Select one or more branches assigned to this caregiver.</p>
          </div>

          {/* Primary Branch Dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="caregiver-primary-branch">
              Primary Branch <span className="text-destructive">*</span>
            </Label>
            <Select
              value={values.primaryBranchId}
              onValueChange={(val) => setPrimaryBranch(val)}
              disabled={disabled || selectedBranchIds.length === 0}
            >
              <SelectTrigger id="caregiver-primary-branch">
                <SelectValue placeholder={selectedBranchIds.length === 0 ? "Select an assigned branch first" : "Select primary branch"} />
              </SelectTrigger>
              <SelectContent>
                {selectedBranchIds.map((branchId) => {
                  const b = availableBranches.find((item) => item.id === branchId);
                  const name = b ? `${b.name}${b.code ? ` (${b.code})` : ''}` : branchId;
                  return (
                    <SelectItem key={branchId} value={branchId}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.primaryBranchId && <p className="text-sm text-destructive">{errors.primaryBranchId}</p>}
            <p className="text-xs text-muted-foreground">The primary location for this caregiver's employment records and scheduling</p>
          </div>
        </div>
      </section>

      {/* Pay Rate */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Pay Rate</h2>
        <p className="text-sm text-muted-foreground">
          Required so the create request always carries a complete payRate.effectiveDate
          (the backend throws a 500 if this is missing).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="caregiver-pay-rate-amount">
              Amount ($) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-pay-rate-amount"
              type="number"
              min="0"
              step="0.01"
              value={values.payRateAmount}
              onChange={(e) => set('payRateAmount', e.target.value)}
              disabled={disabled}
              placeholder="20.00"
            />
            {errors.payRateAmount && <p className="text-sm text-destructive">{errors.payRateAmount}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-pay-rate-unit">
              Unit <span className="text-destructive">*</span>
            </Label>
            <Select
              value={values.payRateUnit}
              onValueChange={(val) => set('payRateUnit', val as CaregiverFormValues['payRateUnit'])}
              disabled={disabled}
            >
              <SelectTrigger id="caregiver-pay-rate-unit">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {payUnitOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caregiver-pay-rate-effective-date">
              Effective Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caregiver-pay-rate-effective-date"
              type="date"
              value={values.payRateEffectiveDate}
              onChange={(e) => set('payRateEffectiveDate', e.target.value)}
              disabled={disabled}
            />
            {errors.payRateEffectiveDate && (
              <p className="text-sm text-destructive">{errors.payRateEffectiveDate}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
