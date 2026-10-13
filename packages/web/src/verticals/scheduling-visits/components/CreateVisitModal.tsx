import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/core/components/Button';
import { FormField } from '@/core/components/forms/FormField';
import { Select } from '@/core/components/forms/Select';
import { useClients } from '@/verticals/client-demographics/hooks/useClients';
import { useCaregivers } from '@/verticals/caregivers/hooks/useCaregivers';
import { useCreateVisit, useCheckConflicts } from '../hooks/useCreateVisit';
import type { VisitType } from '../types';
import toast from 'react-hot-toast';

/**
 * Validation schema for create visit form
 */
const CreateVisitFormSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  serviceTypeId: z.string().uuid('Invalid service type'),
  serviceTypeName: z.string().min(1, 'Service type name required'),
  scheduledDate: z.string().date('Invalid date format'),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time'),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time'),
  timezone: z.string(),
  assignedCaregiverId: z.string().uuid().optional().nullable(),
  visitType: z.enum([
    'REGULAR',
    'INITIAL',
    'DISCHARGE',
    'RESPITE',
    'EMERGENCY',
    'MAKEUP',
    'SUPERVISION',
    'ASSESSMENT',
  ]),
  notes: z.string().max(1000).optional(),
});

type CreateVisitFormData = z.infer<typeof CreateVisitFormSchema>;

export interface CreateVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** Pre-select a client if opened from a client row */
  defaultClientId?: string;
  /** Pre-select a date if opened from calendar */
  defaultDate?: string;
}

const VISIT_TYPE_OPTIONS = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'INITIAL', label: 'Initial Assessment' },
  { value: 'DISCHARGE', label: 'Discharge' },
  { value: 'RESPITE', label: 'Respite Care' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'MAKEUP', label: 'Makeup Visit' },
  { value: 'SUPERVISION', label: 'Supervision' },
  { value: 'ASSESSMENT', label: 'Assessment' },
];

// Common service types available
const SERVICE_TYPE_OPTIONS = [
  { value: 'personal-care', label: 'Personal Care' },
  { value: 'skilled-nursing', label: 'Skilled Nursing' },
  { value: 'physical-therapy', label: 'Physical Therapy' },
  { value: 'occupational-therapy', label: 'Occupational Therapy' },
  { value: 'speech-therapy', label: 'Speech Therapy' },
  { value: 'medical-transport', label: 'Medical Transport' },
  { value: 'medication-management', label: 'Medication Management' },
  { value: 'meal-prep', label: 'Meal Preparation' },
];

/**
 * Modal component for creating a new visit
 *
 * Features:
 * - Form validation with Zod + React Hook Form
 * - Client, service type, and caregiver selection
 * - Date/time picker with validation
 * - Real-time conflict checking when caregiver assigned
 * - Error handling with user-friendly messages
 * - Keyboard navigation support
 */
