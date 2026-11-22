import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCreateClient, useClients, useUpdateClient, useBranches } from '@/verticals/client-demographics/hooks';
import type { CreateClientInput, UpdateClientInput } from '@/verticals/client-demographics/types';
import { useAuth } from '@/core/hooks';
import { US_STATES } from '@/core/constants/us-states';

// Intake Step 1 offers the 50 U.S. states only (no DC, no territories).
// Derived from the shared list so codes stay in one source of truth.
const US_50_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const;
const INTAKE_STATES = US_STATES.filter((s) => (US_50_STATE_CODES as readonly string[]).includes(s.code));
import type { Client } from '@/verticals/client-demographics/types/client';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.js';
import { Label } from '@/components/ui/label.js';
import {
  blankToUndefined,
  findIntakeFormatError,
  findMissingRequiredAddressField,
  shouldActivateOnEdit,
} from './intake-payload.js';

/**
 * Client Intake Workflow
 *
 * Multi-step wizard for comprehensive client onboarding.
 * Reduces intake time from 60 min → 20 min with validation and auto-save.
 * Can be used for both creating new clients and editing existing ones.
 * Fully responsive across mobile (< 768px) and desktop (>= 768px).
 */

type CareLevel = 'independent' | 'assistance' | 'dependent';

interface ClientIntakeWorkflowProps {
  initialData?: Partial<IntakeData>;
  isEditMode?: boolean;
  clientId?: string;
  /** Loaded client's current status (edit mode); only PENDING_INTAKE may be advanced. */
  currentStatus?: string;
  onSuccess?: (client: Client) => void;
}

interface IntakeData {
  // Step 1: Demographics & Contact
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  phone: string;
  // Saved primary phone's type/SMS flag (edit mode); written back unchanged on save.
  phoneType?: 'MOBILE' | 'HOME' | 'WORK';
  phoneCanReceiveSMS?: boolean;
  email: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    // Set only when editing a saved contact. The row editors mutate name/relationship/
    // phone in place, so these ride along and are written back unchanged on save.
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
    bathing: CareLevel;
    dressing: CareLevel;
    toileting: CareLevel;
    transferring: CareLevel;
    feeding: CareLevel;
  };
  iadls: {
    housekeeping: CareLevel;
    laundry: CareLevel;
    mealPrep: CareLevel;
    medication: CareLevel;
    transportation: CareLevel;
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
  visitFrequency: string;
  visitDuration: string | number;
  preferredTimes: string[];
  tasks: string[];
  goals: string;

  // Step 4: Consent
  consents: {
    careAgreement: boolean;
    hipaa: boolean;
    financialResponsibility: boolean;
  };
  signature: string;
  signedDate: string;
}

const STEPS = [
  { id: 1, title: 'Demographics', subtitle: 'Contact & Insurance' },
  { id: 2, title: 'Assessment', subtitle: 'Care Needs' },
  { id: 3, title: 'Care Plan', subtitle: 'Services & Goals' },
  { id: 4, title: 'Consent', subtitle: 'Signatures & Agreements' },
  { id: 5, title: 'Review', subtitle: 'Finalize & Submit' },
];

const getStepBadgeClass = (currentStep: number, stepId: number): string => {
  if (currentStep > stepId) return 'bg-emerald-500 text-white';
  if (currentStep === stepId) return 'bg-blue-600 text-white shadow-sm';
  return 'bg-gray-200 text-gray-500';
};

const getStepBarClass = (currentStep: number, stepId: number): string => {
  if (currentStep > stepId) return 'bg-emerald-500';
  if (currentStep === stepId) return 'bg-blue-600 ring-2 ring-blue-200';
  return 'bg-gray-200';
};

/**
 * Format and validate US phone numbers.
 * Accepts: (123) 456-7890, 123-456-7890, 1234567890, +1 123 456 7890
 * Returns formatted: (123) 456-7890 or empty string if invalid
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Handle empty input
  if (digits.length === 0) return '';
  
  // Remove leading 1 (country code) if present
  const phoneDigits = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  
  // Format as (XXX) XXX-XXXX as user types
  if (phoneDigits.length <= 3) {
    return phoneDigits;
  }
  if (phoneDigits.length <= 6) {
    return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3)}`;
  }
  if (phoneDigits.length <= 10) {
    return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
  }
  
  // Too many digits - truncate to 10
  return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
}

/**
 * Validate if phone number is complete and valid.
 * Must be exactly 10 digits (US format).
 */
function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  const phoneDigits = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  return phoneDigits.length === 10;
}

function formatVisitDuration(visitDuration: IntakeData['visitDuration'] | undefined): string {
  if (typeof visitDuration === 'number') {
    return `${visitDuration} minutes`;
  }
  const trimmed = blankToUndefined(visitDuration);
  if (!trimmed) {
    return 'not specified';
  }
  return /^\d+$/.test(trimmed) ? `${trimmed} minutes` : trimmed;
}

function validateIntakeRequiredFields(
  intakeData: Partial<IntakeData>
): { ok: true; firstName: string; lastName: string; dateOfBirth: string } | { ok: false; message: string; step: number } {
  const firstName = intakeData.firstName?.trim();
  if (!firstName) {
    return { ok: false, message: 'First name is required', step: 1 };
  }
  const lastName = intakeData.lastName?.trim();
  if (!lastName) {
    return { ok: false, message: 'Last name is required', step: 1 };
  }
  if (!intakeData.dateOfBirth) {
    return { ok: false, message: 'Date of birth is required', step: 1 };
  }
  const missingAddress = findMissingRequiredAddressField(intakeData.address);
  if (missingAddress) {
    return { ok: false, message: missingAddress.message, step: 1 };
  }
  return { ok: true, firstName, lastName, dateOfBirth: intakeData.dateOfBirth };
}

function resolveEffectiveBranchId(
  activeBranchId: string,
  userBranchId: string | undefined,
  firstBranchId: string | undefined,
  existingClientBranchId: string | undefined
): string | undefined {
  return (
    blankToUndefined(activeBranchId) ??
    blankToUndefined(userBranchId) ??
    blankToUndefined(firstBranchId) ??
    blankToUndefined(existingClientBranchId)
  );
}

