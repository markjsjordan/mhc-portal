import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { VisitForm } from './VisitForm';
import { useVisitApi } from '@/verticals/scheduling-visits/hooks/useVisits';
import type { CreateVisitPayload } from '@/verticals/scheduling-visits/services/visit-api';

import type { VisitType } from '@/verticals/scheduling-visits/types';

interface CreateVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // Pre-populate from calendar slot click
  preSelectedDate?: string;
  preSelectedStartTime?: string;
  preSelectedEndTime?: string;
  initialVisitType?: VisitType;
}

export const CreateVisitModal: React.FC<CreateVisitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedDate,
  preSelectedStartTime = '09:00',
  preSelectedEndTime = '10:00',
  initialVisitType = 'REGULAR',
}) => {
  const visitApi = useVisitApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CreateVisitPayload) => {
    setIsSubmitting(true);
    try {
      await visitApi.createVisit(data);
      toast.success('Visit created successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create visit';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Create New Visit</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <VisitForm
            initialDate={preSelectedDate}
            initialStartTime={preSelectedStartTime}
            initialEndTime={preSelectedEndTime}
            initialVisitType={initialVisitType}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
};
