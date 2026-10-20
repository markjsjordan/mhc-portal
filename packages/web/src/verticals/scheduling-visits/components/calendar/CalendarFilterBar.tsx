import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface FilterOption {
  id: string;
  name: string;
  color?: string;
  visitCount?: number;
}

export interface CalendarFilterBarProps {
  allCaregivers: FilterOption[];
  allClients: FilterOption[];
  selectedCaregivers: string[];
  onCaregiversChange: (ids: string[]) => void;
  selectedClients: string[];
  onClientsChange: (ids: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  onClearAll: () => void;
}

export const STATUS_OPTIONS = [
  { id: 'UNASSIGNED', label: 'Unassigned', dotColor: 'bg-gray-400', activeClass: 'bg-gray-700' },
  { id: 'ASSIGNED', label: 'Assigned', dotColor: 'bg-blue-600', activeClass: 'bg-blue-600' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-cyan-500', activeClass: 'bg-cyan-600' },
  { id: 'COMPLETED', label: 'Completed', dotColor: 'bg-emerald-500', activeClass: 'bg-emerald-600' },
  { id: 'NEEDS_REVIEW', label: 'Needs Review', dotColor: 'bg-amber-500', activeClass: 'bg-amber-600' },
  { id: 'CANCELLED', label: 'Cancelled', dotColor: 'bg-red-500', activeClass: 'bg-red-600' },
];

export const CalendarFilterBar: React.FC<CalendarFilterBarProps> = ({
  allCaregivers,
  allClients,
  selectedCaregivers,
  onCaregiversChange,
  selectedClients,
  onClientsChange,
  selectedStatuses,
  onStatusesChange,
  onClearAll,
}) => {
  const [caregiverSearch, setCaregiverSearch] = useState('');
  const [caregiverDropdownOpen, setCaregiverDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const caregiverRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (caregiverRef.current && !caregiverRef.current.contains(e.target as Node)) {
        setCaregiverDropdownOpen(false);
      }
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredCaregivers = allCaregivers.filter((cg) =>
    cg.name.toLowerCase().includes(caregiverSearch.toLowerCase())
  );

  const filteredClients = allClients.filter((cl) =>
    cl.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const toggleCaregiver = (id: string) => {
    if (selectedCaregivers.includes(id)) {
      onCaregiversChange(selectedCaregivers.filter((item) => item !== id));
    } else {
      onCaregiversChange([...selectedCaregivers, id]);
    }
  };

  const toggleClient = (id: string) => {
    if (selectedClients.includes(id)) {
      onClientsChange(selectedClients.filter((item) => item !== id));
    } else {
      onClientsChange([...selectedClients, id]);
    }
  };

  const toggleStatus = (statusId: string) => {
    if (selectedStatuses.includes(statusId)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== statusId));
    } else {
      onStatusesChange([...selectedStatuses, statusId]);
    }
  };

  const hasActiveFilters =
    selectedCaregivers.length > 0 ||
    selectedClients.length > 0 ||
    selectedStatuses.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3.5 mb-4 space-y-3">
      {/* Top row: Comboboxes and Status Toggles */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Caregiver Combobox */}
        <div className="flex-1 min-w-[220px] max-w-[280px]" ref={caregiverRef}>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Caregiver
          </label>
          <div className="relative">
            <div
              onClick={() => setCaregiverDropdownOpen((prev) => !prev)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg shadow-inner cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search/select"
                  value={caregiverSearch}
                  onChange={(e) => {
                    setCaregiverSearch(e.target.value);
                    setCaregiverDropdownOpen(true);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCaregiverDropdownOpen(true);
                  }}
                  className="w-full text-sm bg-transparent outline-none placeholder-gray-400"
                />
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
            </div>

            {caregiverDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {filteredCaregivers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    No caregivers found
                  </div>
                ) : (
                  filteredCaregivers.map((cg) => {
                    const isSelected = selectedCaregivers.includes(cg.id);
                    return (
                      <div
                        key={cg.id}
                        onClick={() => toggleCaregiver(cg.id)}
                        className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cg.color || '#3B82F6' }}
                          />
                          <span className="truncate text-gray-900 font-medium">
                            {cg.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {cg.visitCount !== undefined && (
                            <span className="text-xs text-gray-500">
                              {cg.visitCount} visits
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Patient (Client) Combobox */}
        <div className="flex-1 min-w-[220px] max-w-[280px]" ref={clientRef}>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Patient (Client)
          </label>
          <div className="relative">
            <div
              onClick={() => setClientDropdownOpen((prev) => !prev)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg shadow-inner cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search/select"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientDropdownOpen(true);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setClientDropdownOpen(true);
                  }}
                  className="w-full text-sm bg-transparent outline-none placeholder-gray-400"
                />
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
            </div>

            {clientDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    No clients found
                  </div>
                ) : (
                  filteredClients.map((cl) => {
                    const isSelected = selectedClients.includes(cl.id);
                    return (
                      <div
                        key={cl.id}
                        onClick={() => toggleClient(cl.id)}
                        className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="truncate text-gray-900 font-medium">
                          {cl.name}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {cl.visitCount !== undefined && (
                            <span className="text-xs text-gray-500">
                              {cl.visitCount} visits
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Toggles */}
        <div className="flex-1 min-w-[320px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Status
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((status) => {
              const isActive = selectedStatuses.includes(status.id);
              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => toggleStatus(status.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    isActive
                      ? 'border-transparent text-white shadow-sm ' + status.activeClass
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-pressed={isActive}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-white' : status.dotColor
                    }`}
                  />
                  <span>{status.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: Active Filter Chips & Clear All */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          {/* Caregiver chips */}
          {selectedCaregivers.map((cgId) => {
            const caregiver = allCaregivers.find((c) => c.id === cgId);
            return (
              <span
                key={cgId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: caregiver?.color || '#3B82F6' }}
                />
                <span>{caregiver?.name || cgId}</span>
                <button
                  type="button"
                  onClick={() => toggleCaregiver(cgId)}
                  className="ml-1 hover:text-blue-900 focus:outline-none"
                  aria-label={`Remove ${caregiver?.name || cgId} filter`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}

          {/* Client chips */}
          {selectedClients.map((clId) => {
            const client = allClients.find((c) => c.id === clId);
            return (
              <span
                key={clId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200"
              >
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                <span>{client?.name || clId}</span>
                <button
                  type="button"
                  onClick={() => toggleClient(clId)}
                  className="ml-1 hover:text-teal-900 focus:outline-none"
                  aria-label={`Remove ${client?.name || clId} filter`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}

          {/* Clear all button */}
          <button
            type="button"
            onClick={onClearAll}
            className="px-3 py-0.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-full transition-colors ml-auto shadow-sm"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
