import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiClient } from '@/core/hooks/index.js';
import { extractList } from '@/core/utils/list-response.js';
import VisitTypeSelector from '@/verticals/scheduling-visits/components/VisitTypeSelector.js';
import type { VisitType } from '@/verticals/scheduling-visits/types/index.js';
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

interface VisitFormProps {
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialVisitType?: VisitType;
  onSubmit: (data: VisitFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export const VisitForm: React.FC<VisitFormProps> = ({
  initialDate,
  initialStartTime = '09:00',
  initialEndTime = '10:00',
  initialVisitType = 'REGULAR',
  onSubmit,
  isSubmitting = false,
}) => {
  const apiClient = useApiClient();
  const [visitType, setVisitType] = useState<VisitType>(initialVisitType);
  const [formData, setFormData] = useState<VisitFormData>({
    clientId: '',
    serviceTypeId: '',
    visitType: initialVisitType,
    scheduledDate: initialDate || new Date().toISOString().split('T')[0]!,
    scheduledStartTime: initialStartTime,
    scheduledEndTime: initialEndTime,
  });

  React.useEffect(() => {
    if (initialVisitType) {
      setVisitType(initialVisitType);
      setFormData((prev) => ({ ...prev, visitType: initialVisitType }));
    }
  }, [initialVisitType]);

  const [errors, setErrors] = useState<Partial<Record<keyof VisitFormData, string>>>({});

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'active'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/api/clients?limit=100');
      // API returns { data: { items } }; showcase returns a bare array.
      return extractList<any>(response);
    },
  });

  // Fetch service types
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/api/service-types?limit=100');
      return extractList<any>(response);
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

    if (!formData.visitType) {
      newErrors.visitType = 'Visit type is required';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch {
      toast.error('Failed to create visit');
    }
  };

  const handleChange = (field: keyof VisitFormData, value: string | VisitType) => {
    if (field === 'visitType') {
      setVisitType(value as VisitType);
      setFormData((prev) => ({
        ...prev,
        visitType: value as VisitType,
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
            {clients.map((client: any) => (
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
            {serviceTypes.map((type: any) => (
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

      {/* Start and End Times */}
      <div className="grid grid-cols-2 gap-4">
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

      {/* Address */}
      <div className="space-y-1">
        <Label htmlFor="visit-address" className="text-sm font-medium">Address</Label>
        <Input
          id="visit-address"
          type="text"
          value={formData.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="Service address"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="visit-notes" className="text-sm font-medium">Internal Notes</Label>
        <Textarea
          id="visit-notes"
          value={formData.notes || ''}
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
          value={formData.clientInstructions || ''}
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