export const CreateVisitModal: React.FC<CreateVisitModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  defaultClientId,
  defaultDate,
}) => {
  const { data: clientsData } = useClients();
  const { data: caregiversData } = useCaregivers();
  const createVisitMutation = useCreateVisit({ onSuccess: onCreated });
  const checkConflictsMutation = useCheckConflicts();

  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflicts, setConflicts] = useState<
    Array<{
      visitId: string;
      caregiverName: string;
      scheduledStartTime: string;
      scheduledEndTime: string;
      clientName: string;
    }>
  >([]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CreateVisitFormData>({
    resolver: zodResolver(CreateVisitFormSchema as any),
    defaultValues: {
      timezone: 'America/New_York',
      visitType: 'REGULAR',
      clientId: defaultClientId || '',
      scheduledDate: defaultDate || new Date().toISOString().split('T')[0],
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:00',
      serviceTypeId: 'personal-care',
      serviceTypeName: 'Personal Care',
    },
  });

  const selectedCaregiverId = watch('assignedCaregiverId');
  const selectedDate = watch('scheduledDate');
  const startTime = watch('scheduledStartTime');
  const endTime = watch('scheduledEndTime');

  // Auto-check conflicts when caregiver, date, or time changes
  useEffect(() => {
    if (!selectedCaregiverId || !selectedDate || !startTime || !endTime) {
      setShowConflictWarning(false);
      return;
    }

    const checkConflictsAsync = async () => {
      try {
        const result = await checkConflictsMutation.mutateAsync({
          caregiverId: selectedCaregiverId,
          scheduledDate: selectedDate,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
        });

        if (result.hasConflicts) {
          setShowConflictWarning(true);
          setConflicts(result.conflicts);
        } else {
          setShowConflictWarning(false);
          setConflicts([]);
        }
      } catch (error) {
        // Error is handled by mutation
        setShowConflictWarning(false);
      }
    };

    const debounceTimer = setTimeout(checkConflictsAsync, 500);
    return () => clearTimeout(debounceTimer);
  }, [selectedCaregiverId, selectedDate, startTime, endTime, checkConflictsMutation]);

  const onSubmit = (data: CreateVisitFormData) => {
    // Don't allow submission if there are unresolved conflicts
    if (showConflictWarning) {
      toast.error('Please resolve caregiver conflicts before creating the visit');
      return;
    }

    void (async () => {
      try {
        await createVisitMutation.mutateAsync({
          clientId: data.clientId,
          serviceTypeId: data.serviceTypeId,
          serviceTypeName: data.serviceTypeName,
          scheduledDate: data.scheduledDate,
          scheduledStartTime: data.scheduledStartTime,
          scheduledEndTime: data.scheduledEndTime,
          timezone: data.timezone,
          assignedCaregiverId: data.assignedCaregiverId || undefined,
          visitType: data.visitType as VisitType,
          notes: data.notes,
          checkConflicts: !showConflictWarning, // Already checked
        });

        reset();
        onClose();
      } catch (error) {
        // Error is handled by mutation
      }
    })();
  };

  if (!isOpen) return null;

  const clients = clientsData?.items ?? [];
  const caregivers = caregiversData?.items ?? [];

  const clientOptions = clients.map((c: any) => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
  }));

  const caregiverOptions = caregivers.map((cg: any) => ({
    value: cg.id,
    label: `${cg.firstName} ${cg.lastName}`,
  }));

  // Get minimum date (today)
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
            Create New Visit
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close modal"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-5">
            {/* Client Selection */}
            <FormField label="Client" required error={errors.clientId?.message}>
              <Controller
                name="clientId"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={clientOptions}
                    placeholder="Select a client"
                    disabled={createVisitMutation.isPending}
                  />
                )}
              />
            </FormField>

            {/* Service Type Selection */}
            <FormField
              label="Service Type"
              required
              error={errors.serviceTypeId?.message}
            >
              <Controller
                name="serviceTypeId"
                control={control}
                render={({ field }) => (
                  <>
                    <Select
                      {...field}
                      options={SERVICE_TYPE_OPTIONS}
                      placeholder="Select a service type"
                      disabled={createVisitMutation.isPending}
                      onChange={(e) => {
                        field.onChange(e);
                        // Auto-populate service type name
                        const serviceType = SERVICE_TYPE_OPTIONS.find(
                          (st) => st.value === e.target.value
                        );
                        if (serviceType) {
                          setValue('serviceTypeName', serviceType.label);
                        }
                      }}
                    />
                  </>
                )}
              />
              <input type="hidden" {...register('serviceTypeName')} />
            </FormField>

            {/* Visit Type */}
            <FormField label="Visit Type" error={errors.visitType?.message}>
              <Controller
                name="visitType"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={VISIT_TYPE_OPTIONS}
                    disabled={createVisitMutation.isPending}
                  />
                )}
              />
            </FormField>

            {/* Date */}
            <FormField label="Date" required error={errors.scheduledDate?.message}>
              <Controller
                name="scheduledDate"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="date"
                    disabled={createVisitMutation.isPending}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min={minDate}
                  />
                )}
              />
            </FormField>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Start Time"
                required
                error={errors.scheduledStartTime?.message}
              >
                <Controller
                  name="scheduledStartTime"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="time"
                      disabled={createVisitMutation.isPending}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                />
              </FormField>

              <FormField
                label="End Time"
                required
                error={errors.scheduledEndTime?.message}
              >
                <Controller
                  name="scheduledEndTime"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="time"
                      disabled={createVisitMutation.isPending}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                />
              </FormField>
            </div>

            {/* Caregiver Assignment */}
            <FormField
              label="Assign Caregiver (Optional)"
              error={errors.assignedCaregiverId?.message}
            >
              <Controller
                name="assignedCaregiverId"
                control={control}
                render={({ field: { value, ...field } }) => (
                  <Select
                    {...field}
                    value={value ?? ''}
                    options={[{ value: '', label: '-- None --' }, ...caregiverOptions]}
                    placeholder="Leave empty to assign later"
                    disabled={createVisitMutation.isPending}
                  />
                )}
              />
            </FormField>

            {/* Conflict Warning */}
            {showConflictWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">
                      Scheduling Conflict Detected
                    </p>
                    <p className="text-yellow-700 mt-1">
                      This caregiver has existing visits during the selected time:
                    </p>
                    <ul className="mt-2 space-y-1 text-yellow-700">
                      {conflicts.map((c) => (
                        <li key={c.visitId} className="text-xs">
                          {c.clientName} ({c.scheduledStartTime} - {c.scheduledEndTime})
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-yellow-800">
                      <button
                        type="button"
                        onClick={() => setValue('assignedCaregiverId', null)}
                        className="font-semibold hover:underline"
                      >
                        Unassign caregiver
                      </button>
                      {' '}or choose a different time
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <FormField label="Notes (Optional)" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                disabled={createVisitMutation.isPending}
                placeholder="Add any special instructions or notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </FormField>

            <input type="hidden" {...register('timezone')} value="America/New_York" />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 sticky bottom-0 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createVisitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createVisitMutation.isPending || showConflictWarning}
            >
              {createVisitMutation.isPending ? (
                <>
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Visit'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
