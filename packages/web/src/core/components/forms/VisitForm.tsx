import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiClient } from '@/core/hooks';
import VisitTypeSelector from '@/verticals/scheduling-visits/components/VisitTypeSelector';
import type { VisitType } from '@/verticals/scheduling-visits/types';

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
  onSubmit: (data: VisitFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export const VisitForm: React.FC<VisitFormProps> = ({
  initialDate,
  initialStartTime = '09:00',
  initialEndTime = '10:00',
  onSubmit,
  isSubmitting = false,
}) => {
  const apiClient = useApiClient();
  const [visitType, setVisitType] = useState<VisitType>('REGULAR');
  const [formData, setFormData] = useState<VisitFormData>({
    clientId: '',
    serviceTypeId: '',
    visitType: 'REGULAR',
    scheduledDate: initialDate || new Date().toISOString().split('T')[0]!,
    scheduledStartTime: initialStartTime,
    scheduledEndTime: initialEndTime,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof VisitFormData, string>>>({});

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'active'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: any[] }>('/api/clients?limit=100');
      return response.data;
    },
  });

  // Fetch service types
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: any[] }>('/api/service-types?limit=100');
      return response.data;
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
    } catch (error) {
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
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Client <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.clientId}
          onChange={(e) => handleChange('clientId', e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.clientId ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select a client</option>
          {clients.map((client: any) => (
            <option key={client.id} value={client.id}>
              {client.first_name} {client.last_name}
            </option>
          ))}
        </select>
        {errors.clientId && <p className="mt-1 text-sm text-red-500">{errors.clientId}</p>}
      </div>

      {/* Service Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Service Type <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.serviceTypeId}
          onChange={(e) => handleChange('serviceTypeId', e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.serviceTypeId ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select a service type</option>
          {serviceTypes.map((type: any) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {errors.serviceTypeId && <p className="mt-1 text-sm text-red-500">{errors.serviceTypeId}</p>}
      </div>

      {/* Visit Type Selection */}
      <div>
        <VisitTypeSelector
          value={visitType}
          onChange={(type) => handleChange('visitType', type)}
          required={true}
        />
        {errors.visitType && <p className="mt-2 text-sm text-red-500">{errors.visitType}</p>}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.scheduledDate}
          onChange={(e) => handleChange('scheduledDate', e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.scheduledDate ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.scheduledDate && <p className="mt-1 text-sm text-red-500">{errors.scheduledDate}</p>}
      </div>

      {/* Start and End Times */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={formData.scheduledStartTime}
            onChange={(e) => handleChange('scheduledStartTime', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.scheduledStartTime ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.scheduledStartTime && <p className="mt-1 text-sm text-red-500">{errors.scheduledStartTime}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            End Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={formData.scheduledEndTime}
            onChange={(e) => handleChange('scheduledEndTime', e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.scheduledEndTime ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.scheduledEndTime && <p className="mt-1 text-sm text-red-500">{errors.scheduledEndTime}</p>}
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          type="text"
          value={formData.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Service address"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Internal Notes</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Internal notes"
        />
      </div>

      {/* Client Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Client Instructions</label>
        <textarea
          value={formData.clientInstructions || ''}
          onChange={(e) => handleChange('clientInstructions', e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Instructions for caregiver"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Visit'}
        </button>
      </div>
    </form>
  );
};
