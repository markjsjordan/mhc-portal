/**
 * Caregiver Form - shadcn/ui + React Hook Form Edition
 *
 * Refactored to use shadcn/ui components (Input, Select, Form, Button, Label)
 * with React Hook Form for validation and state management. Preserves all
 * 25+ fields, validation logic, API payload generation, and the custom
 * multi-select branch dropdown UI pattern.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { useBranches } from '@/verticals/client-demographics/hooks/index.js';
import { Search, ChevronDown, Check, X } from 'lucide-react';

// Zod validation schema matching original validate() logic
const caregiverFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  preferredName: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  phoneType: z.enum(['MOBILE', 'HOME', 'WORK']),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'PER_DIEM', 'CONTRACT', 'TEMPORARY', 'SEASONAL']),
  hireDate: z.string().min(1, 'Hire date is required'),
  role: z.string().min(1, 'Role is required'),
  status: z.string().optional(),
  branchIdsRaw: z.string().min(1, 'At least one branch ID is required'),
  primaryBranchId: z.string().min(1, 'Primary branch ID is required'),
  payRateAmount: z.string()
    .min(1, 'Pay rate amount is required')
    .refine((val) => Number(val) > 0, 'Pay rate amount must be greater than 0'),
  payRateUnit: z.enum(['HOURLY', 'VISIT', 'DAILY', 'SALARY']),
  payRateEffectiveDate: z.string().min(1, 'Pay rate effective date is required'),
  addressLine1: z.string().min(1, 'Street address is required'),
  addressLine2: z.string().optional(),
  addressCity: z.string().min(1, 'City is required'),
  addressState: z.string()
    .length(2, 'State must be 2 letters')
    .transform((val) => val.toUpperCase()),
  addressPostalCode: z.string()
    .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be 5 digits'),
  emergencyContactName: z.string().min(1, 'Required'),
  emergencyContactRelationship: z.string().min(1, 'Required'),
  emergencyContactPhone: z.string().min(1, 'Required'),
});

export type CaregiverFormValues = z.infer<typeof caregiverFormSchema>;

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

const roleOptions = [
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

const employmentTypeOptions = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'PER_DIEM', label: 'Per Diem' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'SEASONAL', label: 'Seasonal' },
];

const statusOptions = [
  { value: 'APPLICATION', label: 'Application' },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'PENDING_ONBOARDING', label: 'Pending Onboarding' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const phoneTypeOptions = [
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'HOME', label: 'Home' },
  { value: 'WORK', label: 'Work' },
];

const payUnitOptions = [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'VISIT', label: 'Per Visit' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'SALARY', label: 'Salary' },
];

export interface CaregiverFormProps {
  defaultValues?: Partial<CaregiverFormValues>;
  onSubmit: (values: CaregiverFormValues) => void | Promise<void>;
  onChange?: () => void;
  disabled?: boolean;
  submitButtonRef?: React.RefObject<HTMLButtonElement | null>;
  /**
   * Expose the submit handler so parent components can trigger submission programmatically
   */
  onFormReady?: (submit: () => Promise<void>) => void;
}

