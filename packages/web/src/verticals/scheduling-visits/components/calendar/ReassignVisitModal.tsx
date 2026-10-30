import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';
import type { Visit } from '../../types/index.js';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';

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

const getCaregiverRowClass = (isSelected: boolean, isCurrent: boolean): string => {
  if (isSelected) return 'bg-primary text-primary-foreground font-semibold';
  if (isCurrent) return 'bg-muted text-muted-foreground';
  return 'hover:bg-accent hover:text-accent-foreground text-foreground';
};

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
        className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <h3 className="font-bold text-foreground text-sm">
            Reassign Visit Caregiver
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Visit summary */}
        <div className="p-4 bg-primary/5 border-b border-primary/20">
          <div className="font-semibold text-foreground text-sm">{clientName}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {visit.scheduledStartTime} - {visit.scheduledEndTime}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Current Caregiver:{' '}
            <span className="font-medium text-foreground">
              {(() => {
                if (currentCaregiver) return currentCaregiver.name;
                if (visit.caregiverFirstName && visit.caregiverLastName) {
                  return `${visit.caregiverFirstName} ${visit.caregiverLastName}`;
                }
                if (visit.caregiverName) return visit.caregiverName;
                if (visit.assignedCaregiverName) return visit.assignedCaregiverName;
                if (visit.assignedCaregiverId) return 'Assigned';
                return 'Unassigned';
              })()}
            </span>
          </div>
        </div>

        {/* Caregiver Selection */}
        <div className="p-4 space-y-3">
          <Label className="block text-xs font-semibold text-foreground">
            Select New Caregiver:
          </Label>
          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-border rounded-xl p-1.5">
            {caregivers.map((cg) => {
              const isSelected = selectedCaregiverId === cg.id;
              const isCurrent = visit.assignedCaregiverId === cg.id;

              return (
                <div
                  key={cg.id}
                  onClick={() => setSelectedCaregiverId(cg.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${getCaregiverRowClass(isSelected, isCurrent)}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cg.color ?? '#3B82F6' }}
                    />
                    <span>{cg.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] text-muted-foreground">(Current)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-muted/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={!selectedCaregiverId || selectedCaregiverId === visit.assignedCaregiverId || isSubmitting}
          >
            {isSubmitting ? 'Assigning...' : 'Assign Caregiver'}
          </Button>
        </div>
      </div>
    </div>
  );
};