export default function ClientIntakeWorkflow(props: ClientIntakeWorkflowProps = {}) {
  const { initialData, isEditMode = false, clientId, currentStatus, onSuccess } = props;
  const [currentStep, setCurrentStep] = useState(1);
  const [intakeData, setIntakeData] = useState<Partial<IntakeData>>(
    (initialData && {
      ...initialData,
      // Edit mode with no saved contacts still offers one blank row, as create mode does.
      emergencyContacts:
        initialData.emergencyContacts && initialData.emergencyContacts.length > 0
          ? initialData.emergencyContacts
          : [{ name: '', relationship: '', phone: '' }],
    }) ?? {
      emergencyContacts: [{ name: '', relationship: '', phone: '' }],
      medications: [],
      allergies: [],
      conditions: [],
      tasks: [],
      preferredTimes: [],
      serviceTypes: [],
      consents: {
        careAgreement: false,
        hipaa: false,
        financialResponsibility: false,
      },
    }
  );
  // savedClientId tracks a client record created by mid-wizard Save in create mode.
  // Once set, subsequent Save presses (and final Submit) update that record instead of creating a new one.
  const [savedClientId, setSavedClientId] = useState<string | undefined>(clientId);

  const updateData = (field: string, value: unknown) => {
    setIntakeData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNestedData = (parent: string, field: string, value: unknown) => {
    setIntakeData((prev) => {
      const parentObj = (prev as Record<string, unknown>)[parent];
      const existing = typeof parentObj === 'object' && parentObj !== null ? parentObj : {};
      return {
        ...prev,
        [parent]: { ...existing, [field]: value },
      };
    });
  };

  const addEmergencyContact = () => {
    setIntakeData((prev) => ({
      ...prev,
      emergencyContacts: [
        ...(prev.emergencyContacts ?? []),
        { name: '', relationship: '', phone: '' },
      ],
    }));
  };

  const addMedication = () => {
    setIntakeData((prev) => ({
      ...prev,
      medications: [...(prev.medications ?? []), { name: '', dosage: '', frequency: '' }],
    }));
  };

  const toggleTask = (task: string) => {
    setIntakeData((prev) => {
      const tasks = prev.tasks ?? [];
      return {
        ...prev,
        tasks: tasks.includes(task)
          ? tasks.filter((t) => t !== task)
          : [...tasks, task],
      };
    });
  };

  const toggleServiceType = (type: string) => {
    setIntakeData((prev) => {
      const types = prev.serviceTypes ?? [];
      return {
        ...prev,
        serviceTypes: types.includes(type)
          ? types.filter((t) => t !== type)
          : [...types, type],
      };
    });
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!intakeData.firstName?.trim()) {
        toast.error('First name is required');
        return;
      }
      if (!intakeData.lastName?.trim()) {
        toast.error('Last name is required');
        return;
      }
      if (!intakeData.dateOfBirth) {
        toast.error('Date of birth is required');
        return;
      }
      const missingAddress = findMissingRequiredAddressField(intakeData.address);
      if (missingAddress) {
        toast.error(missingAddress.message);
        return;
      }
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: existingClients } = useClients({ page: 1, pageSize: 1 });
  const { data: branches = [] } = useBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const defaultBranchId = user?.branchIds?.[0] ?? branches[0]?.id ?? '';
  const activeBranchId = selectedBranchId || defaultBranchId;

  const handleSubmit = async () => {
    // Validate required demographic fields with user-friendly error feedback
    const requiredFields = validateIntakeRequiredFields(intakeData);
    if (!requiredFields.ok) {
      toast.error(requiredFields.message);
      setCurrentStep(requiredFields.step);
      return;
    }

    if (!isEditMode && !user?.organizationId) {
      toast.error('Unable to submit: no organization context for the signed-in user.');
      return;
    }

    // Catch values the server will reject (phone, state, ZIP) here, on the step that
    // owns the field, instead of failing after submit with a generic toast.
    const formatError = findIntakeFormatError({
      phone: intakeData.phone,
      address: intakeData.address,
      emergencyContacts: intakeData.emergencyContacts,
    });
    if (formatError) {
      toast.error(formatError.message);
      setCurrentStep(formatError.step);
      return;
    }

    // Resolve branch ID gracefully:
    // 1. User-selected branch
    // 2. User assigned branch (from JWT / user profile)
    // 3. Organization branch list
    // 4. Existing client branch
    // 5. Undefined (backend automatically auto-resolves or creates default branch)
    const effectiveBranchId = resolveEffectiveBranchId(
      activeBranchId,
      user?.branchIds?.[0],
      branches[0]?.id,
      existingClients?.items[0]?.branchId
    );

    // Build address only if all required address fields are provided
    const addr = intakeData.address;
    const line1 = blankToUndefined(addr?.line1);
    const city = blankToUndefined(addr?.city);
    const state = blankToUndefined(addr?.state);
    const postalCode = blankToUndefined(addr?.postalCode);

    const addressInput =
      line1 && city && state && postalCode
        ? {
            type: 'HOME' as const,
            line1,
            line2: blankToUndefined(addr?.line2),
            city,
            state: state.toUpperCase(),
            postalCode,
            country: 'US' as const,
          }
        : undefined;

    const phoneNumber = blankToUndefined(intakeData.phone);
    const phoneInput = phoneNumber
      ? {
          number: phoneNumber,
          type: intakeData.phoneType ?? ('MOBILE' as const),
          canReceiveSMS: intakeData.phoneCanReceiveSMS ?? false,
        }
      : undefined;

    const { emergencyContactsInput, intakePartBFields } = buildAccumulatedPayload();

    try {
      const effectiveClientId = isEditMode ? clientId : savedClientId;
      if (effectiveClientId) {
        // Update mode (existing client in edit mode, or draft already created via mid-wizard Save)
        const updateInput: UpdateClientInput = {
          firstName: requiredFields.firstName,
          lastName: requiredFields.lastName,
          dateOfBirth: requiredFields.dateOfBirth,
          email: blankToUndefined(intakeData.email),
          primaryPhone: phoneInput,
          primaryAddress: addressInput,
          emergencyContacts: emergencyContactsInput,
          ...intakePartBFields,
        };

        const activate = !isEditMode
          ? true
          : shouldActivateOnEdit(currentStatus, {
              firstName: updateInput.firstName,
              lastName: updateInput.lastName,
              dateOfBirth: updateInput.dateOfBirth,
              email: intakeData.email,
              phone: intakeData.phone,
              emergencyContacts: emergencyContactsInput,
            });
        if (activate) {
          updateInput.status = 'ACTIVE';
        }

        const updatedClient = await updateClient.mutateAsync({
          id: effectiveClientId,
          input: updateInput,
        });
        let successMessage = 'Client saved.';
        if (!isEditMode) {
          successMessage = 'Client intake submitted.';
        } else if (activate) {
          successMessage = 'Client saved and activated.';
        }
        toast.success(successMessage);

        if (onSuccess) {
          onSuccess(updatedClient);
        } else {
          Promise.resolve(navigate(`/clients/${updatedClient.id}`)).catch(() => {});
        }
      } else {
        // Create mode
        const createInput: CreateClientInput = {
          organizationId: user!.organizationId,
          branchId: effectiveBranchId,
          firstName: requiredFields.firstName,
          lastName: requiredFields.lastName,
          dateOfBirth: requiredFields.dateOfBirth,
          email: blankToUndefined(intakeData.email),
          primaryPhone: phoneInput,
          primaryAddress: addressInput,
          emergencyContacts: emergencyContactsInput,
          status: 'ACTIVE',
          ...intakePartBFields,
        };

        const newClient = await createClient.mutateAsync(createInput);
        toast.success('Client intake submitted.');

        if (onSuccess) {
          onSuccess(newClient);
        } else {
          Promise.resolve(navigate(`/clients/${newClient.id}`)).catch(() => {});
        }
      }
    } catch {
      // useCreateClient/useUpdateClient's onError already surfaces a toast; nothing further to do here.
    }
  };

  /**
   * Builds the accumulated emergency contacts and Part B (steps 2–6) payload fields
   * shared by both mid-wizard Save and final Submit.
   */
  const buildAccumulatedPayload = () => {
    const emergencyContactsInput = (intakeData.emergencyContacts ?? [])
      .filter((c) => blankToUndefined(c.name) && blankToUndefined(c.phone))
      .map((c) => ({
        // A saved contact keeps its id and flags; regenerating them on every edit
        // would break references and reset healthcare-decision authority.
        id: c.id ?? crypto.randomUUID(),
        name: c.name.trim(),
        relationship: blankToUndefined(c.relationship) ?? 'Emergency Contact',
        phone: {
          number: c.phone.trim(),
          type: c.phoneType ?? ('MOBILE' as const),
          canReceiveSMS: c.canReceiveSMS ?? false,
        },
        // New contacts keep the existing default (primary); saved flags are preserved.
        isPrimary: c.isPrimary ?? true,
        canMakeHealthcareDecisions: c.canMakeHealthcareDecisions ?? false,
        ...(c.email !== undefined && { email: c.email }),
        ...(c.notes !== undefined && { notes: c.notes }),
      }));

    const insuranceTypeMap: Record<
      string,
      'MEDICAID' | 'MEDICARE' | 'PRIVATE' | 'OTHER'
    > = {
      medicaid: 'MEDICAID',
      medicare: 'MEDICARE',
      private: 'PRIVATE',
      other: 'OTHER',
    };

    const sig = intakeData.signature ?? '';
    const effectiveSignedDate =
      sig.trim() && !intakeData.signedDate
        ? new Date().toISOString().slice(0, 10)
        : (intakeData.signedDate ?? '');

    const intakePartBFields = {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      primaryPhysician: intakeData.physician?.name?.trim()
        ? {
            name: intakeData.physician.name.trim(),
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            ...(intakeData.physician.phone?.trim() && {
              phone: {
                number: intakeData.physician.phone.trim(),
                type: 'WORK' as const,
                isPrimary: true,
              },
            }),
          }
        : undefined,
       
      insurance:
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        intakeData.insurance?.memberId?.trim() ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        intakeData.insurance?.groupNumber?.trim() ||
        (intakeData.insurance?.type && intakeData.insurance.type !== 'private')
          ? [
              {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing
                type: insuranceTypeMap[intakeData.insurance?.type ?? 'private'] || 'PRIVATE',
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                policyNumber: intakeData.insurance?.memberId?.trim() || undefined,
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                groupNumber: intakeData.insurance?.groupNumber?.trim() || undefined,
                isPrimary: true,
              },
            ]
          : undefined,
      authorizationInfo: {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing
        number: intakeData.authorization?.number?.trim() || undefined,
         
        approvedHours: intakeData.authorization?.approvedHours,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        validFrom: intakeData.authorization?.validFrom || undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        validTo: intakeData.authorization?.validTo || undefined,
      },
      assessmentData: {
        adls: intakeData.adls,
        iadls: intakeData.iadls,
        mobility: intakeData.mobility,
        cognitive: intakeData.cognitive,
        conditions: intakeData.conditions,
        medications: intakeData.medications,
        allergies: intakeData.allergies,
        dietaryNeeds: intakeData.dietaryNeeds,
      },
      carePlanSummary: {
        serviceTypes: intakeData.serviceTypes,
        visitFrequency: blankToUndefined(intakeData.visitFrequency),
        visitDuration:
          typeof intakeData.visitDuration === 'number'
            ? String(intakeData.visitDuration)
            : blankToUndefined(intakeData.visitDuration),
        preferredTimes: intakeData.preferredTimes,
        tasks: intakeData.tasks,
        goals: intakeData.goals,
      },
      consents: {
        careAgreement: intakeData.consents?.careAgreement ?? false,
        hipaa: intakeData.consents?.hipaa ?? false,
        financialResponsibility: intakeData.consents?.financialResponsibility ?? false,
        evv: (intakeData.consents as { evv?: boolean } | undefined)?.evv ?? false,
        signature: sig,
        signedDate: effectiveSignedDate,
      },
    };

    return { emergencyContactsInput, intakePartBFields };
  };

  /**
   * handleSave — persist current wizard state without navigating away.
   *
   * - On the first save in create mode, calls createClient with status=PENDING_INTAKE
   *   (server accepts name + DOB + address; all other fields are optional).
   * - On subsequent saves, calls updateClient so we don't create duplicate records.
   * - In edit mode, always calls updateClient against the existing clientId.
   *
   * Guards: firstName, lastName, dateOfBirth, and a complete address (all four required
   * fields) must be provided — the server rejects without them and surfaces a toast.
   */
  const handleSave = async () => {
    if (!intakeData.firstName?.trim()) {
      toast.error('First name is required to save.');
      setCurrentStep(1);
      return;
    }
    if (!intakeData.lastName?.trim()) {
      toast.error('Last name is required to save.');
      setCurrentStep(1);
      return;
    }
    if (!intakeData.dateOfBirth) {
      toast.error('Date of birth is required to save.');
      setCurrentStep(1);
      return;
    }

    const addr = intakeData.address;
    const line1 = blankToUndefined(addr?.line1);
    const city = blankToUndefined(addr?.city);
    const state = blankToUndefined(addr?.state);
    const postalCode = blankToUndefined(addr?.postalCode);
    if (!line1 || !city || !state || !postalCode) {
      toast.error('A complete home address is required to save.');
      setCurrentStep(1);
      return;
    }

    const addressInput = {
      type: 'HOME' as const,
      line1,
      line2: blankToUndefined(addr?.line2),
      city,
      state: state.toUpperCase(),
      postalCode,
      country: 'US' as const,
    };

    const phoneNumber = blankToUndefined(intakeData.phone);
    const phoneInput = phoneNumber
      ? {
          number: phoneNumber,
          type: intakeData.phoneType ?? ('MOBILE' as const),
          canReceiveSMS: intakeData.phoneCanReceiveSMS ?? false,
        }
      : undefined;

    const { emergencyContactsInput, intakePartBFields } = buildAccumulatedPayload();

    try {
      const targetId = isEditMode ? clientId : savedClientId;
      if (targetId) {
        // Update the existing record (edit mode or already-saved create mode)
        await updateClient.mutateAsync({
          id: targetId,
          input: {
            firstName: intakeData.firstName.trim(),
            lastName: intakeData.lastName.trim(),
            dateOfBirth: intakeData.dateOfBirth,
            email: blankToUndefined(intakeData.email),
            primaryPhone: phoneInput,
            primaryAddress: addressInput,
            emergencyContacts: emergencyContactsInput,
            ...intakePartBFields,
          },
        });
        toast.success('Progress saved');
      } else {
        // First save in create mode — create a PENDING_INTAKE draft
        if (!user?.organizationId) {
          toast.error('Unable to save: no organization context for the signed-in user.');
          return;
        }
        const newClient = await createClient.mutateAsync({
          organizationId: user.organizationId,
          branchId:
            (activeBranchId && activeBranchId.trim() !== '' ? activeBranchId : undefined) ??
            (user.branchIds?.[0] && user.branchIds[0].trim() !== '' ? user.branchIds[0] : undefined) ??
            undefined,
          firstName: intakeData.firstName.trim(),
          lastName: intakeData.lastName.trim(),
          dateOfBirth: intakeData.dateOfBirth,
          email: blankToUndefined(intakeData.email),
          primaryPhone: phoneInput,
          primaryAddress: addressInput,
          emergencyContacts: emergencyContactsInput,
          status: 'PENDING_INTAKE',
          ...intakePartBFields,
        });
        setSavedClientId(newClient.id);
        toast.success('Progress saved');
      }
    } catch {
      // useCreateClient/useUpdateClient's onError already surfaces a toast.
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-5 md:py-10 font-sans min-w-0 w-full box-border overflow-x-hidden">
      {/* Desktop Progress Stepper (>= 768px) */}
      <div className="hidden md:flex justify-between mb-10 px-5">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full relative">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm z-10 relative transition-colors ${getStepBadgeClass(currentStep, step.id)}`}
              >
                {currentStep > step.id ? '✓' : step.id}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 -ml-5 transition-colors ${
                    currentStep > step.id ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
            <div className="mt-2 text-center">
              <div
                className={`text-xs font-semibold ${
                  currentStep === step.id ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {step.title}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{step.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Progress Stepper (< 768px) */}
      <div className="flex md:hidden flex-col mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Step {currentStep} of {STEPS.length}
          </span>
          <span className="text-xs text-gray-400 font-medium">
            {Math.round((currentStep / STEPS.length) * 100)}% Complete
          </span>
        </div>
        <div className="text-base font-bold text-gray-900 mt-1">
          {STEPS[currentStep - 1]?.title}
        </div>
        <div className="text-xs text-gray-500 mb-3">
          {STEPS[currentStep - 1]?.subtitle}
        </div>
        {/* Progress Bar with 6 segments */}
        <div className="grid grid-cols-6 gap-1.5 w-full">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`h-2 rounded-full transition-colors ${getStepBarClass(currentStep, step.id)}`}
              title={`${step.id}. ${step.title}`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl p-4 sm:p-6 md:p-10 shadow-sm border border-gray-100 min-h-[400px] md:min-h-[500px]">
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">
              Demographics & Contact Information
            </h2>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Basic Information
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first-name"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.firstName ?? ''}
                    onChange={(e) => updateData('firstName', e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last-name"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.lastName ?? ''}
                    onChange={(e) => updateData('lastName', e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="date-of-birth" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="date-of-birth"
                    type="date"
                    className="w-full min-h-[44px]"
                    max={new Date().toISOString().split('T')[0]}
                    value={intakeData.dateOfBirth ?? ''}
                    onChange={(e) => updateData('dateOfBirth', e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    className="w-full min-h-[44px]"
                    value={intakeData.phone ?? ''}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      updateData('phone', formatted);
                    }}
                    placeholder="(555) 123-4567"
                    aria-invalid={intakeData.phone && !isValidPhoneNumber(intakeData.phone) ? 'true' : undefined}
                  />
                  {intakeData.phone && !isValidPhoneNumber(intakeData.phone) && (
                    <span className="text-xs text-destructive mt-1">
                      Phone must be 10 digits
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col mb-4 md:mb-5">
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</Label>
                <Input
                  id="email"
                  type="email"
                  className="w-full min-h-[44px]"
                  value={intakeData.email ?? ''}
                  onChange={(e) => updateData('email', e.target.value)}
                  placeholder="client@example.com"
                />
              </div>

              {branches.length > 0 && (
                <div className="flex-1 min-w-0 flex flex-col mb-4 md:mb-5">
                  <Label htmlFor="branch-select" className="block text-sm font-medium text-gray-700 mb-1.5">Branch / Office</Label>
                  <Select
                    value={activeBranchId}
                    onValueChange={(val) => setSelectedBranchId(val)}
                  >
                    <SelectTrigger id="branch-select" className="w-full min-h-[44px]">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Address
              </h3>
              <div className="flex-1 min-w-0 flex flex-col mb-4 md:mb-5">
                <Label htmlFor="address-line1" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Street Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="address-line1"
                  type="text"
                  aria-required="true"
                  className="w-full min-h-[44px]"
                  value={intakeData.address?.line1 ?? ''}
                  onChange={(e) => updateNestedData('address', 'line1', e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col mb-4 md:mb-5">
                <Label htmlFor="address-line2" className="block text-sm font-medium text-gray-700 mb-1.5">Apt/Suite</Label>
                <Input
                  id="address-line2"
                  type="text"
                  className="w-full min-h-[44px]"
                  value={intakeData.address?.line2 ?? ''}
                  onChange={(e) => updateNestedData('address', 'line2', e.target.value)}
                  placeholder="Apt 4B"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="address-city" className="block text-sm font-medium text-gray-700 mb-1.5">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="address-city"
                    type="text"
                    aria-required="true"
                    className="w-full min-h-[44px]"
                    value={intakeData.address?.city ?? ''}
                    onChange={(e) => updateNestedData('address', 'city', e.target.value)}
                    placeholder="Austin"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="address-state" className="block text-sm font-medium text-gray-700 mb-1.5">
                    State <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={intakeData.address?.state ?? undefined}
                    onValueChange={(val) => updateNestedData('address', 'state', val)}
                  >
                    <SelectTrigger id="address-state" aria-required="true" className="w-full min-h-[44px]">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTAKE_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="address-postal" className="block text-sm font-medium text-gray-700 mb-1.5">
                    ZIP Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="address-postal"
                    type="text"
                    aria-required="true"
                    className="w-full min-h-[44px]"
                    value={intakeData.address?.postalCode ?? ''}
                    onChange={(e) => updateNestedData('address', 'postalCode', e.target.value)}
                    placeholder="78701"
                  />
                </div>
              </div>
            </div>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Emergency Contacts
              </h3>
              {intakeData.emergencyContacts?.map((contact, index) => (
                <div key={index} className="p-4 md:p-5 mb-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex flex-col md:flex-row gap-4 md:gap-5">
                    <div className="flex-1 min-w-0 flex flex-col">
                      <Label htmlFor={`emergency-contact-name-${index}`} className="block text-sm font-medium text-gray-700 mb-1.5">Name</Label>
                      <Input
                        id={`emergency-contact-name-${index}`}
                        type="text"
                        className="w-full min-h-[44px]"
                        value={contact.name}
                        onChange={(e) => {
                          const contacts = [...(intakeData.emergencyContacts ?? [])];
                          if (contacts[index]) contacts[index].name = e.target.value;
                          updateData('emergencyContacts', contacts);
                        }}
                        placeholder="Contact name"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <Label htmlFor={`emergency-contact-rel-${index}`} className="block text-sm font-medium text-gray-700 mb-1.5">Relationship</Label>
                      <Input
                        id={`emergency-contact-rel-${index}`}
                        type="text"
                        className="w-full min-h-[44px]"
                        value={contact.relationship}
                        onChange={(e) => {
                          const contacts = [...(intakeData.emergencyContacts ?? [])];
                          if (contacts[index]) contacts[index].relationship = e.target.value;
                          updateData('emergencyContacts', contacts);
                        }}
                        placeholder="Daughter, Son, etc."
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <Label htmlFor={`emergency-contact-phone-${index}`} className="block text-sm font-medium text-gray-700 mb-1.5">Phone</Label>
                      <Input
                        id={`emergency-contact-phone-${index}`}
                        type="tel"
                        className="w-full min-h-[44px]"
                        value={contact.phone}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          const contacts = [...(intakeData.emergencyContacts ?? [])];
                          if (contacts[index]) contacts[index].phone = formatted;
                          updateData('emergencyContacts', contacts);
                        }}
                        placeholder="(555) 123-4567"
                        aria-invalid={contact.phone && !isValidPhoneNumber(contact.phone) ? 'true' : undefined}
                      />
                      {contact.phone && !isValidPhoneNumber(contact.phone) && (
                        <span className="text-xs text-destructive mt-1">
                          Phone must be 10 digits
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={addEmergencyContact}
              >
                + Add Emergency Contact
              </Button>
            </div>

            <div className="mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Insurance Information
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="insurance-type" className="block text-sm font-medium text-gray-700 mb-1.5">Insurance Type</Label>
                  <Select
                    value={intakeData.insurance?.type ?? undefined}
                    onValueChange={(val) => updateNestedData('insurance', 'type', val)}
                  >
                    <SelectTrigger id="insurance-type" className="w-full min-h-[44px]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicare">Medicare</SelectItem>
                      <SelectItem value="medicaid">Medicaid</SelectItem>
                      <SelectItem value="private">Private Insurance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="insurance-member-id" className="block text-sm font-medium text-gray-700 mb-1.5">Member ID</Label>
                  <Input
                    id="insurance-member-id"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.insurance?.memberId ?? ''}
                    onChange={(e) => updateNestedData('insurance', 'memberId', e.target.value)}
                    placeholder="Member ID"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="insurance-group-number" className="block text-sm font-medium text-gray-700 mb-1.5">Group Number</Label>
                  <Input
                    id="insurance-group-number"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.insurance?.groupNumber ?? ''}
                    onChange={(e) => updateNestedData('insurance', 'groupNumber', e.target.value)}
                    placeholder="Group Number"
                  />
                </div>
              </div>

              <h3 className="text-base font-semibold text-gray-800 mt-6 mb-3">
                Primary Physician
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="physician-name" className="block text-sm font-medium text-gray-700 mb-1.5">Physician Name</Label>
                  <Input
                    id="physician-name"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.physician?.name ?? ''}
                    onChange={(e) => updateNestedData('physician', 'name', e.target.value)}
                    placeholder="Dr. Jane Smith"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="physician-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Physician Phone</Label>
                  <Input
                    id="physician-phone"
                    type="tel"
                    className="w-full min-h-[44px]"
                    value={intakeData.physician?.phone ?? ''}
                    onChange={(e) => updateNestedData('physician', 'phone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <h3 className="text-base font-semibold text-gray-800 mt-6 mb-3">
                Service Authorization
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex flex-col">
                  <Label htmlFor="auth-number" className="block text-sm font-medium text-gray-700 mb-1.5">Authorization Number</Label>
                  <Input
                    id="auth-number"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.authorization?.number ?? ''}
                    onChange={(e) => updateNestedData('authorization', 'number', e.target.value)}
                    placeholder="AUTH-12345"
                  />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="auth-hours" className="block text-sm font-medium text-gray-700 mb-1.5">Approved Hours</Label>
                  <Input
                    id="auth-hours"
                    type="number"
                    min={0}
                    className="w-full min-h-[44px]"
                    value={intakeData.authorization?.approvedHours ?? 0}
                    onChange={(e) => updateNestedData('authorization', 'approvedHours', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="auth-valid-from" className="block text-sm font-medium text-gray-700 mb-1.5">Valid From</Label>
                  <Input
                    id="auth-valid-from"
                    type="date"
                    className="w-full min-h-[44px]"
                    value={intakeData.authorization?.validFrom ?? ''}
                    onChange={(e) => updateNestedData('authorization', 'validFrom', e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <Label htmlFor="auth-valid-to" className="block text-sm font-medium text-gray-700 mb-1.5">Valid To</Label>
                  <Input
                    id="auth-valid-to"
                    type="date"
                    className="w-full min-h-[44px]"
                    value={intakeData.authorization?.validTo ?? ''}
                    onChange={(e) => updateNestedData('authorization', 'validTo', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">
              Care Assessment
            </h2>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Activities of Daily Living (ADLs)
              </h3>
              {['bathing', 'dressing', 'toileting', 'transferring', 'feeding'].map((adl) => (
                <div
                  key={adl}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3.5 border-b border-gray-200 gap-2 sm:gap-4"
                >
                  <Label id={`label-adl-${adl}`} className="text-sm font-semibold sm:font-medium text-gray-800 sm:min-w-[150px]">
                    {adl.charAt(0).toUpperCase() + adl.slice(1)}
                  </Label>
                  <RadioGroup
                    value={(intakeData.adls as Record<string, string | undefined> | undefined)?.[adl] ?? undefined}
                    onValueChange={(val) => updateNestedData('adls', adl, val as CareLevel)}
                    aria-labelledby={`label-adl-${adl}`}
                    className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto"
                  >
                    {['independent', 'assistance', 'dependent'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <RadioGroupItem value={level} id={`adl-${adl}-${level}`} />
                        <Label htmlFor={`adl-${adl}-${level}`} className="capitalize cursor-pointer text-sm">
                          {level}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </div>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Instrumental ADLs (IADLs)
              </h3>
              {['housekeeping', 'laundry', 'mealPrep', 'medication', 'transportation'].map((iadl) => (
                <div
                  key={iadl}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3.5 border-b border-gray-200 gap-2 sm:gap-4"
                >
                  <Label id={`label-iadl-${iadl}`} className="text-sm font-semibold sm:font-medium text-gray-800 sm:min-w-[150px]">
                    {iadl === 'mealPrep' ? 'Meal Prep' : iadl.charAt(0).toUpperCase() + iadl.slice(1)}
                  </Label>
                  <RadioGroup
                    value={(intakeData.iadls as Record<string, string | undefined> | undefined)?.[iadl] ?? undefined}
                    onValueChange={(val) => updateNestedData('iadls', iadl, val as CareLevel)}
                    aria-labelledby={`label-iadl-${iadl}`}
                    className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto"
                  >
                    {['independent', 'assistance', 'dependent'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <RadioGroupItem value={level} id={`iadl-${iadl}-${level}`} />
                        <Label htmlFor={`iadl-${iadl}-${level}`} className="capitalize cursor-pointer text-sm">
                          {level}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </div>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Mobility & Cognitive Status
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="mobility-select" className="block text-sm font-medium text-gray-700 mb-1.5">Mobility</Label>
                  <Select
                    value={intakeData.mobility ?? undefined}
                    onValueChange={(val) => updateData('mobility', val)}
                  >
                    <SelectTrigger id="mobility-select" className="w-full min-h-[44px]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ambulatory">Ambulatory</SelectItem>
                      <SelectItem value="walker">Uses Walker</SelectItem>
                      <SelectItem value="wheelchair">Wheelchair</SelectItem>
                      <SelectItem value="bedbound">Bedbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="cognitive-select" className="block text-sm font-medium text-gray-700 mb-1.5">Cognitive Status</Label>
                  <Select
                    value={intakeData.cognitive ?? undefined}
                    onValueChange={(val) => updateData('cognitive', val)}
                  >
                    <SelectTrigger id="cognitive-select" className="w-full min-h-[44px]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="mild">Mild Impairment</SelectItem>
                      <SelectItem value="moderate">Moderate Impairment</SelectItem>
                      <SelectItem value="severe">Severe Impairment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Medications
              </h3>
              {intakeData.medications?.map((med, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row gap-3 md:gap-4 mb-3 p-3 md:p-0 bg-gray-50 md:bg-transparent rounded-lg md:rounded-none border md:border-0 border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`med-name-${index}`} className="md:hidden block text-xs font-medium text-gray-500 mb-1">Medication Name</Label>
                    <Input
                      id={`med-name-${index}`}
                      type="text"
                      className="w-full min-h-[44px]"
                      value={med.name}
                      onChange={(e) => {
                        const meds = [...(intakeData.medications ?? [])];
                        if (meds[index]) meds[index].name = e.target.value;
                        updateData('medications', meds);
                      }}
                      placeholder="Medication name"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`med-dosage-${index}`} className="md:hidden block text-xs font-medium text-gray-500 mb-1">Dosage</Label>
                    <Input
                      id={`med-dosage-${index}`}
                      type="text"
                      className="w-full min-h-[44px]"
                      value={med.dosage}
                      onChange={(e) => {
                        const meds = [...(intakeData.medications ?? [])];
                        if (meds[index]) meds[index].dosage = e.target.value;
                        updateData('medications', meds);
                      }}
                      placeholder="Dosage (e.g., 10mg)"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`med-frequency-${index}`} className="md:hidden block text-xs font-medium text-gray-500 mb-1">Frequency</Label>
                    <Input
                      id={`med-frequency-${index}`}
                      type="text"
                      className="w-full min-h-[44px]"
                      value={med.frequency}
                      onChange={(e) => {
                        const meds = [...(intakeData.medications ?? [])];
                        if (meds[index]) meds[index].frequency = e.target.value;
                        updateData('medications', meds);
                      }}
                      placeholder="Frequency (e.g., 2x daily)"
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={addMedication}
              >
                + Add Medication
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">
              Care Plan Creation
            </h2>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Service Types
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {['Personal Care', 'Companion Care', 'Homemaking', 'Skilled Nursing', 'Physical Therapy', 'Occupational Therapy'].map((type) => {
                  const id = `service-type-${type.toLowerCase().replace(/\s+/g, '-')}`;
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer min-h-[48px] select-none transition-colors"
                    >
                      <Checkbox
                        id={id}
                        checked={intakeData.serviceTypes?.includes(type) ?? false}
                        onCheckedChange={() => toggleServiceType(type)}
                      />
                      <Label htmlFor={id} className="text-sm font-medium text-gray-800 cursor-pointer flex-1">
                        {type}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Visit Schedule
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-4 md:mb-5">
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="visit-frequency" className="block text-sm font-medium text-gray-700 mb-1.5">Visit Frequency</Label>
                  <Input
                    id="visit-frequency"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={intakeData.visitFrequency ?? ''}
                    onChange={(e) => updateData('visitFrequency', e.target.value)}
                    placeholder="e.g., 3x per week"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <Label htmlFor="visit-duration" className="block text-sm font-medium text-gray-700 mb-1.5">Visit Duration</Label>
                  <Input
                    id="visit-duration"
                    type="text"
                    className="w-full min-h-[44px]"
                    value={
                      intakeData.visitDuration !== undefined
                        ? String(intakeData.visitDuration)
                        : ''
                    }
                    onChange={(e) => updateData('visitDuration', e.target.value)}
                    placeholder="e.g., 45-60 min"
                  />
                </div>
              </div>
            </div>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Tasks to Perform
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  'Bathing assistance',
                  'Dressing assistance',
                  'Toileting assistance',
                  'Medication reminders',
                  'Meal preparation',
                  'Light housekeeping',
                  'Laundry',
                  'Transportation',
                  'Companionship',
                  'Exercise assistance',
                  'Vital signs monitoring',
                  'Wound care',
                ].map((task) => {
                  const id = `task-${task.toLowerCase().replace(/\s+/g, '-')}`;
                  return (
                    <div
                      key={task}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer min-h-[48px] select-none transition-colors"
                    >
                      <Checkbox
                        id={id}
                        checked={intakeData.tasks?.includes(task) ?? false}
                        onCheckedChange={() => toggleTask(task)}
                      />
                      <Label htmlFor={id} className="text-sm font-medium text-gray-800 cursor-pointer flex-1">
                        {task}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Goals of Care
              </h3>
              <Label htmlFor="care-goals" className="sr-only">
                Goals of Care
              </Label>
              <Textarea
                id="care-goals"
                className="w-full font-sans resize-y"
                value={intakeData.goals ?? ''}
                onChange={(e) => updateData('goals', e.target.value)}
                placeholder="Describe the client's care goals (e.g., maintain independence, prevent falls, improve nutrition, social engagement)"
                rows={4}
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">
              Consent & Signatures
            </h2>

            <div className="mb-8 md:mb-10">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Required Consents
              </h3>

              <div className="mb-4 p-4 md:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-start gap-3.5">
                  <Checkbox
                    id="consent-care-agreement"
                    className="mt-0.5"
                    checked={Boolean(intakeData.consents?.careAgreement)}
                    onCheckedChange={(checked) => updateNestedData('consents', 'careAgreement', Boolean(checked))}
                  />
                  <Label htmlFor="consent-care-agreement" className="text-sm cursor-pointer">
                    <strong className="block text-gray-900 mb-1">Care Agreement</strong>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-normal">
                      I agree to the terms and conditions of the care agreement, including service
                      scope, fees, and responsibilities.
                    </p>
                  </Label>
                </div>
              </div>

              <div className="mb-4 p-4 md:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-start gap-3.5">
                  <Checkbox
                    id="consent-hipaa"
                    className="mt-0.5"
                    checked={Boolean(intakeData.consents?.hipaa)}
                    onCheckedChange={(checked) => updateNestedData('consents', 'hipaa', Boolean(checked))}
                  />
                  <Label htmlFor="consent-hipaa" className="text-sm cursor-pointer">
                    <strong className="block text-gray-900 mb-1">HIPAA Privacy Notice</strong>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-normal">
                      I acknowledge receipt of the HIPAA Privacy Notice and consent to the use
                      and disclosure of protected health information for treatment, payment, and
                      healthcare operations.
                    </p>
                  </Label>
                </div>
              </div>

              <div className="mb-4 p-4 md:p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-start gap-3.5">
                  <Checkbox
                    id="consent-financial"
                    className="mt-0.5"
                    checked={Boolean(intakeData.consents?.financialResponsibility)}
                    onCheckedChange={(checked) =>
                      updateNestedData('consents', 'financialResponsibility', Boolean(checked))
                    }
                  />
                  <Label htmlFor="consent-financial" className="text-sm cursor-pointer">
                    <strong className="block text-gray-900 mb-1">Financial Responsibility</strong>
                    <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-normal">
                      I understand and agree to the payment terms, including my responsibility
                      for any services not covered by insurance.
                    </p>
                  </Label>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-base md:text-lg font-semibold text-gray-700 pb-2 mb-4 border-b-2 border-gray-200">
                Signature
              </h3>
              <div className="flex-1 min-w-0 flex flex-col mb-4">
                <Label htmlFor="signature" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Client/Representative Name
                </Label>
                <Input
                  id="signature"
                  type="text"
                  className="w-full min-h-[44px]"
                  value={intakeData.signature ?? ''}
                  onChange={(e) => updateData('signature', e.target.value)}
                  placeholder="Type full name to sign"
                />
              </div>
              <div className="p-6 md:p-8 border-2 border-dashed border-gray-300 rounded-xl text-center bg-gray-50/50 w-full box-border">
                <p className="text-2xl font-serif italic text-gray-900 mb-5 min-h-[36px] flex items-center justify-center break-words">
                  {intakeData.signature ?? 'Signature will appear here'}
                </p>
                <div className="w-full h-0.5 bg-gray-400 my-4" />
                <p className="text-xs text-gray-500 font-medium">
                  Date: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">
              Review & Submit
            </h2>

            {/* Client Information Review */}
            <div className="p-4 sm:p-5 md:p-6 mb-5 md:mb-6 bg-gray-50/70 rounded-xl border border-gray-200 shadow-sm w-full box-border">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 pb-2 mb-3 border-b border-gray-200">
                Client Information
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Name:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.firstName || intakeData.lastName ? (
                    `${intakeData.firstName ?? ''} ${intakeData.lastName ?? ''}`.trim()
                  ) : (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  DOB:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.dateOfBirth ?? <span className="text-gray-400 italic">Not provided</span>}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Phone:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.phone ?? <span className="text-gray-400 italic">Not provided</span>}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Address:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.address?.line1 ? (
                    <>
                      {intakeData.address.line1}
                      {intakeData.address.line2 ? `, ${intakeData.address.line2}` : ''}
                      {intakeData.address.city ? `, ${intakeData.address.city}` : ''}
                      {intakeData.address.state ? `, ${intakeData.address.state}` : ''}
                      {intakeData.address.postalCode ? ` ${intakeData.address.postalCode}` : ''}
                    </>
                  ) : (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </span>
              </div>
            </div>

            {/* Care Plan Summary Review */}
            <div className="p-4 sm:p-5 md:p-6 mb-5 md:mb-6 bg-gray-50/70 rounded-xl border border-gray-200 shadow-sm w-full box-border">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 pb-2 mb-3 border-b border-gray-200">
                Care Plan Summary
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Service Types:
                </span>
                <div className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.serviceTypes && intakeData.serviceTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {intakeData.serviceTypes.map((type) => (
                        <span
                          key={type}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">None selected</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Frequency:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {blankToUndefined(intakeData.visitFrequency) ?? <span className="text-gray-400 italic">Not set</span>}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Duration:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {typeof intakeData.visitDuration === 'number' ? (
                    `${intakeData.visitDuration} minutes`
                  ) : // eslint-disable-next-line sonarjs/no-nested-conditional
                  blankToUndefined(intakeData.visitDuration) ? (
                    intakeData.visitDuration!.trim()
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Tasks:
                </span>
                <div className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.tasks && intakeData.tasks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {intakeData.tasks.map((task) => (
                        <span
                          key={task}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">None selected</span>
                  )}
                </div>
              </div>
            </div>

            {/* Consents Review */}
            <div className="p-4 sm:p-5 md:p-6 mb-5 md:mb-6 bg-gray-50/70 rounded-xl border border-gray-200 shadow-sm w-full box-border">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 pb-2 mb-3 border-b border-gray-200">
                Consents
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 border-b border-gray-200/80 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  All Consents:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {Object.values(intakeData.consents ?? {}).length > 0 &&
                  Object.values(intakeData.consents ?? {}).every((v) => v) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ✓ All Signed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      ⚠️ Incomplete
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline py-2.5 md:py-3 gap-1 sm:gap-4 w-full">
                <span className="text-xs sm:text-sm font-semibold sm:font-medium text-gray-500 sm:text-gray-600 sm:w-44 sm:min-w-[170px] sm:flex-shrink-0 uppercase sm:normal-case tracking-wider sm:tracking-normal">
                  Signature:
                </span>
                <span className="text-sm md:text-base font-medium sm:font-normal text-gray-900 break-words flex-1 min-w-0">
                  {intakeData.signature ?? <span className="text-gray-400 italic">No signature captured</span>}
                </span>
              </div>
            </div>

            <div className="p-4 md:p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm leading-relaxed mt-6">
              <p className="font-semibold mb-1">⚠️ Review all information carefully</p>
              <p>Once submitted, the client record will be created. Visits can be scheduled separately.</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200 w-full">
        {/* Step Indicator on Desktop & Mobile */}
        <div className="text-sm font-medium text-gray-500 order-2 sm:order-2 text-center">
          Step {currentStep} of {STEPS.length}
        </div>

        {/* Action Buttons */}
        <div className="w-full sm:w-auto flex flex-col-reverse sm:flex-row gap-3 order-1 sm:order-1 sm:contents">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto min-h-[48px] sm:min-w-[120px] order-2 sm:order-1"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            ← Back
          </Button>

          {/* Save button — available on all steps once required fields are filled */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto min-h-[48px] sm:min-w-[120px] order-3 sm:order-2"
            onClick={() => { void handleSave(); }}
            disabled={createClient.isPending || updateClient.isPending}
          >
            {(createClient.isPending || updateClient.isPending) ? 'Saving…' : '💾 Save'}
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full sm:w-auto min-h-[48px] sm:min-w-[120px] order-1 sm:order-3"
              onClick={handleNext}
            >
              Next →
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full sm:w-auto min-h-[50px] sm:min-w-[200px] order-1 sm:order-3"
              onClick={() => { void handleSubmit(); }}
            >
              Submit & Create Client
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
