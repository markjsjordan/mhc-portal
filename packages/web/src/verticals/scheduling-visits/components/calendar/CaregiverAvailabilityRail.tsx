import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export interface CaregiverCardItem {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  color: string;
  visitCount: number;
  scheduledHours: number;
}

export interface CaregiverAvailabilityRailProps {
  isOpen: boolean;
  onClose: () => void;
  caregivers: CaregiverCardItem[];
  selectedCaregiverIds: string[];
  onToggleCaregiver: (caregiverId: string) => void;
  onAssignVisitToCaregiver?: (visitId: string, caregiverId: string) => void;
  isLoading?: boolean;
}

export const CaregiverAvailabilityRail: React.FC<CaregiverAvailabilityRailProps> = ({
  isOpen,
  onClose,
  caregivers,
  selectedCaregiverIds,
  onToggleCaregiver,
  onAssignVisitToCaregiver,
  isLoading = false,
}) => {
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [dragOverCaregiverId, setDragOverCaregiverId] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const activeCaregivers = caregivers.filter((c) => c.visitCount > 0);
  const inactiveCaregivers = caregivers.filter((c) => c.visitCount === 0);

  const handleDragOver = (e: React.DragEvent, caregiverId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCaregiverId(caregiverId);
  };

  const handleDragLeave = () => {
    setDragOverCaregiverId(null);
  };

  const handleDrop = (e: React.DragEvent, caregiverId: string) => {
    e.preventDefault();
    setDragOverCaregiverId(null);
    const visitId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
    if (visitId && onAssignVisitToCaregiver) {
      onAssignVisitToCaregiver(visitId, caregiverId);
    }
  };

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shadow-sm z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-semibold text-gray-900 text-sm">
          Caregiver Availability
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          title="Collapse Availability Panel"
        >
          <span>Collapse</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        )}

        {!isLoading && caregivers.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-500">
            No caregivers found
          </div>
        )}

        {/* Active caregivers with visits in range */}
        {!isLoading &&
          activeCaregivers.map((cg) => {
            const isSelected = selectedCaregiverIds.includes(cg.id);
            const isDragOver = dragOverCaregiverId === cg.id;

            return (
              <div
                key={cg.id}
                onClick={() => onToggleCaregiver(cg.id)}
                onDragOver={(e) => handleDragOver(e, cg.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, cg.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400'
                    : isSelected
                    ? 'border-teal-500 bg-teal-50/20 ring-2 ring-teal-500 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: cg.color || '#3B82F6' }}
                  >
                    {cg.avatarUrl ? (
                      <img
                        src={cg.avatarUrl}
                        alt={cg.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      cg.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-xs truncate">
                        {cg.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-semibold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                          FILTERED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {cg.visitCount} {cg.visitCount === 1 ? 'visit' : 'visits'} |{' '}
                      {cg.scheduledHours.toFixed(1)} hrs
                    </div>
                  </div>
                </div>

                {isDragOver && (
                  <div className="mt-2 text-center text-xs font-semibold text-blue-700 py-1 bg-blue-100 rounded">
                    Drop to assign visit
                  </div>
                )}
              </div>
            );
          })}

        {/* Collapsible Accordion for Caregivers with No Visits */}
        {!isLoading && inactiveCaregivers.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setInactiveExpanded((prev) => !prev)}
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded hover:bg-gray-50 transition-colors"
            >
              <span>No visits in range ({inactiveCaregivers.length})</span>
              {inactiveExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {inactiveExpanded && (
              <div className="mt-2 space-y-1.5 pl-1">
                {inactiveCaregivers.map((cg) => {
                  const isSelected = selectedCaregiverIds.includes(cg.id);
                  const isDragOver = dragOverCaregiverId === cg.id;

                  return (
                    <div
                      key={cg.id}
                      onClick={() => onToggleCaregiver(cg.id)}
                      onDragOver={(e) => handleDragOver(e, cg.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, cg.id)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isDragOver
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                          : isSelected
                          ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500'
                          : 'border-gray-150 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800 truncate">
                          {cg.name}
                        </span>
                        <span className="text-[10px] text-gray-400">0 visits</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
