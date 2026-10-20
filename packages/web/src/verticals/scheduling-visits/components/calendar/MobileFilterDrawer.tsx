import React, { useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import type { FilterOption } from './CalendarFilterBar';
import { STATUS_OPTIONS } from './CalendarFilterBar';

export interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allCaregivers: FilterOption[];
  allClients: FilterOption[];
  selectedCaregivers: string[];
  onCaregiversChange: (ids: string[]) => void;
  selectedClients: string[];
  onClientsChange: (ids: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  onReset: () => void;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  allCaregivers,
  allClients,
  selectedCaregivers,
  onCaregiversChange,
  selectedClients,
  onClientsChange,
  selectedStatuses,
  onStatusesChange,
  onReset,
}) => {
  const [caregiverSearch, setCaregiverSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  if (!isOpen) return null;

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

  const activeCount =
    selectedCaregivers.length + selectedClients.length + selectedStatuses.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            Filters ({activeCount})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            [Close]
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Caregiver Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
              Caregiver
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                value={caregiverSearch}
                onChange={(e) => setCaregiverSearch(e.target.value)}
                className="w-full text-sm bg-transparent outline-none"
              />
            </div>

            {/* Selected chips */}
            {selectedCaregivers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCaregivers.map((id) => {
                  const cg = allCaregivers.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cg?.color || '#3B82F6' }}
                      />
                      <span>{cg?.name || id}</span>
                      <button
                        type="button"
                        onClick={() => toggleCaregiver(id)}
                        className="ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Caregiver search list */}
            {caregiverSearch.trim().length > 0 && (
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-1 space-y-0.5">
                {filteredCaregivers.slice(0, 10).map((cg) => {
                  const isSelected = selectedCaregivers.includes(cg.id);
                  return (
                    <div
                      key={cg.id}
                      onClick={() => toggleCaregiver(cg.id)}
                      className="flex items-center justify-between p-2 rounded text-xs hover:bg-gray-100 cursor-pointer"
                    >
                      <span>{cg.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient (Client) Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
              Patient (Client)
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full text-sm bg-transparent outline-none"
              />
            </div>

            {/* Selected chips */}
            {selectedClients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedClients.map((id) => {
                  const cl = allClients.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200"
                    >
                      <span className="w-2 h-2 rounded-full bg-teal-600" />
                      <span>{cl?.name || id}</span>
                      <button
                        type="button"
                        onClick={() => toggleClient(id)}
                        className="ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Client search list */}
            {clientSearch.trim().length > 0 && (
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-1 space-y-0.5">
                {filteredClients.slice(0, 10).map((cl) => {
                  const isSelected = selectedClients.includes(cl.id);
                  return (
                    <div
                      key={cl.id}
                      onClick={() => toggleClient(cl.id)}
                      className="flex items-center justify-between p-2 rounded text-xs hover:bg-gray-100 cursor-pointer"
                    >
                      <span>{cl.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => {
                const isActive = selectedStatuses.includes(status.id);
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => toggleStatus(status.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? 'border-transparent text-white ' + status.activeClass
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
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

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-colors"
          >
            Apply Filters ({activeCount})
          </button>
        </div>
      </div>
    </div>
  );
};
