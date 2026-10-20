import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';
import type { Visit } from '../../types';

export interface CaregiverOption {
  id: string;
  name: string;
  role?: string;
  color?: string;
}

export interface ReassignVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: Visit | null;
  caregivers: CaregiverOption[];
  onAssignCaregiver: (visitId: string, caregiverId: string) => Promise<boolean>;
}

export const ReassignVisitModal: React.FC<ReassignVisitModalProps> = ({
  isOpen,
  onClose,
  visit,
  caregivers,
  onAssignCaregiver,
}) => {
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !visit) return null;

  const clientName =
    visit.clientFirstName && visit.clientLastName
      ? `${visit.clientFirstName} ${visit.clientLastName}`
      : 'Unknown Client';

  const currentCaregiver = caregivers.find((c) => c.id === visit.assignedCaregiverId);

  const handleConfirm = async () => {
    if (!selectedCaregiverId) return;
    setIsSubmitting(true);
    try {
      const success = await onAssignCaregiver(visit.id, selectedCaregiverId);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-900 text-sm">
            Reassign Visit Caregiver
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visit summary */}
        <div className="p-4 bg-blue-50/50 border-b border-blue-100">
          <div className="font-semibold text-gray-900 text-sm">{clientName}</div>
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {visit.scheduledStartTime} - {visit.scheduledEndTime}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Current Caregiver:{' '}
            <span className="font-medium text-gray-800">
              {currentCaregiver ? currentCaregiver.name : (visit.assignedCaregiverId ? 'Assigned' : 'Unassigned')}
            </span>
          </div>
        </div>

        {/* Caregiver Selection */}
        <div className="p-4 space-y-3">
          <label className="block text-xs font-semibold text-gray-700">
            Select New Caregiver:
          </label>
          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-1.5">
            {caregivers.map((cg) => {
              const isSelected = selectedCaregiverId === cg.id;
              const isCurrent = visit.assignedCaregiverId === cg.id;

              return (
                <div
                  key={cg.id}
                  onClick={() => setSelectedCaregiverId(cg.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : isCurrent
                      ? 'bg-gray-100 text-gray-500'
                      : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cg.color || '#3B82F6' }}
                    />
                    <span>{cg.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] text-gray-400">(Current)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedCaregiverId || selectedCaregiverId === visit.assignedCaregiverId || isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm"
          >
            {isSubmitting ? 'Assigning...' : 'Assign Caregiver'}
          </button>
        </div>
      </div>
    </div>
  );
};
