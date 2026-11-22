import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useApiClient } from '@/core/hooks/index.js';
import { extractList } from '@/core/utils/list-response.js';
import VisitTypeSelector from '@/verticals/scheduling-visits/components/VisitTypeSelector.js';
import type { VisitType } from '@/verticals/scheduling-visits/types/index.js';
import {
  formatCaregiverOptionLabel,
  type CaregiverOption,
} from '@/verticals/scheduling-visits/utils/caregiverOptionLabel.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';

interface ClientItem {
  id: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
}

interface ServiceTypeItem {
  id: string;
  name: string;
}

interface VisitFormData {
  clientId: string;
  caregiverId?: string;
  serviceTypeId: string;
  visitType: VisitType;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  address?: string;
  notes?: string;
  clientInstructions?: string;
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour (60 min)' },
  { value: 90, label: '1.5 hours (90 min)' },
  { value: 120, label: '2 hours (120 min)' },
  { value: 180, label: '3 hours (180 min)' },
  { value: 240, label: '4 hours (240 min)' },
  { value: 360, label: '6 hours (360 min)' },
  { value: 480, label: '8 hours (480 min)' },
] as const;

const UNASSIGNED_VALUE = 'UNASSIGNED';

function parseTimeToMinutes(time: string): number | null {
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  return parts[0]! * 60 + parts[1]!;
}

function formatMinutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mins = String(clamped % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function computeInitialDuration(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return 60;
  }
  return end - start;
}