export const CaregiverForm: React.FC<CaregiverFormProps> = ({
  defaultValues,
  onSubmit,
  onChange,
  disabled = false,
  submitButtonRef,
  onFormReady,
}) => {
  const form = useForm<CaregiverFormValues>({
    resolver: zodResolver(caregiverFormSchema),
    defaultValues,
  });

  const initialValuesRef = useRef<string | null>(null);

  // Capture initial values on mount and notify parent on changes
  useEffect(() => {
    if (!onChange) return undefined;
    
    // Capture initial values immediately
    if (initialValuesRef.current === null) {
      initialValuesRef.current = JSON.stringify(form.getValues());
    }

    // Watch for changes
    const subscription = form.watch((values) => {
      const currentValues = JSON.stringify(values);
      // Only notify if values have actually changed from initial
      if (currentValues !== initialValuesRef.current) {
        onChange();
      }
    });

    return () => subscription.unsubscribe();
  }, [form, onChange]);

  // Expose submit handler to parent
  useEffect(() => {
    if (onFormReady) {
      const submit = async () => {
        await form.handleSubmit(onSubmit)();
      };
      onFormReady(submit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFormReady]);

  const { data: fetchedBranches = [] } = useBranches();
  const [branchSearch, setBranchSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // If backend returns branches, use them. Otherwise provide a default Main branch fallback
  const availableBranches = fetchedBranches.length > 0
    ? fetchedBranches
    : [{ id: '00000000-0000-0000-0000-000000000002', name: 'Main Branch', code: 'MAIN' }];

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
  const branchIdsRaw = form.watch('branchIdsRaw');
  const primaryBranchId = form.watch('primaryBranchId');
  
  const selectedBranchIds = branchIdsRaw
    ? branchIdsRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  // Auto-select "Main" branch on load if no branch is currently selected
  useEffect(() => {
    if (availableBranches.length > 0 && selectedBranchIds.length === 0 && !primaryBranchId) {
      const mainBranch =
        availableBranches.find(
          (b) => b.name?.toLowerCase().includes('main') || b.code?.toLowerCase().includes('main')
        ) || availableBranches[0];

      if (mainBranch) {
        form.setValue('branchIdsRaw', mainBranch.id);
        form.setValue('primaryBranchId', mainBranch.id);
      }
    }
  }, [availableBranches, selectedBranchIds.length, primaryBranchId, form]);

  const toggleBranchSelection = (branchId: string) => {
    const exists = selectedBranchIds.includes(branchId);
    let nextBranchIds: string[];
    let nextPrimary = primaryBranchId;

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

    form.setValue('branchIdsRaw', nextBranchIds.join(', '));
    form.setValue('primaryBranchId', nextPrimary);
  };

  const setPrimaryBranch = (branchId: string) => {
    const nextBranchIds = selectedBranchIds.includes(branchId)
      ? selectedBranchIds
      : [...selectedBranchIds, branchId];

    form.setValue('branchIdsRaw', nextBranchIds.join(', '));
    form.setValue('primaryBranchId', branchId);
  };

  const filteredBranches = availableBranches.filter((b) => {
    const q = branchSearch.toLowerCase();
    return b.name?.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q);
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Hidden submit button for external triggering */}
        <button type="submit" ref={submitButtonRef} className="hidden" aria-hidden="true" />
        
        {/* Identity */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="middleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl>
                    <Input disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferredName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Name</FormLabel>
                  <FormControl>
                    <Input disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth *</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@example.com" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="5551234567" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={disabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select phone type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {phoneTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Home Address */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Home Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Street Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Apt / Suite</FormLabel>
                  <FormControl>
                    <Input disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State (2-letter) *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="TX" 
                      maxLength={2} 
                      disabled={disabled} 
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressPostalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="78701" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Emergency Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactRelationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship *</FormLabel>
                  <FormControl>
                    <Input placeholder="Spouse, Parent, Sibling..." disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="5559876543" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Employment */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Employment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={disabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employment Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={disabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employmentTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={disabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hireDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hire Date *</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Branches - Custom multi-select preserving original UI pattern */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Branch Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="branchIdsRaw"
              render={() => (
                <FormItem>
                  <div className="space-y-1 relative" ref={dropdownRef}>
                    <Label className="block text-sm font-medium text-gray-700">
                      Assigned Branches <span className="text-red-500">*</span>
                    </Label>
                    <div
                      className={`min-h-[38px] w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm cursor-pointer flex flex-wrap items-center justify-between gap-1.5 ${
                        form.formState.errors.branchIdsRaw ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300 focus-within:border-primary-500'
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
                            const isPrimary = primaryBranchId === branchId;
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
                    <FormMessage />
                    <p className="text-xs text-gray-500 mt-1">Select one or more branches assigned to this caregiver.</p>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="primaryBranchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Branch *</FormLabel>
                  <FormControl>
                    <select
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500 h-8"
                      value={field.value}
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
                  </FormControl>
                  <FormDescription>
                    The primary location for this caregiver's employment records and scheduling
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <FormField
              control={form.control}
              name="payRateAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($) *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      placeholder="20.00" 
                      disabled={disabled} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payRateUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={disabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payUnitOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payRateEffectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective Date *</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>
      </form>
    </Form>
  );
};
