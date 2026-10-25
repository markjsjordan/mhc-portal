import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { VisitForm } from './VisitForm.js';
import { useVisitApi } from '@/verticals/scheduling-visits/hooks/useVisits.js';
import type { CreateVisitPayload } from '@/verticals/scheduling-visits/services/visit-api.js';
import type { VisitType } from '@/verticals/scheduling-visits/types/index.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Visit</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <VisitForm
            initialDate={preSelectedDate}
            initialStartTime={preSelectedStartTime}
            initialEndTime={preSelectedEndTime}
            initialVisitType={initialVisitType}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