interface VisitFormProps {
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialCaregiverId?: string;
  initialVisitType?: VisitType;
  onSubmit: (data: VisitFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export const VisitForm: React.FC<VisitFormProps> = ({
  initialDate,
  initialStartTime = '09:00',
  initialEndTime = '10:00',
  initialCaregiverId,
  initialVisitType = 'REGULAR',
  onSubmit,
  isSubmitting = false,
}) => {
  const apiClient = useApiClient();
  const [visitType, setVisitType] = useState<VisitType>(initialVisitType);
  const [durationMinutes, setDurationMinutes] = useState<number>(() =>
    computeInitialDuration(initialStartTime, initialEndTime)
  );
  const [formData, setFormData] = useState<VisitFormData>({
    clientId: '',
    caregiverId: initialCaregiverId ?? '',
    serviceTypeId: '',
    visitType: initialVisitType,
    scheduledDate: initialDate ?? new Date().toISOString().split('T')[0]!,
    scheduledStartTime: initialStartTime,
    scheduledEndTime: initialEndTime,
  });

  React.useEffect(() => {
    setVisitType(initialVisitType);
    setFormData((prev) => ({ ...prev, visitType: initialVisitType }));
  }, [initialVisitType]);

  const [errors, setErrors] = useState<Partial<Record<keyof VisitFormData, string>>>({});

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'active'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/api/clients?limit=100');
      // API returns { data: { items } }; showcase returns a bare array.
      return extractList<ClientItem>(response);
    },
  });

  // Fetch active caregivers for manual optional assignment (no AI suggestions)
  const { data: caregivers = [] } = useQuery({
    queryKey: ['caregivers', 'active'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/api/caregivers?limit=100');
      return extractList<CaregiverOption>(response);
    },
  });

  // Fetch service types
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/api/service-types?limit=100');
      return extractList<ServiceTypeItem>(response);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof VisitFormData, string>> = {};

    if (!formData.clientId) {
      newErrors.clientId = 'Client is required';
    }

    if (!formData.serviceTypeId) {
      newErrors.serviceTypeId = 'Service type is required';
    }

    if (!formData.scheduledDate) {
      newErrors.scheduledDate = 'Date is required';
    }

    if (!formData.scheduledStartTime) {
      newErrors.scheduledStartTime = 'Start time is required';
    }

    if (!formData.scheduledEndTime) {
      newErrors.scheduledEndTime = 'End time is required';
    }

    // Validate that end time is after start time
    if (formData.scheduledStartTime && formData.scheduledEndTime) {
      const [startHour, startMin] = formData.scheduledStartTime.split(':').map(Number);
      const [endHour, endMin] = formData.scheduledEndTime.split(':').map(Number);
      const startMinutes = startHour! * 60 + startMin!;
      const endMinutes = endHour! * 60 + endMin!;

      if (endMinutes <= startMinutes) {
        newErrors.scheduledEndTime = 'End time must be after start time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        ...formData,
        caregiverId: formData.caregiverId && formData.caregiverId.length > 0 ? formData.caregiverId : undefined,
      });
    } catch {
      toast.error('Failed to create visit');
    }
  };

  const handleDurationChange = (newDurationStr: string) => {
    const minutes = parseInt(newDurationStr, 10);
    if (Number.isNaN(minutes) || minutes <= 0) return;
    setDurationMinutes(minutes);
    const startMins = parseTimeToMinutes(formData.scheduledStartTime);
    if (startMins !== null) {
      const newEndTime = formatMinutesToTime(startMins + minutes);
      setFormData((prev) => ({ ...prev, scheduledEndTime: newEndTime }));
      if (errors.scheduledEndTime) {
        setErrors((prev) => ({ ...prev, scheduledEndTime: undefined }));
      }
    }
  };

  const handleChange = (field: keyof VisitFormData, value: string | VisitType) => {
    if (field === 'visitType') {
      setVisitType(value as VisitType);
      setFormData((prev) => ({
        ...prev,
        visitType: value as VisitType,
      }));
    } else if (field === 'scheduledStartTime' && typeof value === 'string') {
      const startMins = parseTimeToMinutes(value);
      const nextEndTime =
        startMins !== null ? formatMinutesToTime(startMins + durationMinutes) : formData.scheduledEndTime;
      setFormData((prev) => ({
        ...prev,
        scheduledStartTime: value,
        scheduledEndTime: nextEndTime,
      }));
    } else if (field === 'scheduledEndTime' && typeof value === 'string') {
      const startMins = parseTimeToMinutes(formData.scheduledStartTime);
      const endMins = parseTimeToMinutes(value);
      if (startMins !== null && endMins !== null && endMins > startMins) {
        setDurationMinutes(endMins - startMins);
      }
      setFormData((prev) => ({
        ...prev,
        scheduledEndTime: value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      {/* Client Selection */}
      <div className="space-y-1">
        <Label htmlFor="visit-client" className="text-sm font-medium">
          Client <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.clientId}
          onValueChange={(val) => handleChange('clientId', val)}
        >
          <SelectTrigger
            id="visit-client"
            aria-invalid={!!errors.clientId}
            className={errors.clientId ? 'border-destructive' : ''}
          >
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.firstName ?? client.first_name} {client.lastName ?? client.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.clientId && <p className="mt-1 text-sm text-destructive">{errors.clientId}</p>}
      </div>

      {/* Service Type Selection */}
      <div className="space-y-1">
        <Label htmlFor="visit-service-type" className="text-sm font-medium">
          Service Type <span className="text-destructive">*</span>
        </Label>
        <Select
          value={formData.serviceTypeId}
          onValueChange={(val) => handleChange('serviceTypeId', val)}
        >
          <SelectTrigger
            id="visit-service-type"
            aria-invalid={!!errors.serviceTypeId}
            className={errors.serviceTypeId ? 'border-destructive' : ''}
          >
            <SelectValue placeholder="Select a service type" />
          </SelectTrigger>
          <SelectContent>
            {serviceTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.serviceTypeId && <p className="mt-1 text-sm text-destructive">{errors.serviceTypeId}</p>}
      </div>

      {/* Visit Type Selection */}
      <div className="space-y-1">
        <VisitTypeSelector
          value={visitType}
          onChange={(type) => handleChange('visitType', type)}
        />
        {errors.visitType && <p className="mt-2 text-sm text-destructive">{errors.visitType}</p>}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="visit-date" className="text-sm font-medium">
          Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="visit-date"
          type="date"
          value={formData.scheduledDate}
          onChange={(e) => handleChange('scheduledDate', e.target.value)}
          aria-invalid={!!errors.scheduledDate}
          className={errors.scheduledDate ? 'border-destructive' : ''}
        />
        {errors.scheduledDate && <p className="mt-1 text-sm text-destructive">{errors.scheduledDate}</p>}
      </div>

      {/* Start Time, Duration, and End Time */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="visit-start-time" className="text-sm font-medium">
            Start Time <span className="text-destructive">*</span>
          </Label>
          <Input
            id="visit-start-time"
            type="time"
            value={formData.scheduledStartTime}
            onChange={(e) => handleChange('scheduledStartTime', e.target.value)}
            aria-invalid={!!errors.scheduledStartTime}
            className={errors.scheduledStartTime ? 'border-destructive' : ''}
          />
          {errors.scheduledStartTime && <p className="mt-1 text-sm text-destructive">{errors.scheduledStartTime}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-duration" className="text-sm font-medium">
            Duration <span className="text-destructive">*</span>
          </Label>
          <Select
            value={
              DURATION_OPTIONS.some((opt) => opt.value === durationMinutes)
                ? String(durationMinutes)
                : ''
            }
            onValueChange={handleDurationChange}
          >
            <SelectTrigger id="visit-duration">
              <SelectValue placeholder={`${durationMinutes} min`} />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-end-time" className="text-sm font-medium">
            End Time <span className="text-destructive">*</span>
          </Label>
          <Input
            id="visit-end-time"
            type="time"
            value={formData.scheduledEndTime}
            onChange={(e) => handleChange('scheduledEndTime', e.target.value)}
            aria-invalid={!!errors.scheduledEndTime}
            className={errors.scheduledEndTime ? 'border-destructive' : ''}
          />
          {errors.scheduledEndTime && <p className="mt-1 text-sm text-destructive">{errors.scheduledEndTime}</p>}
        </div>
      </div>

      {/* Optional Caregiver Selection (Manual Only) */}
      <div className="space-y-1">
        <Label htmlFor="visit-caregiver" className="text-sm font-medium">
          Caregiver
        </Label>
        <Select
          value={formData.caregiverId && formData.caregiverId.length > 0 ? formData.caregiverId : UNASSIGNED_VALUE}
          onValueChange={(val) => handleChange('caregiverId', val === UNASSIGNED_VALUE ? '' : val)}
        >
          <SelectTrigger id="visit-caregiver">
            <SelectValue placeholder="-- Unassigned --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_VALUE}>-- Unassigned --</SelectItem>
            {caregivers.map((cg) => (
              <SelectItem key={cg.id} value={cg.id}>
                {formatCaregiverOptionLabel(cg)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Address */}
      <div className="space-y-1">
        <Label htmlFor="visit-address" className="text-sm font-medium">Address</Label>
        <Input
          id="visit-address"
          type="text"
          value={formData.address ?? ''}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="Service address"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="visit-notes" className="text-sm font-medium">Internal Notes</Label>
        <Textarea
          id="visit-notes"
          value={formData.notes ?? ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Internal notes"
          rows={3}
        />
      </div>

      {/* Client Instructions */}
      <div className="space-y-1">
        <Label htmlFor="visit-instructions" className="text-sm font-medium">Client Instructions</Label>
        <Textarea
          id="visit-instructions"
          value={formData.clientInstructions ?? ''}
          onChange={(e) => handleChange('clientInstructions', e.target.value)}
          placeholder="Instructions for caregiver"
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Visit'}
        </Button>
      </div>
    </form>
  );
};
