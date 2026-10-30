import React, { useState } from 'react';
import moment from 'moment';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import type { Visit } from '../../types/index.js';

interface CalendarVisitActionModalProps {
  visit: Visit | null;
  caregiversList: Array<{ id: string; firstName: string; lastName: string; status?: string }>;
  onClose: () => void;
  onAssignCaregiver: (visitId: string, caregiverId: string) => Promise<boolean>;
  onViewDetails: (visitId: string) => void;
}

const getActionModalBadgeClass = (visit: Visit): string => {
  if (visit.status === 'UNASSIGNED' || !visit.assignedCaregiverId) {
    return 'bg-amber-100 text-amber-800 border-2 border-dashed border-amber-400';
  }
  if (visit.status === 'IN_PROGRESS') {
    return 'bg-cyan-100 text-cyan-800 border border-cyan-300';
  }
  if (visit.status === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  }
  if ((visit.status as string) === 'NEEDS_REVIEW' || visit.requiresSupervision) {
    return 'bg-purple-100 text-purple-800 border border-purple-300';
  }
  return 'bg-gray-100 text-gray-800';
};

const getCaregiverLabel = (assignedCaregiverName?: string, assignedCaregiverId?: string): string => {
  if (assignedCaregiverName) return assignedCaregiverName;
  if (assignedCaregiverId) return 'Assigned';
  return 'Unassigned';
};

export const CalendarVisitActionModal: React.FC<CalendarVisitActionModalProps> = ({
  visit,
  caregiversList,
  onClose,
  onAssignCaregiver,
  onViewDetails,
}) => {
  const [reassignCaregiverId, setReassignCaregiverId] = useState<string>(
    visit?.assignedCaregiverId ?? ''
  );
  const [isReassigning, setIsReassigning] = useState(false);

  if (!visit) return null;

  const currentCg = caregiversList.find((c) => c.id === visit.assignedCaregiverId);
  const currentCaregiverName = (() => {
    if (currentCg?.firstName) return `${currentCg.firstName} ${currentCg.lastName}`;
    if (visit.caregiverFirstName && visit.caregiverLastName) {
      return `${visit.caregiverFirstName} ${visit.caregiverLastName}`;
    }
    return visit.caregiverName ?? visit.assignedCaregiverName;
  })();

  const handleSaveReassignment = async () => {
    if (!reassignCaregiverId) {
      toast('Unassigning requires removing caregiver assignment');
      return;
    }
    setIsReassigning(true);
    try {
      const success = await onAssignCaregiver(visit.id, reassignCaregiverId);
      if (success) {
        onClose();
      }
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      data-testid="visit-action-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-5 sm:p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-1.5 ${getActionModalBadgeClass(visit)}`}
            >
              {visit.status === 'UNASSIGNED' || !visit.assignedCaregiverId
                ? 'UNASSIGNED'
                : visit.status}
            </span>
            <h3 className="text-lg font-bold text-gray-900">
              {visit.clientFirstName} {visit.clientLastName}
            </h3>
            <p className="text-xs text-gray-500">
              {visit.serviceTypeName}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Visit Details */}
        <div className="py-4 space-y-3 text-sm">
          <div className="flex items-center gap-2.5 text-gray-700">
            <CalendarIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>
              {moment(visit.scheduledDate).format('dddd, MMMM D, YYYY')}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-gray-700">
            <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>
              {visit.scheduledStartTime} – {visit.scheduledEndTime}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-gray-700">
            <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>
              Current Caregiver:{' '}
              <strong className="text-gray-900">
                {getCaregiverLabel(currentCaregiverName, visit.assignedCaregiverId)}
              </strong>
            </span>
          </div>

          {/* Reassign Caregiver Form */}
          <div className="pt-3 border-t border-border">
            <Label htmlFor="reassign-caregiver-select" className="block text-xs font-semibold text-foreground mb-1.5">
              Reassign Caregiver
            </Label>
            <Select
              value={reassignCaregiverId || 'UNASSIGNED'}
              onValueChange={(val) => setReassignCaregiverId(val === 'UNASSIGNED' ? '' : val)}
            >
              <SelectTrigger
                id="reassign-caregiver-select"
                className="w-full text-sm min-h-[44px]"
                data-testid="reassign-caregiver-select"
              >
                <SelectValue placeholder="Unassigned (No Caregiver)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">Unassigned (No Caregiver)</SelectItem>
                {caregiversList.map((cg) => (
                  <SelectItem key={cg.id} value={cg.id}>
                    {cg.firstName} {cg.lastName} ({cg.status ?? 'Active'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="default"
            size="default"
            disabled={
              isReassigning ||
              reassignCaregiverId === (visit.assignedCaregiverId ?? '')
            }
            onClick={() => {
              void handleSaveReassignment();
            }}
            className="min-h-[44px] flex-1 font-semibold"
            data-testid="reassign-submit-button"
          >
            {isReassigning ? 'Reassigning...' : 'Save Reassignment'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => onViewDetails(visit.id)}
            className="min-h-[44px] font-medium"
          >
            Full Details
          </Button>
        </div>
      </div>
    </div>
  );
};
